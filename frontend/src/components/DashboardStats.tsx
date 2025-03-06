"use client";

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  ServerIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';

interface Stats {
  totalBackups: number;
  activeSchedules: number;
  totalStorage: number;
  successRate: number;
}

interface Backup {
  id: string;
  sourcePath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  size: number;
  createdAt: string;
  errorMessage?: string;
}

interface Schedule {
  id: string;
  name: string;
  sourcePath: string;
  targetPath?: string;
  cronExpression: string;
  isActive: boolean;
  daysOfWeek: number[];
  timeOfDay: string;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

interface StorageInfo {
  path: string;
  size: number;
  backupCount: number;
  lastBackup?: string;
}

interface BackupDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StorageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SuccessRateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function BackupDetailModal({ isOpen, onClose }: BackupDetailModalProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);
  
  const fetchBackups = async () => {
    try {
      setLoading(true);
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

    if (unitIndex <= 1) {
      return `${Math.round(size)} ${units[unitIndex]}`;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
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
  
  const filteredBackups = statusFilter === 'all' 
    ? backups 
    : backups.filter((backup: Backup) => backup.status === statusFilter);
  
  const statusCounts = {
    completed: backups.filter((b: Backup) => b.status === 'completed').length,
    failed: backups.filter((b: Backup) => b.status === 'failed').length,
    in_progress: backups.filter((b: Backup) => b.status === 'in_progress').length,
    pending: backups.filter((b: Backup) => b.status === 'pending').length
  };
  
  const totalSize = backups.reduce((sum: number, backup: Backup) => sum + backup.size, 0);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-300 mr-2" />
            Backup Details
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300">Total Backups</h3>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{backups.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-300">Completed</h3>
              <p className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-200">{statusCounts.completed}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-300">Failed</h3>
              <p className="text-xl sm:text-2xl font-bold text-red-900 dark:text-red-200">{statusCounts.failed}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-300">Total Size</h3>
              <p className="text-xl sm:text-2xl font-bold text-purple-900 dark:text-purple-200">{formatSize(totalSize)}</p>
            </div>
          </div>
          
          {/* Filter Controls - Scrollable on mobile */}
          <div className="flex overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:gap-2">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                statusFilter === 'all' 
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setStatusFilter('completed')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                statusFilter === 'completed' 
                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
              }`}
            >
              Completed ({statusCounts.completed})
            </button>
            <button 
              onClick={() => setStatusFilter('failed')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                statusFilter === 'failed' 
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
              }`}
            >
              Failed ({statusCounts.failed})
            </button>
            <button 
              onClick={() => setStatusFilter('in_progress')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                statusFilter === 'in_progress' 
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
              }`}
            >
              In Progress ({statusCounts.in_progress})
            </button>
            <button 
              onClick={() => setStatusFilter('pending')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                statusFilter === 'pending' 
                  ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' 
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300'
              }`}
            >
              Pending ({statusCounts.pending})
            </button>
          </div>
          
          {/* Backup List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              </div>
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No backups found with the selected filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Source
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Size
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBackups.map((backup) => (
                    <tr 
                      key={backup.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={getStatusClass(backup.status)}>
                          {backup.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-[100px] sm:max-w-xs truncate">{backup.sourcePath}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatSize(backup.size)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatDate(backup.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleDetailModal({ isOpen, onClose }: ScheduleDetailModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
    }
  }, [isOpen]);
  
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await api.get('/schedules');
      
      // Ensure data is properly formatted
      const formattedSchedules = data.map((schedule: any) => ({
        ...schedule,
        // Make sure we have the correct field names
        isActive: schedule.isActive !== undefined ? schedule.isActive : (schedule.enabled !== undefined ? schedule.enabled : true),
        // Ensure daysOfWeek is an array
        daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [],
        // Ensure timeOfDay exists
        timeOfDay: schedule.timeOfDay || '00:00'
      }));
      
      setSchedules(formattedSchedules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const getNextRunTime = (cronExpression: string): string => {
    // This is a placeholder. In a real app, you would use a library like cron-parser
    // to calculate the next run time based on the cron expression.
    return 'Next scheduled run time';
  };
  
  const filteredSchedules = statusFilter === 'all' 
    ? schedules 
    : schedules.filter((schedule: Schedule) => statusFilter === 'active' ? schedule.isActive : !schedule.isActive);
  
  // Helper function to generate calendar days
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get the first day of the month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startingDayOfWeek = firstDay.getDay();
    
    // Get the last day of the month
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get the last day of the previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    const days = [];
    
    // Add days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        schedules: []
      });
    }
    
    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      const isToday = i === today.getDate();
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday, ...
      
      // Find schedules for this day based on daysOfWeek
      const daySchedules = schedules.filter((schedule: Schedule) => {
        // Only consider active schedules
        if (!schedule.isActive) return false;
        
        // Check if this day of week is in the schedule's daysOfWeek array
        return schedule.daysOfWeek.includes(dayOfWeek);
      });
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        schedules: daySchedules
      });
    }
    
    // Add days from next month to complete the grid (6 rows x 7 columns = 42 cells)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      const dayOfWeek = date.getDay();
      
      // Find schedules for next month days too
      const daySchedules = schedules.filter((schedule: Schedule) => {
        if (!schedule.isActive) return false;
        return schedule.daysOfWeek.includes(dayOfWeek);
      });
      
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        schedules: daySchedules
      });
    }
    
    return days;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-300 mr-2" />
            Schedule Details
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-3 sm:p-4 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 sm:p-3 rounded-lg">
              <h3 className="text-xs font-medium text-purple-800 dark:text-purple-300">Total Schedules</h3>
              <p className="text-lg sm:text-xl font-bold text-purple-900 dark:text-purple-200">{schedules.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-lg">
              <h3 className="text-xs font-medium text-green-800 dark:text-green-300">Active Schedules</h3>
              <p className="text-lg sm:text-xl font-bold text-green-900 dark:text-green-200">
                {schedules.filter(s => s.isActive).length}
              </p>
            </div>
          </div>
          
          {/* Filter Controls - Scrollable on mobile */}
          <div className="flex overflow-x-auto pb-2 mb-3 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:gap-2">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-2 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'all' 
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setStatusFilter('active')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-2 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'active' 
                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
              }`}
            >
              Active ({schedules.filter(s => s.isActive).length})
            </button>
            <button 
              onClick={() => setStatusFilter('inactive')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-2 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'inactive' 
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
              }`}
            >
              Inactive ({schedules.filter(s => !s.isActive).length})
            </button>
          </div>
          
          {/* Calendar View */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Schedule Calendar</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-7 gap-px border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
                {generateCalendarDays().map((day, index) => (
                  <div 
                    key={index}
                    className={`min-h-[80px] p-2 bg-white dark:bg-gray-800 ${
                      day.isCurrentMonth ? '' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500'
                    } ${day.isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="font-medium text-xs mb-1">
                      {day.date.getDate()}
                      {day.isToday && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          Today
                        </span>
                      )}
                    </div>
                    
                    {day.schedules.map((schedule: Schedule) => (
                      <div 
                        key={schedule.id}
                        className={`text-xs p-1 mb-1 rounded truncate ${
                          schedule.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                        title={schedule.name}
                      >
                        {schedule.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Schedule List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              </div>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No schedules found with the selected filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Next Run
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSchedules.map((schedule) => (
                    <tr 
                      key={schedule.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">
                        {schedule.name}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          schedule.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300' 
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                        }`}>
                          {schedule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                          {schedule.cronExpression || formatScheduleDays(schedule)}
                        </code>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatDate(schedule.lastRun)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {schedule.isActive ? formatDate(schedule.nextRun) : 'Disabled'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StorageDetailModal({ isOpen, onClose }: StorageDetailModalProps) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      fetchStorageInfo();
    }
  }, [isOpen]);
  
  const fetchStorageInfo = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/storage');
      setStorageInfo(data);
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

    if (unitIndex <= 1) {
      return `${Math.round(size)} ${units[unitIndex]}`;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const totalSize = storageInfo.reduce((sum: number, info: StorageInfo) => sum + info.size, 0);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <ServerIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-300 mr-2" />
            Storage Details
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-300">Total Storage</h3>
              <p className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-200">{formatSize(totalSize)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300">Backup Locations</h3>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{storageInfo.length}</p>
            </div>
          </div>
          
          {/* Storage List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              </div>
            </div>
          ) : storageInfo.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No storage information available</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Location
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Size
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Backups
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Last Backup
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {storageInfo.map((info: StorageInfo, index: number) => (
                    <tr 
                      key={index} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-[100px] sm:max-w-xs truncate">{info.path}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatSize(info.size)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {info.backupCount}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatDate(info.lastBackup)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessRateModal({ isOpen, onClose }: SuccessRateModalProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('all');
  
  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);
  
  const fetchBackups = async () => {
    try {
      setLoading(true);
      const data = await api.get('/backups');
      setBackups(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
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

    if (unitIndex <= 1) {
      return `${Math.round(size)} ${units[unitIndex]}`;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  const getFilteredBackups = () => {
    if (timeRange === 'all') return backups;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case 'day':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      default:
        return backups;
    }
    
    return backups.filter((backup: Backup) => new Date(backup.createdAt) >= cutoffDate);
  };
  
  const filteredBackups = getFilteredBackups();
  const completedBackups = filteredBackups.filter((b: Backup) => b.status === 'completed');
  const failedBackups = filteredBackups.filter((b: Backup) => b.status === 'failed');
  const successRate = filteredBackups.length > 0 
    ? (completedBackups.length / filteredBackups.length) * 100 
    : 0;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-300 mr-2" />
            Success Rate Details
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300">Success Rate</h3>
              <p className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-200">{successRate.toFixed(1)}%</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300">Total Backups</h3>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{filteredBackups.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-300">Successful</h3>
              <p className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-200">{completedBackups.length}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-300">Failed</h3>
              <p className="text-xl sm:text-2xl font-bold text-red-900 dark:text-red-200">{failedBackups.length}</p>
            </div>
          </div>
          
          {/* Filter Controls - Scrollable on mobile */}
          <div className="flex overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:gap-2">
            <button 
              onClick={() => setTimeRange('all')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                timeRange === 'all' 
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              All Time
            </button>
            <button 
              onClick={() => setTimeRange('month')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                timeRange === 'month' 
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
              }`}
            >
              Last Month
            </button>
            <button 
              onClick={() => setTimeRange('week')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                timeRange === 'week' 
                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
              }`}
            >
              Last Week
            </button>
            <button 
              onClick={() => setTimeRange('day')}
              className={`flex-shrink-0 mr-2 sm:mr-0 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                timeRange === 'day' 
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' 
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
              }`}
            >
              Last 24 Hours
            </button>
          </div>
          
          {/* Successful Backups List */}
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">Recent Successful Backups</h3>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              </div>
            </div>
          ) : completedBackups.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No successful backups in the selected time range</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Source
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {completedBackups.slice(0, 5).map((backup) => (
                    <tr 
                      key={backup.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-[100px] sm:max-w-xs truncate">{backup.sourcePath}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatDate(backup.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatSize(backup.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Failed Backups List */}
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">Recent Failed Backups</h3>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              </div>
            </div>
          ) : failedBackups.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No failed backups in the selected time range</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Source
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {failedBackups.slice(0, 5).map((backup) => (
                    <tr 
                      key={backup.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-[100px] sm:max-w-xs truncate">{backup.sourcePath}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                        {formatDate(backup.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-red-600 dark:text-red-300">
                        {backup.errorMessage || 'Unknown error'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to format days of week
const formatScheduleDays = (schedule: Schedule): string => {
  if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
    return 'No days selected';
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (schedule.daysOfWeek.length === 7) {
    return `Every day at ${schedule.timeOfDay || 'scheduled time'}`;
  }
  
  if (schedule.daysOfWeek.length === 5 && 
      !schedule.daysOfWeek.includes(0) && 
      !schedule.daysOfWeek.includes(6)) {
    return `Weekdays at ${schedule.timeOfDay || 'scheduled time'}`;
  }
  
  if (schedule.daysOfWeek.length === 2 && 
      schedule.daysOfWeek.includes(0) && 
      schedule.daysOfWeek.includes(6)) {
    return `Weekends at ${schedule.timeOfDay || 'scheduled time'}`;
  }
  
  // Sort the days of week for consistent display
  const sortedDays = [...schedule.daysOfWeek].sort((a, b) => a - b);
  const days = sortedDays.map(d => dayNames[d]).join(', ');
  return `${days} at ${schedule.timeOfDay || 'scheduled time'}`;
};

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    totalBackups: 0,
    activeSchedules: 0,
    totalStorage: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showSuccessRateModal, setShowSuccessRateModal] = useState(false);

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
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Backups Card */}
        <div 
          className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md dark:hover:bg-gray-700 cursor-pointer"
          onClick={() => setShowBackupModal(true)}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 p-2 sm:p-3 rounded-full">
                <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-4 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
                    Total Backups
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {stats.totalBackups}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Schedules Card */}
        <div 
          className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md dark:hover:bg-gray-700 cursor-pointer"
          onClick={() => setShowScheduleModal(true)}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 p-2 sm:p-3 rounded-full">
                <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-4 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
                    Active Schedules
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {stats.activeSchedules}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Storage Card */}
        <div 
          className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md dark:hover:bg-gray-700 cursor-pointer"
          onClick={() => setShowStorageModal(true)}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/30 p-2 sm:p-3 rounded-full">
                <ServerIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="ml-4 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
                    Total Storage
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatStorage(stats.totalStorage)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Success Rate Card */}
        <div 
          className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md dark:hover:bg-gray-700 cursor-pointer"
          onClick={() => setShowSuccessRateModal(true)}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 p-2 sm:p-3 rounded-full">
                <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="ml-4 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
                    Success Rate
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {stats.successRate.toFixed(1)}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Backup Detail Modal */}
      {showBackupModal && (
        <BackupDetailModal 
          isOpen={showBackupModal} 
          onClose={() => setShowBackupModal(false)} 
        />
      )}
      
      {/* Schedule Detail Modal */}
      {showScheduleModal && (
        <ScheduleDetailModal 
          isOpen={showScheduleModal} 
          onClose={() => setShowScheduleModal(false)} 
        />
      )}
      
      {/* Storage Detail Modal */}
      {showStorageModal && (
        <StorageDetailModal 
          isOpen={showStorageModal} 
          onClose={() => setShowStorageModal(false)} 
        />
      )}
      
      {/* Success Rate Modal */}
      {showSuccessRateModal && (
        <SuccessRateModal 
          isOpen={showSuccessRateModal} 
          onClose={() => setShowSuccessRateModal(false)} 
        />
      )}
    </>
  );
} 