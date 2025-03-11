import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Backup } from '../entities/Backup';
import { Schedule } from '../entities/Schedule';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as ssh2 from 'ssh2';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import fetch from 'node-fetch';
import { Stats } from 'fs';

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
      const stats = await fs.promises.stat(hostSourcePath);
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
    
    await fs.promises.mkdir(path.dirname(hostTargetPath), { recursive: true });
    await fs.promises.copyFile(hostSourcePath, hostTargetPath);
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
        const archiveStats = await fs.promises.stat(archivePath);
        backup.size = archiveStats.size;
        await this.backupRepository.save(backup);
        logger.info(`Updated backup size to ${backup.size} bytes (compressed archive size)`);
        
        // Übertrage die komprimierte Datei
        const remoteFilePath = path.posix.join(sftpConfig.remotePath, archiveName);
        logger.info(`Uploading compressed archive ${archivePath} to ${sftpConfig.host}:${remoteFilePath}`);
        
        await this.uploadFileViaSftp(archivePath, remoteFilePath, sftpConfig);
        
        // Lösche die temporäre Archivdatei
        await fs.promises.unlink(archivePath);
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
        await fs.promises.access(hostSourcePath);
      } catch (error) {
        throw new Error(`Source path does not exist: ${hostSourcePath}`);
      }
      
      // Prüfe, ob der Quellpfad ein Verzeichnis ist
      const stats = await fs.promises.stat(hostSourcePath);
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
        const archiveStats = await fs.promises.stat(archivePath);
        backup.size = archiveStats.size;
        await this.backupRepository.save(backup);
        logger.info(`Updated backup size to ${backup.size} bytes (compressed archive size)`);
        
        // Übertrage die komprimierte Datei
        const remoteFilePath = smbConfig.remotePath ? `${smbConfig.remotePath}/${archiveName}` : archiveName;
        logger.info(`Uploading compressed archive ${archivePath} to ${smbConfig.host}:${remoteFilePath}`);
        
        await this.uploadFileViaSmb(archivePath, remoteFilePath, smbConfig);
        
        // Lösche die temporäre Archivdatei
        await fs.promises.unlink(archivePath);
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
        await fs.promises.access(localFilePath);
        const stats = await fs.promises.stat(localFilePath);
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
            await fs.promises.unlink(`/tmp/verify_${remoteFileName}`);
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
      
      await fs.promises.writeFile(tempCommandFile, commands);
      
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
      await fs.promises.unlink(tempCommandFile);
      
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

  async performDropboxBackup(backup: Backup, target: Target): Promise<string> {
    logger.info(`Starting Dropbox backup for ${backup.sourcePath}`);
    
    try {
      // Get the access token from target credentials
      const accessToken = target.credentials?.accessToken;
      
      if (!accessToken) {
        throw new Error('Dropbox access token not found in target credentials');
      }
      
      // Determine the target path in Dropbox
      const dropboxPath = target.path || '/';
      
      // Map the source path to the host file system
      const sourcePath = this.convertToHostPath(backup.sourcePath);
      
      // Get the filename from the source path
      const filename = path.basename(sourcePath);
      
      // Create the target path in Dropbox
      // Remove the timestamp from the filename
      const targetPath = `${dropboxPath}/${filename}`;
      
      logger.info(`Uploading file to Dropbox: ${sourcePath} -> ${targetPath}`);
      
      // Check if the source is a directory
      const stats = fs.statSync(sourcePath);
      
      if (stats.isDirectory()) {
        // Create a temporary zip file
        const tempZipFile = path.join(os.tmpdir(), `${filename}.zip`);
        
        // Compress the directory
        await this.compressDirectory(sourcePath, tempZipFile);
        
        // Upload the zip file to Dropbox
        await this.uploadFileToDropbox(tempZipFile, targetPath + '.zip', accessToken);
        
        // Delete the temporary zip file
        fs.unlinkSync(tempZipFile);
        
        return path.basename(targetPath + '.zip');
      } else {
        // Upload the file directly to Dropbox
        await this.uploadFileToDropbox(sourcePath, targetPath, accessToken);
        
        return filename;
      }
    } catch (error) {
      logger.error(`Error performing Dropbox backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  private async uploadFileToDropbox(filePath: string, dropboxPath: string, accessToken: string): Promise<void> {
    try {
      logger.info(`Uploading file to Dropbox: ${filePath} -> ${dropboxPath}`);
      
      // Read the file
      const fileContent = fs.readFileSync(filePath);
      const fileSize = fs.statSync(filePath).size;
      
      // For files larger than 150MB, we need to use the upload session API
      const UPLOAD_SESSION_THRESHOLD = 150 * 1024 * 1024; // 150MB
      
      if (fileSize > UPLOAD_SESSION_THRESHOLD) {
        await this.uploadLargeFileToDropbox(filePath, dropboxPath, accessToken);
      } else {
        // For smaller files, we can use the simple upload API
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path: dropboxPath,
              mode: 'add',
              autorename: true,
              mute: false
            })
          },
          body: fileContent
        });
        
        if (!response.ok) {
          // Try to get the error message as text first
          const errorText = await response.text();
          logger.error(`Dropbox API error response: ${errorText}`);
          
          try {
            // Try to parse as JSON if possible
            const errorData = JSON.parse(errorText);
            throw new Error(`Dropbox API error: ${JSON.stringify(errorData)}`);
          } catch (jsonError) {
            // If it's not valid JSON, just use the text
            throw new Error(`Dropbox API error: ${errorText}`);
          }
        }
        
        logger.info(`File successfully uploaded to Dropbox: ${dropboxPath}`);
      }
    } catch (error) {
      logger.error('Dropbox upload failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }
  
  private async uploadLargeFileToDropbox(filePath: string, dropboxPath: string, accessToken: string): Promise<void> {
    try {
      logger.info(`Uploading large file to Dropbox using upload session: ${filePath}`);
      
      // Start an upload session
      const startSessionResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            close: false
          })
        },
        body: '' // Empty body to start the session
      });
      
      if (!startSessionResponse.ok) {
        const errorText = await startSessionResponse.text();
        logger.error(`Dropbox API error response: ${errorText}`);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(`Failed to start Dropbox upload session: ${JSON.stringify(errorData)}`);
        } catch (jsonError) {
          throw new Error(`Failed to start Dropbox upload session: ${errorText}`);
        }
      }
      
      const sessionData = await startSessionResponse.json();
      const sessionId = sessionData.session_id;
      
      // Read the file in chunks and upload each chunk
      const fileSize = fs.statSync(filePath).size;
      const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
      const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
      
      let offset = 0;
      
      for await (const chunk of fileStream) {
        // Append to the upload session
        const appendResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              cursor: {
                session_id: sessionId,
                offset: offset
              },
              close: false
            })
          },
          body: chunk
        });
        
        if (!appendResponse.ok) {
          const errorText = await appendResponse.text();
          logger.error(`Dropbox API error response: ${errorText}`);
          
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(`Failed to append to Dropbox upload session: ${JSON.stringify(errorData)}`);
          } catch (jsonError) {
            throw new Error(`Failed to append to Dropbox upload session: ${errorText}`);
          }
        }
        
        offset += chunk.length;
        logger.info(`Uploaded ${offset} of ${fileSize} bytes to Dropbox (${Math.round(offset / fileSize * 100)}%)`);
      }
      
      // Finish the upload session
      const finishResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            cursor: {
              session_id: sessionId,
              offset: offset
            },
            commit: {
              path: dropboxPath,
              mode: 'add',
              autorename: true,
              mute: false
            }
          })
        },
        body: '' // Empty body to finish the session
      });
      
      if (!finishResponse.ok) {
        const errorText = await finishResponse.text();
        logger.error(`Dropbox API error response: ${errorText}`);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(`Failed to finish Dropbox upload session: ${JSON.stringify(errorData)}`);
        } catch (jsonError) {
          throw new Error(`Failed to finish Dropbox upload session: ${errorText}`);
        }
      }
      
      logger.info(`Large file successfully uploaded to Dropbox: ${dropboxPath}`);
    } catch (error) {
      logger.error('Dropbox large file upload failed:', error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }

  private async performGoogleDriveBackup(backup: Backup, target: Target): Promise<void> {
    try {
      logger.info(`Starting Google Drive backup for ${backup.sourcePath}`);
      
      // Get the access token from target credentials
      let accessToken = target.credentials?.accessToken;
      if (!accessToken) {
        throw new Error('Google Drive access token not found. Please reconnect your Google Drive account.');
      }
      
      // Check if we have a refresh token and if the token is expired
      const refreshToken = target.credentials?.refreshToken;
      const tokenExpiresAt = target.credentials?.tokenExpiresAt;
      const clientId = target.credentials?.clientId;
      const clientSecret = target.credentials?.clientSecret;
      
      // If we have all the necessary credentials and the token is expired, refresh it
      if (refreshToken && tokenExpiresAt && clientId && clientSecret) {
        const now = Date.now();
        
        // If the token is expired or will expire in the next 5 minutes
        if (tokenExpiresAt < now + 5 * 60 * 1000) {
          logger.info('Google Drive access token is expired or will expire soon, refreshing...');
          
          try {
            const newTokenData = await this.refreshGoogleDriveToken(refreshToken, clientId, clientSecret);
            
            // Update the access token
            accessToken = newTokenData.accessToken;
            
            // Update the target with the new token data
            target.credentials = {
              ...target.credentials,
              accessToken: newTokenData.accessToken,
              tokenExpiresAt: newTokenData.expiresAt
            };
            
            // Save the updated target
            await this.targetRepo.save(target);
            
            logger.info('Google Drive access token refreshed successfully');
          } catch (refreshError) {
            logger.error('Failed to refresh Google Drive access token:', refreshError);
            throw new Error(`Failed to refresh Google Drive access token: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
          }
        }
      }
      
      // Verify the access token is valid by making a simple API call
      try {
        const testResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!testResponse.ok) {
          if (testResponse.status === 401) {
            throw new Error('Google Drive access token is invalid. Please reconnect your Google Drive account.');
          } else {
            const errorText = await testResponse.text();
            throw new Error(`Failed to validate Google Drive access token: ${errorText}`);
          }
        }
        
        // Token is valid, proceed with backup
        logger.info('Google Drive access token is valid');
      } catch (tokenError) {
        logger.error('Google Drive token validation failed:', tokenError);
        throw new Error(`Google Drive authentication failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
      }
      
      // Convert the source path to host path if needed
      const sourcePath = this.convertToHostPath(backup.sourcePath);
      logger.info(`Source path for backup: ${sourcePath}`);
      
      // Determine if the source is a file or directory
      const stats = statSync(sourcePath);
      
      let backupFilePath: string;
      
      if (stats.isDirectory()) {
        // For directories, create a zip file
        const tempZipPath = path.join(os.tmpdir(), `backup_${Date.now()}.zip`);
        logger.info(`Compressing directory ${sourcePath} to ${tempZipPath}`);
        await this.compressDirectory(sourcePath, tempZipPath);
        backupFilePath = tempZipPath;
      } else {
        // For files, use the file directly
        backupFilePath = sourcePath;
      }
      
      // Upload the file to Google Drive
      await this.uploadFileToGoogleDrive(backupFilePath, target.path, accessToken);
      
      // Update backup status
      backup.status = 'completed';
      // Set completed timestamp
      backup.completedAt = new Date();
      
      // Calculate file size
      const fileStats = statSync(backupFilePath);
      
      backup.size = fileStats.size;
      
      // Save the updated backup
      await this.backupRepository.save(backup);
      
      // Clean up temporary files if needed
      if (stats.isDirectory()) {
        fs.unlinkSync(backupFilePath);
      }
      
      logger.info(`Google Drive backup completed successfully for ${backup.sourcePath}`);
    } catch (error) {
      logger.error('Google Drive backup failed:', error);
      
      // Update backup status
      backup.status = 'failed';
      // Set error message
      backup.error = error instanceof Error ? error.message : 'Unknown error';
      await this.backupRepository.save(backup);
      
      throw new Error(`Google Drive backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async uploadFileToGoogleDrive(filePath: string, folderName: string, accessToken: string): Promise<void> {
    try {
      logger.info(`Uploading file ${filePath} to Google Drive folder ${folderName}`);
      
      // First, check if the folder exists or create it
      const folderId = await this.getOrCreateGoogleDriveFolder(folderName, accessToken);
      
      // Get the file name from the path
      const fileName = path.basename(filePath);
      
      // Read the file content as a buffer
      const fileContent = fs.readFileSync(filePath);
      const fileSize = fs.statSync(filePath).size;
      
      logger.info(`File size: ${fileSize} bytes`);
      
      // Create metadata for the file
      const metadata = {
        name: fileName,
        parents: [folderId]
      };
      
      // Try direct upload method instead of resumable upload
      logger.info('Starting direct upload to Google Drive');
      
      // Create multipart request
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      
      // Create the multipart request body
      const requestBody = Buffer.concat([
        Buffer.from(
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/octet-stream\r\n\r\n'
        ),
        fileContent,
        Buffer.from(closeDelimiter)
      ]);
      
      // Upload the file using multipart upload
      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(requestBody.length)
        },
        body: requestBody
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logger.error(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
        throw new Error(`Failed to upload file: ${errorText}`);
      }
      
      const result = await uploadResponse.json();
      logger.info(`File uploaded successfully to Google Drive with ID: ${result.id}`);
    } catch (error) {
      logger.error('Google Drive upload failed:', error);
      throw new Error(`Failed to upload file to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async getOrCreateGoogleDriveFolder(folderName: string, accessToken: string): Promise<string> {
    try {
      logger.info(`Checking if folder ${folderName} exists in Google Drive`);
      
      // First, check if the folder already exists
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Failed to search for folder in Google Drive: ${errorText}`);
      }
      
      const searchResult = await searchResponse.json();
      
      // If the folder exists, return its ID
      if (searchResult.files && searchResult.files.length > 0) {
        logger.info(`Folder ${folderName} found in Google Drive with ID: ${searchResult.files[0].id}`);
        return searchResult.files[0].id;
      }
      
      // If the folder doesn't exist, create it
      logger.info(`Folder ${folderName} not found in Google Drive, creating it`);
      
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create folder in Google Drive: ${errorText}`);
      }
      
      const createResult = await createResponse.json();
      logger.info(`Folder ${folderName} created in Google Drive with ID: ${createResult.id}`);
      
      return createResult.id;
    } catch (error) {
      logger.error('Google Drive folder operation failed:', error);
      throw new Error(`Failed to get or create folder in Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Refreshes a Google Drive access token using the refresh token
   */
  private async refreshGoogleDriveToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{ accessToken: string, expiresAt: number }> {
    try {
      logger.info('Refreshing Google Drive access token');
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from Google');
      }
      
      // Calculate when the token will expire
      const expiresAt = Date.now() + (data.expires_in * 1000);
      
      return {
        accessToken: data.access_token,
        expiresAt
      };
    } catch (error) {
      logger.error('Error refreshing Google Drive token:', error);
      throw new Error(`Failed to refresh Google Drive token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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