import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Backup } from './Backup';
import { Target } from './Target';

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  sourcePath: string;

  @Column('int', { array: true })
  daysOfWeek: number[];

  @Column()
  timeOfDay: string;

  @Column({ nullable: true })
  cronExpression: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Target, target => target.schedules, { nullable: false })
  target: Target;

  @OneToMany(() => Backup, backup => backup.schedule)
  backups: Backup[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 