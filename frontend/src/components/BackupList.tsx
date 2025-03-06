"use client";

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import { api } from '../lib/api';
import { backupEvents } from './CreateBackupButton';

interface Backup {
  id: string;
  sourcePath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  size: number;
  createdAt: string;
  errorMessage?: string;
}

export default function BackupList() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fetch backups immediately when component mounts
    fetchBackups();

    // Set up polling interval
    startPolling();

    // Listen for backup created events
    const removeListener = backupEvents.addBackupCreatedListener(() => {
      // When a new backup is created, fetch the updated list immediately
      fetchBackups();
      // And start polling more frequently
      startPolling();
    });

    // Clean up interval and event listener when component unmounts
    return () => {
      stopPolling();
      removeListener();
    };
  }, []);

  const startPolling = () => {
    // Poll every 5 seconds if there are in-progress backups, otherwise every 30 seconds
    const pollInterval = hasInProgressBackups() ? 5000 : 30000;
    
    // Clear any existing interval
    stopPolling();
    
    // Set new interval
    pollingIntervalRef.current = setInterval(() => {
      fetchBackups();
    }, pollInterval);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const hasInProgressBackups = () => {
    return backups.some(backup => backup.status === 'pending' || backup.status === 'in_progress');
  };

  // Update polling interval when backups change
  useEffect(() => {
    // If we have in-progress backups, poll more frequently
    if (hasInProgressBackups()) {
      startPolling();
    }
  }, [backups]);

  const fetchBackups = async () => {
    try {
      const data = await api.get('/backups');
      setBackups(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Für kleine Werte (B, KB) keine Dezimalstellen
    if (unitIndex <= 1) {
      return `${Math.round(size)} ${units[unitIndex]}`;
    }
    
    // Für MB und größer nur eine Dezimalstelle anzeigen
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getStatusIcon = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusClass = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full text-xs font-medium';
      case 'failed':
        return 'text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full text-xs font-medium';
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full text-xs font-medium';
      default:
        return 'text-yellow-600 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full text-xs font-medium';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
        <div className="flex">
          <XCircleIcon className="h-5 w-5 text-red-400 dark:text-red-300" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No backups found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                Source
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                Size
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {backups.map((backup) => (
              <tr 
                key={backup.id} 
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(backup.status)}
                    <span className={`ml-2 ${getStatusClass(backup.status)}`}>
                      {backup.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                  <div className="max-w-xs truncate">{backup.sourcePath}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                  {formatSize(backup.size)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                  {format(new Date(backup.createdAt), 'PPp')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 