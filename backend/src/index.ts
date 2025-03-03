import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';
import { logger } from './utils/logger';
import { scheduleRoutes } from './routes/schedule.routes';
import { targetRoutes } from './routes/target.routes';
import { backupRoutes } from './routes/backup.routes';
import { statsRoutes } from './routes/stats.routes';
import { oauthRoutes } from './routes/oauth.routes';
import { setupCronJobs } from './services/cron.service';
import filesystemRoutes from './routes/filesystem';
import targetsRouter from './routes/targets';
import { db, runMigrations } from './db';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Middleware
app.use(cors());
app.use(express.json());

// Routes - using the original routes
app.use('/api/backups', backupRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/stats', statsRoutes);

// New routes
app.use('/api/filesystem', filesystemRoutes);
app.use('/api/targets-new', targetsRouter); // Using a different path to avoid conflicts
app.use('/api/oauth', oauthRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize the server
const startServer = async () => {
  try {
    // Initialize TypeORM connection
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    // Run additional migrations
    await runMigrations();
    
    // Setup cron jobs after database connection
    setupCronJobs();
    
    // Start the server
    app.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 