import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Backup } from '../entities/Backup';
import { Schedule } from '../entities/Schedule';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import path from 'path';
import * as ssh2 from 'ssh2';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Konstante für das Host-Dateisystem-Präfix
const HOST_FS_PREFIX = process.env.FILE_EXPLORER_BASE_DIR || '/host_fs';

// Interface für SFTP-Konfiguration
interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remotePath: string;
}

// Interface für SMB-Konfiguration
interface SmbConfig {
  host: string;
  username: string;
  password?: string;
  domain?: string;
  share: string;
  remotePath: string;
}

export class BackupService {
  private backupRepository: Repository<Backup>;
  private scheduleRepo = AppDataSource.getRepository(Schedule);
  private targetRepo = AppDataSource.getRepository(Target);

  constructor() {
    this.backupRepository = AppDataSource.getRepository(Backup);
  }

  async createBackup(scheduleId: string): Promise<Backup> {
    const schedule = await this.scheduleRepo.findOne({ 
      where: { id: scheduleId },
      relations: ['target']
    });
    
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const backup = this.backupRepository.create({
      sourcePath: schedule.sourcePath,
      status: 'pending',
      size: 0,
      schedule,
      target: schedule.target
    });

    await this.backupRepository.save(backup);
    
    try {
      await this.performBackup(backup);
      return backup;
    } catch (error: unknown) {
      backup.status = 'failed';
      backup.errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.backupRepository.save(backup);
      throw error;
    }
  }

  async performManualBackup(backupId: string): Promise<void> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
      relations: ['target']
    });
    
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    try {
      await this.performBackup(backup);
    } catch (error: unknown) {
      logger.error('Manual backup failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }

  private async performBackup(backup: Backup): Promise<void> {
    backup.status = 'in_progress';
    await this.backupRepository.save(backup);

    try {
      // Konvertieren des Pfads zum Host-Dateisystem-Pfad
      const hostSourcePath = this.convertToHostPath(backup.sourcePath);
      logger.info(`Performing backup from ${backup.sourcePath} (mapped to ${hostSourcePath})`);
      
      // Prüfe, ob der Quellpfad ein Verzeichnis ist
      const stats = await fs.stat(hostSourcePath);
      const isDirectory = stats.isDirectory();
      
      if (isDirectory) {
        // Für Verzeichnisse berechnen wir die Größe später nach der Komprimierung
        logger.info(`Source is a directory. Size will be calculated after compression.`);
        backup.size = 0; // Vorläufig auf 0 setzen
      } else {
        // Für Dateien verwenden wir die direkte Dateigröße
      backup.size = stats.size;
      }

      // Lade die Target-Relation, falls sie noch nicht geladen ist
      let target: Target;
      if (!backup.target || !backup.target.id) {
        const backupWithTarget = await this.backupRepository.findOne({
          where: { id: backup.id },
          relations: ['target']
        });
        
        if (!backupWithTarget || !backupWithTarget.target) {
          throw new Error('Target not found for backup');
        }
        
        target = backupWithTarget.target;
        backup.target = target;
      } else {
        const foundTarget = await this.targetRepo.findOne({ where: { id: backup.target.id } });
        if (!foundTarget) {
        throw new Error('Target not found');
        }
        target = foundTarget;
      }

      switch (target.type) {
        case 'local':
          await this.performLocalBackup(backup, target);
          break;
        case 'sftp':
          await this.performSftpBackup(backup, target);
          break;
        case 'smb':
          await this.performSmbBackup(backup, target);
          break;
        case 'dropbox':
          await this.performDropboxBackup(backup, target);
          break;
        case 'google_drive':
          await this.performGoogleDriveBackup(backup, target);
          break;
        default:
          throw new Error('Unsupported backup target type');
      }

      backup.status = 'completed';
      await this.backupRepository.save(backup);
    } catch (error: unknown) {
      logger.error('Backup failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      backup.status = 'failed';
      backup.errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.backupRepository.save(backup);
      throw error;
    }
  }

  private async performLocalBackup(backup: Backup, target: Target): Promise<void> {
    // Konvertieren der Pfade zum Host-Dateisystem-Pfad
    const hostSourcePath = this.convertToHostPath(backup.sourcePath);
    const hostTargetPath = this.convertToHostPath(path.join(target.path, path.basename(backup.sourcePath)));
    
    logger.info(`Copying from ${hostSourcePath} to ${hostTargetPath}`);
    
    await fs.mkdir(path.dirname(hostTargetPath), { recursive: true });
    await fs.copyFile(hostSourcePath, hostTargetPath);
  }

  private async performSftpBackup(backup: Backup, target: Target): Promise<void> {
    logger.info(`Starting SFTP backup to ${target.path}`);
    
    try {
      // Überprüfe, ob die erforderlichen Anmeldeinformationen vorhanden sind
      if (!target.credentials || !target.credentials.host || !target.credentials.username) {
        throw new Error('Missing SFTP credentials. Host and username are required.');
      }
      
      // Erstelle SFTP-Konfiguration aus den Anmeldeinformationen
      const sftpConfig: SftpConfig = {
        host: target.credentials.host,
        port: target.credentials.port || 22,
        username: target.credentials.username,
        password: target.credentials.password,
        privateKey: target.credentials.privateKey,
        remotePath: target.path
      };
      
      // Konvertieren des Pfads zum Host-Dateisystem-Pfad
      const hostSourcePath = this.convertToHostPath(backup.sourcePath);
      
      // Prüfe, ob der Quellpfad ein Verzeichnis ist
      const stats = statSync(hostSourcePath);
      const isDirectory = stats.isDirectory();
      
      if (isDirectory) {
        // Wenn es ein Verzeichnis ist, komprimiere es zuerst
        logger.info(`Source path is a directory. Compressing ${hostSourcePath} before upload`);
        
        const sourceFileName = path.basename(hostSourcePath);
        const tempDir = '/tmp';
        const archiveName = `${sourceFileName}_${Date.now()}.tar.gz`;
        const archivePath = path.join(tempDir, archiveName);
        
        // Komprimiere das Verzeichnis
        logger.info(`Compressing directory to ${archivePath}`);
        await this.compressDirectory(hostSourcePath, archivePath);
        
        // Aktualisiere die Backup-Größe mit der Größe des komprimierten Archivs
        const archiveStats = await fs.stat(archivePath);
        backup.size = archiveStats.size;
        await this.backupRepository.save(backup);
        logger.info(`Updated backup size to ${backup.size} bytes (compressed archive size)`);
        
        // Übertrage die komprimierte Datei
        const remoteFilePath = path.posix.join(sftpConfig.remotePath, archiveName);
        logger.info(`Uploading compressed archive ${archivePath} to ${sftpConfig.host}:${remoteFilePath}`);
        
        await this.uploadFileViaSftp(archivePath, remoteFilePath, sftpConfig);
        
        // Lösche die temporäre Archivdatei
        await fs.unlink(archivePath);
        logger.info(`Deleted temporary archive ${archivePath}`);
      } else {
        // Wenn es eine Datei ist, übertrage sie direkt
        const sourceFileName = path.basename(hostSourcePath);
        const remoteFilePath = path.posix.join(sftpConfig.remotePath, sourceFileName);
        
        logger.info(`Uploading file ${hostSourcePath} to ${sftpConfig.host}:${remoteFilePath}`);
        await this.uploadFileViaSftp(hostSourcePath, remoteFilePath, sftpConfig);
      }
      
      logger.info(`SFTP backup completed successfully`);
    } catch (error) {
      logger.error('SFTP backup failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }
  
  private uploadFileViaSftp(localFilePath: string, remoteFilePath: string, config: SftpConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new ssh2.Client();
      
      conn.on('ready', () => {
        logger.info('SSH connection established');
        
        conn.sftp((err: Error | undefined, sftp: ssh2.SFTPWrapper) => {
          if (err) {
            conn.end();
            return reject(new Error(`SFTP subsystem error: ${err.message}`));
          }
          
          // Ensure remote directory exists
          const remoteDir = path.posix.dirname(remoteFilePath);
          this.ensureRemoteDirectoryExists(sftp, remoteDir)
            .then(() => {
              // Create read stream from local file
              const readStream = createReadStream(localFilePath);
              
              // Create write stream to remote file
              const writeStream = sftp.createWriteStream(remoteFilePath);
              
              // Handle events
              writeStream.on('close', () => {
                logger.info(`File transfer completed: ${remoteFilePath}`);
                conn.end();
                resolve();
              });
              
              writeStream.on('error', (err: Error) => {
                conn.end();
                reject(new Error(`Error writing to remote file: ${err.message}`));
              });
              
              // Pipe data from local to remote
              readStream.pipe(writeStream);
            })
            .catch(err => {
              conn.end();
              reject(err);
            });
        });
      });
      
      conn.on('error', (err: Error) => {
        reject(new Error(`SSH connection error: ${err.message}`));
      });
      
      // Connect to SSH server
      const connectConfig: ssh2.ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username
      };
      
      // Add authentication method
      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } else {
        return reject(new Error('No authentication method provided. Either password or private key is required.'));
      }
      
      conn.connect(connectConfig);
    });
  }
  
  private async ensureRemoteDirectoryExists(sftp: ssh2.SFTPWrapper, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, { mode: '0755' }, (err: any) => {
        if (!err || (err && 'code' in err && err.code === 4)) { // Code 4 means directory already exists
          resolve();
        } else {
          // Try to create parent directory first
          const parentDir = path.posix.dirname(remotePath);
          if (parentDir === '/' || parentDir === '.') {
            reject(new Error(`Failed to create directory ${remotePath}: ${err.message}`));
          } else {
            this.ensureRemoteDirectoryExists(sftp, parentDir)
              .then(() => this.ensureRemoteDirectoryExists(sftp, remotePath))
              .then(resolve)
              .catch(reject);
          }
        }
      });
    });
  }

  private async compressDirectory(sourcePath: string, outputPath: string): Promise<void> {
    try {
      // Verwende tar, um das Verzeichnis zu komprimieren
      const sourceDir = path.dirname(sourcePath);
      const sourceName = path.basename(sourcePath);
      
      // Führe den tar-Befehl aus
      const { stdout, stderr } = await execPromise(
        `cd "${sourceDir}" && tar -czf "${outputPath}" "${sourceName}"`
      );
      
      if (stderr) {
        logger.warn(`Compression warning: ${stderr}`);
      }
      
      logger.info(`Directory compressed successfully: ${stdout || 'No output'}`);
    } catch (error) {
      logger.error('Compression failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw new Error(`Failed to compress directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performSmbBackup(backup: Backup, target: Target): Promise<void> {
    logger.info(`Starting SMB backup to ${target.path}`);
    
    try {
      // Überprüfe, ob die erforderlichen Anmeldeinformationen vorhanden sind
      if (!target.credentials || !target.credentials.host || !target.credentials.username || !target.credentials.share) {
        throw new Error('Missing SMB credentials. Host, username, and share are required.');
      }
      
      // Erstelle SMB-Konfiguration aus den Anmeldeinformationen
      const smbConfig: SmbConfig = {
        host: target.credentials.host,
        username: target.credentials.username,
        password: target.credentials.password,
        domain: target.credentials.domain,
        share: target.credentials.share,
        remotePath: target.path || ''
      };
      
      // Stelle sicher, dass der Remote-Pfad keine führenden oder nachfolgenden Slashes hat
      smbConfig.remotePath = smbConfig.remotePath.replace(/^\/+|\/+$/g, '');
      
      // Konvertieren des Pfads zum Host-Dateisystem-Pfad
      const hostSourcePath = this.convertToHostPath(backup.sourcePath);
      logger.info(`Source path converted to host path: ${hostSourcePath}`);
      
      // Prüfe, ob der Quellpfad existiert
      try {
        await fs.access(hostSourcePath);
      } catch (error) {
        throw new Error(`Source path does not exist: ${hostSourcePath}`);
      }
      
      // Prüfe, ob der Quellpfad ein Verzeichnis ist
      const stats = await fs.stat(hostSourcePath);
      const isDirectory = stats.isDirectory();
      
      if (isDirectory) {
        // Wenn es ein Verzeichnis ist, komprimiere es zuerst
        logger.info(`Source path is a directory. Compressing ${hostSourcePath} before upload`);
        
        const sourceFileName = path.basename(hostSourcePath);
        const tempDir = '/tmp';
        const archiveName = `${sourceFileName}_${Date.now()}.tar.gz`;
        const archivePath = path.join(tempDir, archiveName);
        
        // Komprimiere das Verzeichnis
        logger.info(`Compressing directory to ${archivePath}`);
        await this.compressDirectory(hostSourcePath, archivePath);
        
        // Aktualisiere die Backup-Größe mit der Größe des komprimierten Archivs
        const archiveStats = await fs.stat(archivePath);
        backup.size = archiveStats.size;
        await this.backupRepository.save(backup);
        logger.info(`Updated backup size to ${backup.size} bytes (compressed archive size)`);
        
        // Übertrage die komprimierte Datei
        const remoteFilePath = smbConfig.remotePath ? `${smbConfig.remotePath}/${archiveName}` : archiveName;
        logger.info(`Uploading compressed archive ${archivePath} to ${smbConfig.host}:${remoteFilePath}`);
        
        await this.uploadFileViaSmb(archivePath, remoteFilePath, smbConfig);
        
        // Lösche die temporäre Archivdatei
        await fs.unlink(archivePath);
        logger.info(`Deleted temporary archive ${archivePath}`);
      } else {
        // Wenn es eine Datei ist, übertrage sie direkt
        const sourceFileName = path.basename(hostSourcePath);
        const remoteFilePath = smbConfig.remotePath ? `${smbConfig.remotePath}/${sourceFileName}` : sourceFileName;
        
        logger.info(`Uploading file ${hostSourcePath} to ${smbConfig.host}:${remoteFilePath}`);
        await this.uploadFileViaSmb(hostSourcePath, remoteFilePath, smbConfig);
      }
      
      logger.info(`SMB backup completed successfully`);
    } catch (error) {
      logger.error('SMB backup failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }
  
  private async uploadFileViaSmb(localFilePath: string, remoteFilePath: string, config: SmbConfig): Promise<void> {
    try {
      // Überprüfe, ob die lokale Datei existiert
      try {
        await fs.access(localFilePath);
        const stats = await fs.stat(localFilePath);
        logger.info(`Local file exists: ${localFilePath}, size: ${stats.size} bytes`);
      } catch (error) {
        throw new Error(`Local file does not exist: ${localFilePath}`);
      }

      // Erstelle das Zielverzeichnis
      const remoteDirPath = path.dirname(remoteFilePath);
      await this.ensureSmbDirectoryExists(config, remoteDirPath);
      
      // Erstelle den smbclient-Befehl
      const remoteFileName = path.basename(remoteFilePath);
      const shareUrl = `//${config.host}/${config.share}`;
      
      // Formatiere den Pfad für SMB (Backslashes statt Slashes)
      const formattedRemotePath = config.remotePath.replace(/\//g, '\\');
      
      // Erstelle den Authentifizierungsstring
      let authParams = '';
      if (config.domain) {
        authParams += ` -W ${config.domain}`;
      }
      
      // Direkter Ansatz: Verwende einen einzelnen Befehl ohne temporäre Datei
      // Verwende -D für das Verzeichnis und -c für den Befehl
      const smbCommand = `smbclient "${shareUrl}" "${config.password || ''}" -U ${config.username}${authParams} -D "${formattedRemotePath}" -c "put \\"${localFilePath}\\" \\"${remoteFileName}\\""`;
      
      logger.info(`Executing direct SMB command to upload file: ${path.basename(localFilePath)} to ${formattedRemotePath}/${remoteFileName}`);
      const { stdout, stderr } = await execPromise(smbCommand);
      
      logger.info(`SMB upload stdout: ${stdout}`);
      if (stderr) {
        logger.info(`SMB upload stderr: ${stderr}`);
      }
      
      // Überprüfe, ob es ein echter Fehler ist oder nur eine Erfolgsmeldung
      // Erfolgsmeldungen enthalten typischerweise "putting file" und "kb/s"
      if (stderr && 
          !stderr.includes('NT_STATUS_OK') && 
          !stderr.includes('putting file') && 
          !stderr.includes('kb/s')) {
        throw new Error(`SMB error: ${stderr}`);
      }
      
      // Warte einen Moment, um sicherzustellen, dass die Datei auf dem Server angekommen ist
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Überprüfe, ob die Datei tatsächlich hochgeladen wurde
      // Verwende einen einfacheren Befehl, der nur den Inhalt des Verzeichnisses auflistet
      const verifyCommand = `smbclient "${shareUrl}" "${config.password || ''}" -U ${config.username}${authParams} -D "${formattedRemotePath}" -c "ls"`;
      
      try {
        logger.info(`Executing verification command: ${verifyCommand}`);
        const { stdout: verifyStdout, stderr: verifyStderr } = await execPromise(verifyCommand);
        
        logger.info(`Verification stdout: ${verifyStdout}`);
        if (verifyStderr) {
          logger.info(`Verification stderr: ${verifyStderr}`);
        }
        
        // Überprüfe, ob der Dateiname in der Ausgabe enthalten ist
        if (verifyStdout.includes(remoteFileName)) {
          logger.info(`File verified on SMB share: ${remoteFileName}`);
        } else {
          logger.warn(`File not found in directory listing: ${remoteFileName}`);
          logger.warn(`Directory contents: ${verifyStdout}`);
          
          // Versuche es mit einem alternativen Befehl
          try {
            // Versuche es mit einem direkten Zugriff auf die Datei
            const directAccessCommand = `smbclient "${shareUrl}" "${config.password || ''}" -U ${config.username}${authParams} -c "get \\"${formattedRemotePath}\\\\${remoteFileName}\\" /tmp/verify_${remoteFileName}"`;
            logger.info(`Trying direct file access: ${directAccessCommand}`);
            
            await execPromise(directAccessCommand);
            logger.info(`Direct file access successful, file exists`);
            
            // Lösche die temporäre Datei
            await fs.unlink(`/tmp/verify_${remoteFileName}`);
          } catch (directAccessError) {
            logger.error(`Direct file access failed: ${directAccessError instanceof Error ? directAccessError.message : 'Unknown error'}`);
            throw new Error(`File verification failed: File not found on SMB share`);
          }
        }
      } catch (verifyError) {
        logger.warn(`File verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
        
        // Wenn die Überprüfung fehlschlägt, aber die Ausgabe des Upload-Befehls "putting file" und "kb/s" enthält,
        // gehen wir davon aus, dass der Upload erfolgreich war
        if (stderr && stderr.includes('putting file') && stderr.includes('kb/s')) {
          logger.info(`Upload seems successful based on stderr output, despite verification failure`);
        } else {
          throw new Error(`File verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
        }
      }
      
      logger.info(`File successfully uploaded to SMB share`);
    } catch (error) {
      logger.error('SMB upload failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw new Error(`Failed to upload file to SMB share: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async ensureSmbDirectoryExists(config: SmbConfig, dirPath: string): Promise<void> {
    try {
      // Formatiere den Pfad für SMB (Backslashes statt Slashes)
      const formattedPath = dirPath.replace(/\//g, '\\');
      
      // Erstelle eine temporäre Datei mit den SMB-Befehlen
      const tempCommandFile = `/tmp/smb_mkdir_commands_${Date.now()}.txt`;
      
      // Erstelle jeden Teil des Pfades einzeln
      const pathParts = formattedPath.split('\\').filter(part => part.length > 0);
      let currentPath = '';
      let commands = '';
      
      for (const part of pathParts) {
        currentPath += `\\${part}`;
        commands += `mkdir "${currentPath}"\n`;
      }
      
      commands += 'quit\n';
      
      await fs.writeFile(tempCommandFile, commands);
      
      // Erstelle den Authentifizierungsstring
      let authParams = '';
      if (config.domain) {
        authParams += ` -W ${config.domain}`;
      }
      
      // Führe den smbclient-Befehl aus
      const shareUrl = `//${config.host}/${config.share}`;
      const smbCommand = `smbclient "${shareUrl}" "${config.password || ''}" -U ${config.username}${authParams} -c "$(cat ${tempCommandFile})"`;
      
      logger.info(`Creating directory structure on SMB share: ${formattedPath}`);
      const { stdout, stderr } = await execPromise(smbCommand);
      
      // Lösche die temporäre Befehlsdatei
      await fs.unlink(tempCommandFile);
      
      // Ignoriere Fehler, wenn das Verzeichnis bereits existiert
      if (stderr && !stderr.includes('NT_STATUS_OK') && !stderr.includes('NT_STATUS_OBJECT_NAME_COLLISION')) {
        throw new Error(`SMB error: ${stderr}`);
      }
      
      // Überprüfe, ob das Verzeichnis tatsächlich erstellt wurde
      const verifyCommand = `smbclient "${shareUrl}" "${config.password || ''}" -U ${config.username}${authParams} -c "cd ${formattedPath}; pwd"`;
      
      try {
        await execPromise(verifyCommand);
        logger.info(`Directory structure verified on SMB share: ${formattedPath}`);
      } catch (verifyError) {
        logger.warn(`Directory verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
      }
      
      logger.info(`Directory structure created or already exists on SMB share: ${stdout}`);
    } catch (error) {
      logger.error('Failed to ensure SMB directory exists:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw new Error(`Failed to ensure SMB directory exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performDropboxBackup(backup: Backup, target: Target): Promise<void> {
    // Implementation for Dropbox backup
    throw new Error('Dropbox backup not implemented yet');
  }

  private async performGoogleDriveBackup(backup: Backup, target: Target): Promise<void> {
    // Implementation for Google Drive backup
    throw new Error('Google Drive backup not implemented yet');
  }
  
  // Hilfsmethode zum Konvertieren eines Pfads in einen Host-Dateisystem-Pfad
  private convertToHostPath(filePath: string): string {
    // Wenn der Pfad bereits mit dem Host-FS-Präfix beginnt, gib ihn unverändert zurück
    if (filePath.startsWith(HOST_FS_PREFIX)) {
      return filePath;
    }
    
    // Entferne führenden Slash, wenn vorhanden, um doppelte Slashes zu vermeiden
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // Kombiniere das Host-FS-Präfix mit dem bereinigten Pfad
    return path.join(HOST_FS_PREFIX, cleanPath);
  }
} 