import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Backup } from '../entities/Backup';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import { Equal } from 'typeorm';
import { BackupService } from '../services/backup.service';

const router = Router();
const backupRepository = AppDataSource.getRepository(Backup);
const targetRepository = AppDataSource.getRepository(Target);
const backupService = new BackupService();

// Get all backups
router.get('/', async (req: Request, res: Response) => {
  try {
    const backups = await backupRepository.find({
      relations: ['schedule', 'target'],
      order: { createdAt: 'DESC' },
    });
    res.json(backups);
  } catch (error) {
    logger.error('Error fetching backups:', error);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

// Get backup by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const backup = await backupRepository.findOne({
      where: { id: req.params.id },
      relations: ['schedule', 'target'],
    });

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.json(backup);
  } catch (error) {
    logger.error('Error fetching backup:', error);
    res.status(500).json({ error: 'Failed to fetch backup' });
  }
});

// Create backup
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sourcePath, targetId } = req.body;
    
    // Validate required fields
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path is required' });
    }
    
    if (!targetId) {
      return res.status(400).json({ error: 'Target ID is required' });
    }
    
    // Find the target
    const target = await targetRepository.findOne({
      where: { id: targetId }
    });
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    // Create the backup
    const backup = backupRepository.create({
      sourcePath,
      target,
      status: 'pending',
      size: 0,
    });
    
    await backupRepository.save(backup);
    
    // Return the created backup with its target
    const savedBackup = await backupRepository.findOne({
      where: { id: backup.id },
      relations: ['target'],
    });
    
    // Start the backup process in the background
    // We don't await this to avoid blocking the response
    backupService.performManualBackup(backup.id).catch(err => {
      logger.error('Error performing backup:', err);
    });
    
    res.status(201).json(savedBackup);
  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Update backup status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, errorMessage } = req.body;
    const backup = await backupRepository.findOneBy({ id: req.params.id });
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    backup.status = status;
    if (errorMessage) {
      backup.errorMessage = errorMessage;
    }

    const result = await backupRepository.save(backup);
    res.json(result);
  } catch (error) {
    logger.error('Error updating backup status:', error);
    res.status(500).json({ error: 'Failed to update backup status' });
  }
});

export { router as backupRoutes };