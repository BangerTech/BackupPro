import { Repository } from 'typeorm';
import { Schedule } from '../entities/Schedule';
import { BackupService } from './backup.service';
import { logger } from '../utils/logger';
import cron from 'node-cron';
import { AppDataSource } from '../data-source';

class CronService {
  private scheduleRepository: Repository<Schedule>;
  private backupService: BackupService;
  private jobs: Map<string, cron.ScheduledTask>;

  constructor() {
    this.scheduleRepository = AppDataSource.getRepository(Schedule);
    this.backupService = new BackupService();
    this.jobs = new Map();
  }

  async setupCronJobs(): Promise<void> {
    try {
      // Clear existing jobs
      this.jobs.forEach(job => job.stop());
      this.jobs.clear();

      // Get all active schedules
      const schedules = await this.scheduleRepository.find({ where: { isActive: true } });

      // Setup new jobs
      schedules.forEach(schedule => {
        this.setupJob(schedule);
      });

      logger.info(`Setup ${schedules.length} cron jobs`);
    } catch (error) {
      logger.error('Failed to setup cron jobs:', error);
      throw error;
    }
  }

  private setupJob(schedule: Schedule): void {
    if (!schedule.cronExpression) {
      // Convert schedule format to cron expression
      const { daysOfWeek, timeOfDay } = schedule;
      const [hours, minutes] = timeOfDay.split(':');
      const daysExpr = daysOfWeek.join(',');
      schedule.cronExpression = `${minutes} ${hours} * * ${daysExpr}`;
    }

    if (!cron.validate(schedule.cronExpression)) {
      logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    const job = cron.schedule(schedule.cronExpression, async () => {
      try {
        logger.info(`Starting scheduled backup for ${schedule.name}`);
        await this.backupService.createBackup(schedule.id);
        logger.info(`Completed scheduled backup for ${schedule.name}`);
      } catch (error) {
        logger.error(`Failed scheduled backup for ${schedule.name}:`, error);
      }
    });

    this.jobs.set(schedule.id, job);
    logger.info(`Scheduled backup job created for schedule ${schedule.id}: ${schedule.cronExpression}`);
  }

  async updateJob(schedule: Schedule): Promise<void> {
    // Stop existing job if it exists
    const existingJob = this.jobs.get(schedule.id);
    if (existingJob) {
      existingJob.stop();
      this.jobs.delete(schedule.id);
    }

    // Setup new job if schedule is active
    if (schedule.isActive) {
      this.setupJob(schedule);
    }
  }

  async stopJob(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
    }
  }
}

export const cronService = new CronService();
export const setupCronJobs = () => cronService.setupCronJobs(); 