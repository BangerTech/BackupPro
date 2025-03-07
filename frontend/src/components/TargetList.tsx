"use client";

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';
import { api } from '@/lib/api';
import FileExplorer from './FileExplorer';
import IconSelector from './IconSelector';
import { 
  FolderIcon, ServerIcon, CloudIcon, GlobeAltIcon, 
  DocumentIcon, ArchiveBoxIcon, ShieldCheckIcon, 
  CpuChipIcon, DevicePhoneMobileIcon, HomeIcon,
  ComputerDesktopIcon, CameraIcon, VideoCameraIcon,
  MusicalNoteIcon, PhotoIcon, FilmIcon, CodeBracketIcon
} from '@heroicons/react/24/outline';
import EmojiSelector from './EmojiSelector';

interface TargetConfig {
  path?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  accessToken?: string;
  share?: string;
  domain?: string;
}

interface Target {
  id: string;
  name: string;
  type: 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive';
  path: string;
  icon: string;
  emoji?: string;
  config: TargetConfig;
  createdAt: string;
  updatedAt: string;
}

export default function TargetList() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'local' as 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive',
    emoji: '',
    config: {
      path: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      domain: '',
      share: '',
      accessToken: '',
    }
  });
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await api.get('/targets');
      console.log('Fetched targets:', response); // Debug log
      setTargets(Array.isArray(response) ? response : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching targets:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setTargetToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setTargetToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const deleteTarget = async () => {
    if (!targetToDelete) return;
    
    try {
      // The API returns 204 No Content, so we don't need to parse JSON
      await fetch(`/api/targets/${targetToDelete}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // If we get here, the delete was successful
      setTargets(targets.filter(target => target.id !== targetToDelete));
      closeDeleteConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete target');
      console.error('Error deleting target:', err);
    }
  };

  const openEditModal = (target: Target) => {
    setEditingTarget(target);
    setEditForm({
      name: target.name,
      type: target.type,
      emoji: target.emoji || '',
      config: {
        path: target.path || '',
        host: target.config?.host || '',
        port: target.config?.port || 22,
        username: target.config?.username || '',
        password: target.config?.password || '',
        domain: target.config?.domain || '',
        share: target.config?.share || '',
        accessToken: target.config?.accessToken || '',
      }
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingTarget(null);
    setIsEditModalOpen(false);
    setEditError(null);
  };

  const handleEditFormChange = (field: string, value: any) => {
    if (field.startsWith('config.')) {
      const configField = field.split('.')[1];
      setEditForm({
        ...editForm,
        config: {
          ...editForm.config,
          [configField]: value
        }
      });
    } else {
      setEditForm({
        ...editForm,
        [field]: value
      });
    }
  };

  const handlePathSelect = (path: string) => {
    setEditForm({
      ...editForm,
      config: {
        ...editForm.config,
        path
      }
    });
    setShowFileExplorer(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTarget) return;
    
    // Validate form
    if (!editForm.name) {
      setEditError('Target name is required');
      return;
    }
    
    // Make sure we have a path
    if (!editForm.config.path) {
      setEditError('Path is required for all target types');
      return;
    }
    
    // Validate SFTP fields
    if (editForm.type === 'sftp') {
      if (!editForm.config.host || !editForm.config.username || !editForm.config.password) {
        setEditError('Host, username, and password are required for SFTP targets');
        return;
      }
    }
    
    // Validate SMB fields
    if (editForm.type === 'smb') {
      if (!editForm.config.host || !editForm.config.share || !editForm.config.username || !editForm.config.password) {
        setEditError('Host, share, username, and password are required for SMB targets');
        return;
      }
    }
    
    // Validate cloud storage tokens
    if ((editForm.type === 'dropbox' || editForm.type === 'google_drive') && !editForm.config.accessToken) {
      setEditError('Access token is required for cloud storage targets');
      return;
    }
    
    setIsSubmitting(true);
    setEditError(null);

    try {
      const response = await api.put(`/targets/${editingTarget.id}`, {
        name: editForm.name,
        type: editForm.type,
        emoji: editForm.emoji,
        path: editForm.config.path,
        config: editForm.config
      });
      
      // Update the target in the list
      setTargets(targets.map(target => 
        target.id === editingTarget.id ? { ...response, path: editForm.config.path || '' } : target
      ));
      
      closeEditModal();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update target');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to get the default emoji based on target type
  const getDefaultEmoji = (type: Target['type']) => {
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

  // Safely format a date string, returning a fallback if the date is invalid
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Unknown date';
    
    try {
      // Try to parse the ISO date string
      const date = parseISO(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid date';
      }
      return format(date, 'PPp');
    } catch (error) {
      console.error('Error formatting date:', error, 'Date string:', dateString);
      return 'Invalid date';
    }
  };

  // Helper function to get the icon component based on the icon name
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'server': return ServerIcon;
      case 'cloud': return CloudIcon;
      case 'globe': return GlobeAltIcon;
      case 'document': return DocumentIcon;
      case 'archive': return ArchiveBoxIcon;
      case 'shield': return ShieldCheckIcon;
      case 'chip': return CpuChipIcon;
      case 'mobile': return DevicePhoneMobileIcon;
      case 'home': return HomeIcon;
      case 'desktop': return ComputerDesktopIcon;
      case 'camera': return CameraIcon;
      case 'video': return VideoCameraIcon;
      case 'music': return MusicalNoteIcon;
      case 'photo': return PhotoIcon;
      case 'film': return FilmIcon;
      case 'code': return CodeBracketIcon;
      default: return FolderIcon;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    </div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">No targets found</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {targets.map((target) => {
          const IconComponent = getIconComponent(target.icon || 'folder');
          return (
            <div
              key={target.id}
              className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{target.emoji || getDefaultEmoji(target.type)}</span>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {target.name}
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(target)}
                    className="p-2 rounded-md text-gray-400 hover:text-primary-500"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteConfirm(target.id)}
                    className="p-2 rounded-md text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Type: {target.type}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Created: {formatDate(target.createdAt)}
              </div>
              {target.path && (
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  Path: {target.path}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Confirm Deletion
            </Dialog.Title>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete this target? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDeleteConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900"
                onClick={deleteTarget}
              >
                Delete
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Edit Target Dialog */}
      <Dialog
        open={isEditModalOpen}
        onClose={closeEditModal}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                Edit Backup Target
              </Dialog.Title>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="name" className="form-label mb-1">
                    Target Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={editForm.name}
                    onChange={(e) => handleEditFormChange('name', e.target.value)}
                    className="input-field"
                    placeholder="My Backup Target"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="type" className="form-label mb-1">
                    Target Type
                  </label>
                  <select
                    id="type"
                    value={editForm.type}
                    onChange={(e) => {
                      handleEditFormChange('type', e.target.value);
                      // Set default emoji based on type if no emoji is selected
                      if (!editForm.emoji) {
                        const newType = e.target.value as Target['type'];
                        handleEditFormChange('emoji', getDefaultEmoji(newType));
                      }
                    }}
                    className="input-field"
                    disabled={isSubmitting}
                  >
                    <option value="local">Local</option>
                    <option value="sftp">SFTP</option>
                    <option value="smb">SMB</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="google_drive">Google Drive</option>
                  </select>
                </div>

                <EmojiSelector 
                  value={editForm.emoji}
                  onChange={(value) => handleEditFormChange('emoji', value)}
                  defaultEmoji={editForm.type}
                />

                {/* Dynamic config fields based on type */}
                {editForm.type === 'local' && (
                  <div>
                    <label htmlFor="path" className="form-label mb-1">
                      Local Path
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        id="path"
                        value={editForm.config.path || ''}
                        onChange={(e) => handleEditFormChange('config.path', e.target.value)}
                        className="input-field flex-1"
                        placeholder="/path/to/backups"
                        required
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowFileExplorer(!showFileExplorer)}
                        className="btn-secondary whitespace-nowrap"
                        disabled={isSubmitting}
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
                )}

                {editForm.type === 'sftp' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="host" className="form-label mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        id="host"
                        value={editForm.config.host || ''}
                        onChange={(e) => handleEditFormChange('config.host', e.target.value)}
                        className="input-field"
                        placeholder="example.com"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="port" className="form-label mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        id="port"
                        value={editForm.config.port || 22}
                        onChange={(e) => handleEditFormChange('config.port', parseInt(e.target.value))}
                        className="input-field"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="form-label mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={editForm.config.username || ''}
                        onChange={(e) => handleEditFormChange('config.username', e.target.value)}
                        className="input-field"
                        placeholder="username"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="form-label mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={editForm.config.password || ''}
                        onChange={(e) => handleEditFormChange('config.password', e.target.value)}
                        className="input-field"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="remotePath" className="form-label mb-1">
                        Remote Path
                      </label>
                      <input
                        type="text"
                        id="remotePath"
                        value={editForm.config.path || ''}
                        onChange={(e) => handleEditFormChange('config.path', e.target.value)}
                        className="input-field"
                        placeholder="/remote/backup/path"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}

                {editForm.type === 'smb' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="host" className="form-label mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        id="host"
                        value={editForm.config.host || ''}
                        onChange={(e) => handleEditFormChange('config.host', e.target.value)}
                        className="input-field"
                        placeholder="192.168.1.100"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="share" className="form-label mb-1">
                        Share Name
                      </label>
                      <input
                        type="text"
                        id="share"
                        value={editForm.config.share || ''}
                        onChange={(e) => handleEditFormChange('config.share', e.target.value)}
                        className="input-field"
                        placeholder="backup"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="form-label mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={editForm.config.username || ''}
                        onChange={(e) => handleEditFormChange('config.username', e.target.value)}
                        className="input-field"
                        placeholder="username"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="form-label mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={editForm.config.password || ''}
                        onChange={(e) => handleEditFormChange('config.password', e.target.value)}
                        className="input-field"
                        placeholder="password"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="domain" className="form-label mb-1">
                        Domain (Optional)
                      </label>
                      <input
                        type="text"
                        id="domain"
                        value={editForm.config.domain || ''}
                        onChange={(e) => handleEditFormChange('config.domain', e.target.value)}
                        className="input-field"
                        placeholder="WORKGROUP"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="smb-path" className="form-label mb-1">
                        Remote Path
                      </label>
                      <input
                        type="text"
                        id="smb-path"
                        value={editForm.config.path || ''}
                        onChange={(e) => handleEditFormChange('config.path', e.target.value)}
                        className="input-field"
                        placeholder="/remote/path"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}

                {(editForm.type === 'dropbox' || editForm.type === 'google_drive') && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="accessToken" className="form-label mb-1">
                        Access Token
                      </label>
                      <input
                        type="text"
                        id="accessToken"
                        value={editForm.config.accessToken || ''}
                        onChange={(e) => handleEditFormChange('config.accessToken', e.target.value)}
                        className="input-field"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label htmlFor="cloudPath" className="form-label mb-1">
                        {editForm.type === 'dropbox' ? 'Dropbox Path' : 'Google Drive Path'}
                      </label>
                      <input
                        type="text"
                        id="cloudPath"
                        value={editForm.config.path || ''}
                        onChange={(e) => handleEditFormChange('config.path', e.target.value)}
                        className="input-field"
                        placeholder={editForm.type === 'dropbox' ? '/Backups' : 'My Backups'}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </div>

              {editError && (
                <div className="px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
                  {editError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeEditModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 