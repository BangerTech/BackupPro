import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Target } from '../entities/Target';

export class TargetService {
    private targetRepository: Repository<Target>;

    constructor() {
        this.targetRepository = AppDataSource.getRepository(Target);
    }

    // ... rest of the service methods
} 