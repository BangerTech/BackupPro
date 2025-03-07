import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Target } from '../entities/Target';
import { Backup } from '../entities/Backup';
import { logger } from '../utils/logger';
import { Equal } from 'typeorm';

const router = Router();
const targetRepository = AppDataSource.getRepository(Target);
const backupRepository = AppDataSource.getRepository(Backup);

// Get all targets
router.get('/', async (req: Request, res: Response) => {
  try {
    const targets = await targetRepository.find({
      relations: ['backups'],
    });
    res.json(targets);
  } catch (error) {
    logger.error('Error fetching targets:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

// Get storage information
router.get('/storage', async (req: Request, res: Response) => {
  try {
    // Holen Sie alle Backups mit ihren Zielen
    const backups = await backupRepository.find({
      relations: ['target'],
    });

    // Gruppieren Sie Backups nach Zielpfad
    const storageMap = new Map();
    
    for (const backup of backups) {
      if (!backup.target) continue;
      
      const key = `${backup.target.type}:${backup.target.path}`;
      
      if (!storageMap.has(key)) {
        storageMap.set(key, {
          path: backup.target.path,
          type: backup.target.type,
          size: 0,
          backupCount: 0,
          lastBackup: null
        });
      }
      
      const storageInfo = storageMap.get(key);
      storageInfo.size += backup.size || 0;
      storageInfo.backupCount += 1;
      
      // Aktualisieren Sie das Datum des letzten Backups, wenn dieses Backup neuer ist
      const backupDate = new Date(backup.createdAt);
      if (!storageInfo.lastBackup || backupDate > new Date(storageInfo.lastBackup)) {
        storageInfo.lastBackup = backup.createdAt;
      }
    }
    
    // Konvertieren Sie die Map in ein Array
    const storageInfo = Array.from(storageMap.values());
    
    res.json(storageInfo);
  } catch (error) {
    logger.error('Error fetching storage information:', error);
    res.status(500).json({ error: 'Failed to fetch storage information' });
  }
});

// Get target by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const target = await targetRepository.findOne({
      where: { id: req.params.id },
      relations: ['backups'],
    });

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json(target);
  } catch (error) {
    logger.error('Error fetching target:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// Create target
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, path, config, icon, emoji } = req.body;
    
    // Validate required fields
    if (!name || !type || !path) {
      return res.status(400).json({ error: 'Name, type, and path are required' });
    }
    
    // Create the target
    const target = new Target();
    target.name = name;
    target.type = type;
    target.path = path;
    
    // Set icon if provided
    if (icon) {
      target.icon = icon;
    }
    
    // Set emoji if provided
    if (emoji) {
      target.emoji = emoji;
    }
    
    // Set credentials based on type
    if (type === 'sftp') {
      target.credentials = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      };
    } else if (type === 'smb') {
      target.credentials = {
        host: config.host,
        username: config.username,
        password: config.password,
        domain: config.domain,
        share: config.share
      };
    } else if (type === 'dropbox' || type === 'google_drive') {
      target.credentials = {
        accessToken: config.accessToken
      };
    }
    
    // Save the target
    const savedTarget = await targetRepository.save(target);
    res.status(201).json(savedTarget);
  } catch (error) {
    logger.error('Error creating target:', error);
    res.status(500).json({ error: 'Failed to create target' });
  }
});

// Update target
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, path, config, icon, emoji } = req.body;
    
    // Find the target
    const target = await targetRepository.findOne({ where: { id } });
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    // Update fields
    if (name) target.name = name;
    if (type) target.type = type;
    if (path) target.path = path;
    if (icon) target.icon = icon;
    if (emoji !== undefined) target.emoji = emoji;
    
    // Update credentials based on type
    if (type === 'sftp' && config) {
      target.credentials = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      };
    } else if (type === 'smb' && config) {
      target.credentials = {
        host: config.host,
        username: config.username,
        password: config.password,
        domain: config.domain,
        share: config.share
      };
    } else if ((type === 'dropbox' || type === 'google_drive') && config) {
      target.credentials = {
        accessToken: config.accessToken
      };
    }
    
    // Save the updated target
    const updatedTarget = await targetRepository.save(target);
    res.json(updatedTarget);
  } catch (error) {
    logger.error('Error updating target:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Delete target
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await targetRepository.delete({ id: req.params.id });
    if (result.affected === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting target:', error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

export { router as targetRoutes }; 