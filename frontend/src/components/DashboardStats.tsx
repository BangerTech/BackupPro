"use client";

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  ServerIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';

interface Stats {
  totalBackups: number;
  activeSchedules: number;
  totalStorage: number;
  successRate: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    totalBackups: 0,
    activeSchedules: 0,
    totalStorage: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.get('/api/stats');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatStorage = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Backups
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.totalBackups}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Active Schedules
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.activeSchedules}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ServerIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Storage
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatStorage(stats.totalStorage)}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Success Rate
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.successRate.toFixed(1)}%
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 