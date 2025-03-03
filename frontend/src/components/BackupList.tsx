"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import { api } from '../lib/api';

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

  useEffect(() => {
    fetchBackups();
  }, []);

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
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const getStatusIcon = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusClass = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'in_progress':
        return 'status-in-progress';
      default:
        return 'status-pending';
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <XCircleIcon className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">No backups found</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead className="table-header">
          <tr>
            <th className="table-header-cell">Status</th>
            <th className="table-header-cell">Source</th>
            <th className="table-header-cell">Size</th>
            <th className="table-header-cell">Created</th>
          </tr>
        </thead>
        <tbody className="table-body">
          {backups.map((backup) => (
            <tr key={backup.id} className="table-row">
              <td className="table-cell">
                <div className="flex items-center">
                  {getStatusIcon(backup.status)}
                  <span className={`ml-2 ${getStatusClass(backup.status)}`}>
                    {backup.status.replace('_', ' ')}
                  </span>
                </div>
              </td>
              <td className="table-cell">{backup.sourcePath}</td>
              <td className="table-cell">{formatSize(backup.size)}</td>
              <td className="table-cell">
                {format(new Date(backup.createdAt), 'PPp')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 