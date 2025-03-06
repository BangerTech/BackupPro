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
        type="button"
        className="btn-primary"
        onClick={() => setIsOpen(true)}
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        Create Backup
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                Create New Backup
              </Dialog.Title>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="sourcePath" className="form-label mb-1">
                    Source Path
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="sourcePath"
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      className="input-field flex-1"
                      placeholder="/path/to/backup"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowFileExplorer(!showFileExplorer)}
                      className="btn-secondary whitespace-nowrap"
                    >
                      Browse
                    </button>
                  </div>
                  
                  {showFileExplorer && (
                    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                      <FileExplorer 
                        onSelect={handlePathSelect}
                        initialPath="/"
                        showFiles={true}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="targetId" className="form-label mb-1">
                    Backup Target
                  </label>
                  {loadingTargets ? (
                    <div className="py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-500 dark:text-gray-400">
                      Loading targets...
                    </div>
                  ) : hasTargets ? (
                    <select
                      id="targetId"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="input-field"
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
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        No backup targets available. Please create a target first.
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
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

              {error && (
                <div className="px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || loadingTargets || !hasTargets}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 