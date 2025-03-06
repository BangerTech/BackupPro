import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Schedule } from '../entities/Schedule';
import { Target } from '../entities/Target';
import { Backup } from '../entities/Backup';
import { logger } from '../utils/logger';
import { Equal } from 'typeorm';
import { cronService } from '../services/cron.service';

const router = Router();
const scheduleRepository = AppDataSource.getRepository(Schedule);
const targetRepository = AppDataSource.getRepository(Target);
const backupRepository = AppDataSource.getRepository(Backup);

// Get all schedules
router.get('/', async (req: Request, res: Response) => {
  try {
    const schedules = await scheduleRepository.find({
      relations: ['backups', 'backups.target', 'target'],
    });
    res.json(schedules);
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get active schedules
router.get('/active', async (req: Request, res: Response) => {
  try {
    const schedules = await scheduleRepository.find({
      where: { isActive: true },
      relations: ['backups', 'backups.target', 'target'],
    });
    res.json(schedules);
  } catch (error) {
    logger.error('Error fetching active schedules:', error);
    res.status(500).json({ error: 'Failed to fetch active schedules' });
  }
});

// Create schedule
router.post('/', async (req: Request, res: Response) => {
  try {
    logger.info('Creating new schedule with data:', { ...req.body, password: req.body.password ? '[REDACTED]' : undefined });
    const { targetId, ...scheduleData } = req.body;
    
    // Validate required fields
    if (!scheduleData.name || !scheduleData.sourcePath || !scheduleData.daysOfWeek || !scheduleData.timeOfDay || !targetId) {
      logger.warn('Missing required fields for schedule creation:', { 
        name: !!scheduleData.name, 
        sourcePath: !!scheduleData.sourcePath, 
        daysOfWeek: !!scheduleData.daysOfWeek, 
        timeOfDay: !!scheduleData.timeOfDay, 
        targetId: !!targetId 
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find the target
    const target = await targetRepository.findOneBy({ id: targetId });
    if (!target) {
      logger.warn(`Target with ID ${targetId} not found`);
      return res.status(404).json({ error: 'Target not found' });
    }
    
    // Create the schedule
    const schedule = new Schedule();
    schedule.name = scheduleData.name;
    schedule.sourcePath = scheduleData.sourcePath;
    schedule.daysOfWeek = scheduleData.daysOfWeek;
    schedule.timeOfDay = scheduleData.timeOfDay;
    schedule.isActive = scheduleData.isActive !== undefined ? scheduleData.isActive : true;
    schedule.target = target;
    
    // Save the schedule
    const savedSchedule = await scheduleRepository.save(schedule);
    logger.info(`Schedule created successfully with ID: ${savedSchedule.id}`, { 
      name: savedSchedule.name,
      isActive: savedSchedule.isActive,
      daysOfWeek: savedSchedule.daysOfWeek,
      timeOfDay: savedSchedule.timeOfDay
    });
    
    // Update cron jobs to include the new schedule
    try {
      await cronService.updateJob(savedSchedule);
      logger.info(`Cron job updated for schedule ${savedSchedule.id}`);
    } catch (cronError) {
      logger.error(`Failed to update cron job for schedule ${savedSchedule.id}:`, cronError);
      // We don't want to fail the request if cron job update fails
    }
    
    res.status(201).json(savedSchedule);
  } catch (error) {
    logger.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { targetId, ...scheduleData } = req.body;
    
    const schedule = await scheduleRepository.findOne({
      where: { id: req.params.id },
      relations: ['target']
    });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // Update target if provided
    if (targetId) {
      const target = await targetRepository.findOneBy({ id: targetId });
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }
      schedule.target = target;
    }
    
    // Update schedule properties
    if (scheduleData.name) schedule.name = scheduleData.name;
    if (scheduleData.sourcePath) schedule.sourcePath = scheduleData.sourcePath;
    if (scheduleData.daysOfWeek) schedule.daysOfWeek = scheduleData.daysOfWeek;
    if (scheduleData.timeOfDay) schedule.timeOfDay = scheduleData.timeOfDay;
    if (scheduleData.isActive !== undefined) schedule.isActive = scheduleData.isActive;
    
    // Clear cronExpression if days or time changed to force recalculation
    if (scheduleData.daysOfWeek || scheduleData.timeOfDay) {
      schedule.cronExpression = '';
    }
    
    // Save the updated schedule
    const result = await scheduleRepository.save(schedule);
    
    // Update cron job
    try {
      await cronService.updateJob(result);
      logger.info(`Cron job updated for schedule ${result.id}`);
    } catch (cronError) {
      logger.error(`Failed to update cron job for schedule ${result.id}:`, cronError);
      // We don't want to fail the request if cron job update fails
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // First, stop the cron job
    try {
      await cronService.stopJob(req.params.id);
      logger.info(`Stopped cron job for schedule ${req.params.id}`);
    } catch (cronError) {
      logger.error(`Failed to stop cron job for schedule ${req.params.id}:`, cronError);
      // Continue with deletion even if stopping the cron job fails
    }
    
    // Find the schedule with its backups
    const schedule = await scheduleRepository.findOne({
      where: { id: req.params.id },
      relations: ['backups']
    });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // Delete all backups associated with this schedule
    if (schedule.backups && schedule.backups.length > 0) {
      logger.info(`Deleting ${schedule.backups.length} backups associated with schedule ${req.params.id}`);
      
      // Delete each backup
      for (const backup of schedule.backups) {
        await backupRepository.delete({ id: backup.id });
      }
    }
    
    // Now delete the schedule
    const result = await scheduleRepository.delete({ id: req.params.id });
    
    if (result.affected === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export { router as scheduleRoutes }; 