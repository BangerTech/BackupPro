import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Schedule } from '../entities/Schedule';

export class ScheduleService {
    private scheduleRepository: Repository<Schedule>;

    constructor() {
        this.scheduleRepository = AppDataSource.getRepository(Schedule);
    }

    // ... rest of the service methods
} 