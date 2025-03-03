import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import { Equal } from 'typeorm';

const router = Router();
const targetRepository = AppDataSource.getRepository(Target);

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
    const { name, type, path, config } = req.body;
    
    // Validate required fields
    if (!name || !type || !path) {
      return res.status(400).json({ error: 'Name, type, and path are required' });
    }
    
    // Create the target
    const target = new Target();
    target.name = name;
    target.type = type;
    target.path = path;
    
    // Set credentials based on type
    if (type === 'sftp') {
      target.credentials = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
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
    const { name, type, path, config } = req.body;
    
    // Validate required fields
    if (!name || !type || !path) {
      return res.status(400).json({ error: 'Name, type, and path are required' });
    }
    
    // Find the target
    const target = await targetRepository.findOneBy({ id: req.params.id });
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    // Update target properties
    target.name = name;
    target.type = type;
    target.path = path;
    
    // Update credentials based on type
    if (type === 'sftp') {
      target.credentials = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      };
    } else if (type === 'dropbox' || type === 'google_drive') {
      target.credentials = {
        accessToken: config.accessToken
      };
    } else {
      target.credentials = {};
    }
    
    // Save the updated target
    const result = await targetRepository.save(target);
    res.json(result);
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