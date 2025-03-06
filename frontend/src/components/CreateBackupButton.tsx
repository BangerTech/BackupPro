"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';
import FileExplorer from './FileExplorer';
import { useRouter } from 'next/navigation';

// Event emitter für Kommunikation zwischen Komponenten
export const backupEvents = {
  // Callback-Funktionen für Backup-Ereignisse
  onBackupCreated: new Set<() => void>(),
  
  // Methode zum Hinzufügen eines Listeners
  addBackupCreatedListener: (callback: () => void) => {
    backupEvents.onBackupCreated.add(callback);
    return () => backupEvents.onBackupCreated.delete(callback);
  },
  
  // Methode zum Auslösen des Events
  emitBackupCreated: () => {
    backupEvents.onBackupCreated.forEach(callback => callback());
  }
};

interface Target {
  id: string;
  name: string;
  type: string;
  path: string;
}

export default function CreateBackupButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sourcePath, setSourcePath] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileExplorer, setShowFileExplorer] = useState(false);

  // Fetch targets when the modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTargets();
    }
  }, [isOpen]);

  const fetchTargets = async () => {
    setLoadingTargets(true);
    try {
      const response = await api.get('/targets');
      console.log('Targets response:', response); // Debug log
      // Ensure targets is always an array
      setTargets(Array.isArray(response) ? response : []);
    } catch (err) {
      setError('Failed to load targets');
      console.error('Error fetching targets:', err);
      // Set targets to empty array on error
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetId) {
      setError('Please select a backup target');
      return;
    }
    
    if (!sourcePath) {
      setError('Please specify a source path');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      await api.post('/backups', {
        sourcePath,
        targetId,
      });

      setIsOpen(false);
      setSourcePath('');
      setTargetId('');
      
      // Benachrichtige andere Komponenten über das neue Backup
      backupEvents.emitBackupCreated();
      
      // Zeige eine Erfolgsmeldung (optional)
      // toast.success('Backup started successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handlePathSelect = (path: string) => {
    setSourcePath(path);
    setShowFileExplorer(false);
  };

  // Ensure targets is always an array before checking length
  const hasTargets = Array.isArray(targets) && targets.length > 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary flex items-center bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-full shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        Create Backup
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                Create New Backup
              </Dialog.Title>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="sourcePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Source Path
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="sourcePath"
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      placeholder="/path/to/backup"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowFileExplorer(!showFileExplorer)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                    >
                      Browse
                    </button>
                  </div>
                  
                  {showFileExplorer && (
                    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <FileExplorer 
                        onSelect={handlePathSelect}
                        initialPath="/"
                        showFiles={true}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="targetId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backup Target
                  </label>
                  {loadingTargets ? (
                    <div className="py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <div className="animate-spin h-4 w-4 border-b-2 border-primary-600 rounded-full mr-2"></div>
                      Loading targets...
                    </div>
                  ) : hasTargets ? (
                    <select
                      id="targetId"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      required
                    >
                      <option value="">Select a target</option>
                      {targets.map(target => (
                        <option key={target.id} value={target.id}>
                          {target.name} ({target.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        No backup targets available. Please create a target first.
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                        onClick={() => {
                          setIsOpen(false);
                          router.push('/targets');
                        }}
                      >
                        Go to Targets Page
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-2"></div>
                      Creating...
                    </>
                  ) : 'Create Backup'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 