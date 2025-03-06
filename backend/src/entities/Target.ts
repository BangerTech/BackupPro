import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Backup } from './Backup';
import { Schedule } from './Schedule';

@Entity()
export class Target {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive';

  @Column()
  path: string;

  @Column({ type: 'json', nullable: true })
  credentials: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string;
    accessToken?: string;
    domain?: string;
    share?: string;
  };

  @OneToMany(() => Backup, (backup: Backup) => backup.target)
  backups: Backup[];

  @OneToMany(() => Schedule, (schedule: Schedule) => schedule.target)
  schedules: Schedule[];
  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 