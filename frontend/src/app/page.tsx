import { Suspense } from 'react';
import BackupList from '@/components/BackupList';
import ScheduleList from '@/components/ScheduleList';
import CreateBackupButton from '@/components/CreateBackupButton';
import DashboardStats from '@/components/DashboardStats';

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your backup schedules and monitor backup status
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <CreateBackupButton />
        </div>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Recent Backups</h2>
          </div>
          <div className="card-content">
            <Suspense fallback={<div>Loading backups...</div>}>
              <BackupList />
            </Suspense>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Backup Schedules</h2>
          </div>
          <div className="card-content">
            <Suspense fallback={<div>Loading schedules...</div>}>
              <ScheduleList />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
} 