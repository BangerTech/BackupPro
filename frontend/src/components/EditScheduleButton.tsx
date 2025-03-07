"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { CalendarIcon, ClockIcon, FolderIcon, ServerIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import FileExplorer from './FileExplorer';

interface Target {
  id: string;
  name: string;
  type: 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive';
}

interface Schedule {
  id: string;
  name: string;
  sourcePath: string;
  targetId?: string;
  target?: Target;
  daysOfWeek: number[];
  timeOfDay: string;
  isActive: boolean;
}

interface EditScheduleButtonProps {
  schedule: Schedule;
  onScheduleUpdated?: () => void;
}

export default function EditScheduleButton({ schedule, onScheduleUpdated }: EditScheduleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(schedule.name);
  const [sourcePath, setSourcePath] = useState(schedule.sourcePath);
  const [targetId, setTargetId] = useState(schedule.targetId || (schedule.target?.id || ''));
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(schedule.daysOfWeek);
  const [timeOfDay, setTimeOfDay] = useState(schedule.timeOfDay);
  const [isActive, setIsActive] = useState(schedule.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchTargets();
    }
  }, [isOpen]);

  // Reset form values when schedule prop changes
  useEffect(() => {
    setName(schedule.name);
    setSourcePath(schedule.sourcePath);
    setTargetId(schedule.targetId || (schedule.target?.id || ''));
    setDaysOfWeek(schedule.daysOfWeek);
    setTimeOfDay(schedule.timeOfDay);
    setIsActive(schedule.isActive);
  }, [schedule]);

  const fetchTargets = async () => {
    try {
      setLoadingTargets(true);
      const data = await api.get('/targets');
      setTargets(data);
      
      // If we have targets and none is selected, select the first one
      if (data.length > 0 && !targetId) {
        setTargetId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch targets:', err);
      setError('Failed to load backup targets. Please try again.');
    } finally {
      setLoadingTargets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !sourcePath || daysOfWeek.length === 0 || !timeOfDay || !targetId) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.put(`/schedules/${schedule.id}`, {
        name,
        sourcePath,
        targetId,
        daysOfWeek,
        timeOfDay,
        isActive,
      });
      
      setIsOpen(false);
      
      if (onScheduleUpdated) {
        onScheduleUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSelectAllDays = () => {
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSelectWeekdays = () => {
    setDaysOfWeek([1, 2, 3, 4, 5]);
  };

  const handleSelectWeekends = () => {
    setDaysOfWeek([0, 6]);
  };

  const handleFileSelect = (path: string) => {
    setSourcePath(path);
    setShowFileExplorer(false);
  };

  const getTargetTypeIcon = (type: Target['type']) => {
    switch (type) {
      case 'local':
        return '💻';
      case 'sftp':
        return '🔒';
      case 'smb':
        return '🔌';
      case 'dropbox':
        return '📦';
      case 'google_drive':
        return '📁';
      default:
        return '📄';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
      >
        <span className="sr-only">Edit Schedule</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Edit Backup Schedule
            </Dialog.Title>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="Daily Backup"
                    required
                  />
                </div>
                
                {/* Source Path */}
                <div>
                  <label htmlFor="sourcePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Source Directory
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      id="sourcePath"
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      className="block w-full rounded-l-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="/path/to/backup"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowFileExplorer(!showFileExplorer)}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500"
                    >
                      <FolderIcon className="h-5 w-5" />
                      <span className="sr-only">Browse</span>
                    </button>
                  </div>
                  
                  {showFileExplorer && (
                    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <FileExplorer 
                        onSelect={handleFileSelect}
                        initialPath="/"
                        showFiles={true}
                      />
                    </div>
                  )}
                </div>
                
                {/* Target Selection */}
                <div>
                  <label htmlFor="targetId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <ServerIcon className="h-5 w-5 inline mr-1" />
                    Backup Target
                  </label>
                  
                  {loadingTargets ? (
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                      Loading targets...
                    </div>
                  ) : targets.length > 0 ? (
                    <select
                      id="targetId"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a target</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {getTargetTypeIcon(target.type)} {target.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 flex flex-col">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        No backup targets available. Please create a target first.
                      </div>
                      <button
                        type="button"
                        onClick={() => window.location.href = '/targets'}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                      >
                        <ServerIcon className="-ml-0.5 mr-2 h-4 w-4" />
                        Manage Targets
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Active Status */}
                <div>
                  <div className="flex items-center">
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Active
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    When active, this schedule will automatically run backups at the specified time.
                  </p>
                </div>
                
                {/* Days of Week */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <CalendarIcon className="h-5 w-5 inline mr-1" />
                    Days of Week
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={handleSelectAllDays}
                      className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      All Days
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWeekdays}
                      className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWeekends}
                      className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      Weekends
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`px-3 py-2 rounded-md text-sm ${
                          daysOfWeek.includes(day.value)
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {day.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Time of Day */}
                <div>
                  <label htmlFor="timeOfDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <ClockIcon className="h-5 w-5 inline mr-1" />
                    Time of Day
                  </label>
                  <input
                    type="time"
                    id="timeOfDay"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || targets.length === 0}
                  className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 