import { Repository } from 'typeorm';
import { Schedule } from '../entities/Schedule';
import { BackupService } from './backup.service';
import { logger } from '../utils/logger';
import cron from 'node-cron';
import { AppDataSource } from '../data-source';

/**
 * Service to manage scheduled backup jobs using node-cron.
 * 
 * IMPORTANT TIME ZONE NOTE:
 * The cron jobs run based on the server's local time zone, not the user's time zone.
 * If the server is in a different time zone than the user, the scheduled times will
 * appear to be off by the time zone difference.
 * 
 * For example, if the user schedules a backup for 15:00 in their local time (UTC+2),
 * but the server is running in UTC, the backup will actually run at 13:00 UTC,
 * which is 15:00 in the user's time zone.
 */
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
    if (!schedule.cronExpression || schedule.cronExpression === '') {
      // Convert schedule format to cron expression
      const { daysOfWeek, timeOfDay } = schedule;
      const [hours, minutes] = timeOfDay.split(':').map(Number);
      const daysExpr = daysOfWeek.join(',');
      
      // Create cron expression - note that cron uses server's local time
      schedule.cronExpression = `${minutes} ${hours} * * ${daysExpr}`;
      
      // Log the scheduled time for debugging
      logger.info(`Schedule ${schedule.name} will run at ${timeOfDay} on days: ${daysExpr} (cron: ${schedule.cronExpression})`);
      
      // Save the updated cronExpression to the database
      this.scheduleRepository.update(schedule.id, { cronExpression: schedule.cronExpression })
        .catch(err => logger.error(`Failed to update cronExpression for schedule ${schedule.id}:`, err));
    }

    if (!cron.validate(schedule.cronExpression)) {
      logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    const job = cron.schedule(schedule.cronExpression, async () => {
      try {
        logger.info(`Starting scheduled backup for ${schedule.name} (scheduled time: ${schedule.timeOfDay})`);
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