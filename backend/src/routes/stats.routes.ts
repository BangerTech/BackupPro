import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Backup } from "../entities/Backup";
import { Schedule } from "../entities/Schedule";
import { logger } from "../utils/logger";

const router = Router();
const backupRepository = AppDataSource.getRepository(Backup);
const scheduleRepository = AppDataSource.getRepository(Schedule);

// Get dashboard stats
router.get("/", async (req, res) => {
  try {
    // Get total backups
    const totalBackups = await backupRepository.count();

    // Get active schedules
    const activeSchedules = await scheduleRepository.count({
      where: { isActive: true },
    });

    // Calculate total storage
    const backups = await backupRepository.find({
      where: { status: "completed" },
    });
    const totalStorage = backups.reduce((sum, backup) => sum + backup.size, 0);

    // Calculate success rate
    const completedBackups = await backupRepository.count({
      where: { status: "completed" },
    });
    const failedBackups = await backupRepository.count({
      where: { status: "failed" },
    });
    const totalAttempts = completedBackups + failedBackups;
    const successRate = totalAttempts > 0
      ? (completedBackups / totalAttempts) * 100
      : 100;

    res.json({
      totalBackups,
      activeSchedules,
      totalStorage,
      successRate,
    });
  } catch (error) {
    logger.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export { router as statsRoutes }; 