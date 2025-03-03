import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Schedule } from './Schedule';
import { Target } from './Target';

@Entity()
export class Backup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourcePath: string;

  @Column()
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  @Column({ nullable: true })
  errorMessage?: string;

  @Column()
  size: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Schedule, schedule => schedule.backups)
  schedule: Schedule;

  @ManyToOne(() => Target, target => target.backups)
  target: Target;
} 