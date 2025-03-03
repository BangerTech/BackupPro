"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Switch } from '@headlessui/react';
import { PencilIcon, TrashIcon, CalendarIcon, ClockIcon, FolderIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';

interface Schedule {
  id: string;
  name: string;
  sourcePath: string;
  cronExpression: string;
  isActive: boolean;
  daysOfWeek: number[];
  timeOfDay: string;
  createdAt: string;
  updatedAt: string;
}

export default function ScheduleList() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await api.get('/schedules');
      setSchedules(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      await api.put(`/schedules/${schedule.id}`, {
        ...schedule,
        isActive: !schedule.isActive,
      });

      setSchedules(schedules.map(s => 
        s.id === schedule.id ? { ...s, isActive: !s.isActive } : s
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/schedules/${id}`);
      setSchedules(schedules.filter(s => s.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDaysOfWeek = (days: number[]): string => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    return days.map(d => dayNames[d]).join(', ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
        <div className="flex">
          <ExclamationCircleIcon className="h-5 w-5 text-red-400 dark:text-red-500 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</div>
            <div className="mt-3">
              <button
                onClick={fetchSchedules}
                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-800/60"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
        <CalendarIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Backup Schedules</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          You haven't created any backup schedules yet. Create your first schedule to start automating your backups.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {schedule.name}
            </h3>
            <Switch
              checked={schedule.isActive}
              onChange={() => toggleSchedule(schedule)}
              className={`${
                schedule.isActive ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  schedule.isActive ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div className="flex items-start">
              <FolderIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-300 break-all">
                {schedule.sourcePath}
              </span>
            </div>
            <div className="flex items-start">
              <CalendarIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formatDaysOfWeek(schedule.daysOfWeek)}
              </span>
            </div>
            <div className="flex items-start">
              <ClockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {schedule.timeOfDay}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(schedule.createdAt).toLocaleDateString()}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 border-t dark:border-gray-700 pt-3">
            {deleteConfirmId === schedule.id ? (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-300 mr-2 self-center">
                  Are you sure?
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  onClick={() => deleteSchedule(schedule.id)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Confirm'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => {/* Implement edit */}}
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-md text-gray-400 hover:text-red-500"
                  onClick={() => setDeleteConfirmId(schedule.id)}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 