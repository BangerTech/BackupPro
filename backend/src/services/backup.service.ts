import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Backup } from '../entities/Backup';
import { Schedule } from '../entities/Schedule';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import path from 'path';

export class BackupService {
  private backupRepository: Repository<Backup>;
  private scheduleRepo = AppDataSource.getRepository(Schedule);
  private targetRepo = AppDataSource.getRepository(Target);

  constructor() {
    this.backupRepository = AppDataSource.getRepository(Backup);
  }

  async createBackup(scheduleId: string): Promise<Backup> {
    const schedule = await this.scheduleRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const backup = this.backupRepository.create({
      sourcePath: schedule.sourcePath,
      status: 'pending',
      size: 0,
      schedule
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

  private async performBackup(backup: Backup): Promise<void> {
    backup.status = 'in_progress';
    await this.backupRepository.save(backup);

    try {
      const stats = await fs.stat(backup.sourcePath);
      backup.size = stats.size;

      const target = await this.targetRepo.findOne({ where: { id: backup.target.id } });
      if (!target) {
        throw new Error('Target not found');
      }

      switch (target.type) {
        case 'local':
          await this.performLocalBackup(backup, target);
          break;
        case 'sftp':
          await this.performSftpBackup(backup, target);
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
    const sourcePath = backup.sourcePath;
    const targetPath = path.join(target.path, path.basename(sourcePath));
    
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }

  private async performSftpBackup(backup: Backup, target: Target): Promise<void> {
    // Implementation for SFTP backup
    throw new Error('SFTP backup not implemented yet');
  }

  private async performDropboxBackup(backup: Backup, target: Target): Promise<void> {
    // Implementation for Dropbox backup
    throw new Error('Dropbox backup not implemented yet');
  }

  private async performGoogleDriveBackup(backup: Backup, target: Target): Promise<void> {
    // Implementation for Google Drive backup
    throw new Error('Google Drive backup not implemented yet');
  }
} 