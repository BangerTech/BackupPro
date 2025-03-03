import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Schedule } from '../entities/Schedule';
import { Target } from '../entities/Target';
import { logger } from '../utils/logger';
import { Equal } from 'typeorm';

const router = Router();
const scheduleRepository = AppDataSource.getRepository(Schedule);
const targetRepository = AppDataSource.getRepository(Target);

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
    const { targetId, ...scheduleData } = req.body;
    
    // Validate required fields
    if (!scheduleData.name || !scheduleData.sourcePath || !scheduleData.daysOfWeek || !scheduleData.timeOfDay || !targetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find the target
    const target = await targetRepository.findOneBy({ id: targetId });
    if (!target) {
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
    
    // Save the updated schedule
    const result = await scheduleRepository.save(schedule);
    res.json(result);
  } catch (error) {
    logger.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', async (req: Request, res: Response) => {
  try {
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