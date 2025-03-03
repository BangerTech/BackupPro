"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import FileExplorer from './FileExplorer';

interface TargetConfig {
  path?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

interface CreateTargetButtonProps {
  onTargetCreated?: () => void;
}

// OAuth configuration
const OAUTH_CONFIG = {
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
  },
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/drive.file',
  }
};

export default function CreateTargetButton({ onTargetCreated }: CreateTargetButtonProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'local' | 'sftp' | 'dropbox' | 'google_drive'>('local');
  const [config, setConfig] = useState<TargetConfig>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showOAuthInstructions, setShowOAuthInstructions] = useState(false);

  // Check for OAuth callback on component mount
  useEffect(() => {
    const checkOAuthCallback = async () => {
      // Check if we have an OAuth code in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        try {
          // Determine which service we're authenticating with based on state
          const service = state.split('-')[0]; // Format: "service-randomstring"
          
          // Exchange code for token
          const response = await api.post('/oauth/token', {
            code,
            provider: service,
            redirectUri: `${window.location.origin}/oauth/${service}/callback`
          });
          
          // Store token in localStorage temporarily
          localStorage.setItem(`${service}_token`, response.data.accessToken);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Show success message
          setOauthStatus('success');
          
          // Open the create target dialog with the service pre-selected
          setType(service as 'dropbox' | 'google_drive');
          setConfig({
            ...config,
            accessToken: response.data.accessToken
          });
          setIsOpen(true);
        } catch (err) {
          console.error('OAuth callback error:', err);
          setOauthStatus('error');
          setOauthError(err instanceof Error ? err.message : 'Failed to authenticate');
        }
      }
    };
    
    checkOAuthCallback();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!name) {
      setError('Target name is required');
      return;
    }
    
    // Make sure we have a path for all target types
    if (!config.path) {
      setError('Path is required for all target types');
      return;
    }
    
    // Validate SFTP fields
    if (type === 'sftp') {
      if (!config.host || !config.username || !config.password) {
        setError('Host, username, and password are required for SFTP targets');
        return;
      }
    }
    
    // Validate cloud storage credentials
    if (type === 'dropbox' || type === 'google_drive') {
      if (!config.clientId || !config.clientSecret) {
        setError(`Client ID and Client Secret are required for ${type === 'dropbox' ? 'Dropbox' : 'Google Drive'}`);
        return;
      }
    }
    
    setLoading(true);
    setError(null);

    try {
      // For OAuth services, we need to store the credentials first
      if (type === 'dropbox' || type === 'google_drive') {
        // Store credentials in localStorage for the OAuth flow
        localStorage.setItem(`${type}_client_id`, config.clientId || '');
        localStorage.setItem(`${type}_client_secret`, config.clientSecret || '');
      }

      await api.post('/targets', {
        name,
        type,
        path: config.path,
        config: {
          ...config,
          // Include client credentials for OAuth services
          clientId: type === 'dropbox' || type === 'google_drive' ? config.clientId : undefined,
          clientSecret: type === 'dropbox' || type === 'google_drive' ? config.clientSecret : undefined,
        }
      });

      setIsOpen(false);
      resetForm();
      
      // Refresh the target list
      if (onTargetCreated) {
        onTargetCreated();
      } else {
        // If no callback provided, reload the page to show the new target
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create target');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('local');
    setConfig({});
    setShowOAuthInstructions(false);
  };

  const handlePathSelect = (path: string) => {
    setConfig({ ...config, path });
    setShowFileExplorer(false);
  };

  const initiateOAuth = (service: 'dropbox' | 'google_drive') => {
    // Check if client ID is provided
    if (!config.clientId) {
      setError(`Client ID is required for ${service === 'dropbox' ? 'Dropbox' : 'Google Drive'}`);
      return;
    }
    
    // Generate a random state to prevent CSRF
    const state = `${service}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Store state in localStorage to verify when we return
    localStorage.setItem('oauth_state', state);
    
    // Store client credentials in localStorage for the OAuth callback
    localStorage.setItem(`${service}_client_id`, config.clientId || '');
    localStorage.setItem(`${service}_client_secret`, config.clientSecret || '');
    
    // Build the OAuth URL
    let authUrl = '';
    const redirectUri = `${window.location.origin}/oauth/${service}/callback`;
    
    if (service === 'dropbox') {
      authUrl = `${OAUTH_CONFIG.dropbox.authUrl}?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    } else if (service === 'google_drive') {
      authUrl = `${OAUTH_CONFIG.google_drive.authUrl}?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(OAUTH_CONFIG.google_drive.scope)}&access_type=offline&state=${state}`;
    }
    
    // Redirect to the OAuth provider
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  // Toggle OAuth instructions
  const toggleOAuthInstructions = () => {
    setShowOAuthInstructions(!showOAuthInstructions);
  };

  // Render OAuth instructions based on selected service
  const renderOAuthInstructions = () => {
    if (!showOAuthInstructions) return null;
    
    if (type === 'dropbox') {
      return (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">How to set up Dropbox OAuth</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-blue-700 dark:text-blue-400">
            <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline">Dropbox App Console</a></li>
            <li>Click "Create app"</li>
            <li>Select "Scoped access" API</li>
            <li>Choose "App folder" access type (for limited access) or "Full Dropbox" (for full access)</li>
            <li>Name your app (e.g., "My Backup Scheduler")</li>
            <li>Under "OAuth 2", add the following Redirect URI: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{window.location.origin}/oauth/dropbox/callback</code></li>
            <li>Copy the "App key" as your Client ID</li>
            <li>Click "Show" next to "App secret" and copy it as your Client Secret</li>
            <li>Enter these values in the fields below</li>
          </ol>
        </div>
      );
    } else if (type === 'google_drive') {
      return (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">How to set up Google Drive OAuth</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-red-700 dark:text-red-400">
            <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
            <li>Create a new project or select an existing one</li>
            <li>Navigate to "APIs &amp; Services" {'->'} "Credentials"</li>
            <li>Click "Create Credentials" {'->'} "OAuth client ID"</li>
            <li>Configure the OAuth consent screen if prompted</li>
            <li>For Application type, select "Web application"</li>
            <li>Add the following Authorized redirect URI: <code className="bg-red-100 dark:bg-red-800 px-1 rounded">{window.location.origin}/oauth/google/callback</code></li>
            <li>Click "Create" and copy the Client ID and Client Secret</li>
            <li>Enter these values in the fields below</li>
          </ol>
        </div>
      );
    }
    
    return null;
  };

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setIsOpen(true)}
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        Add Target
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
                Add New Backup Target
              </Dialog.Title>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="name" className="form-label mb-1">
                    Target Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as any);
                      setConfig({}); // Reset config when changing type
                      setShowOAuthInstructions(false);
                    }}
                    className="input-field"
                    required
                  >
                    <option value="local">Local Directory</option>
                    <option value="sftp">SFTP Server</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="google_drive">Google Drive</option>
                  </select>
                </div>

                {/* OAuth Credentials Section */}
                {(type === 'dropbox' || type === 'google_drive') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="form-label">
                        {type === 'dropbox' ? 'Dropbox' : 'Google Drive'} OAuth Credentials
                      </label>
                      <button
                        type="button"
                        onClick={toggleOAuthInstructions}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                      >
                        <InformationCircleIcon className="h-5 w-5 mr-1" />
                        {showOAuthInstructions ? 'Hide Instructions' : 'Show Instructions'}
                      </button>
                    </div>
                    
                    {renderOAuthInstructions()}
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="clientId" className="form-label mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          id="clientId"
                          value={config.clientId || ''}
                          onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                          className="input-field"
                          placeholder={`Enter your ${type === 'dropbox' ? 'Dropbox' : 'Google'} Client ID`}
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="clientSecret" className="form-label mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          id="clientSecret"
                          value={config.clientSecret || ''}
                          onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                          className="input-field"
                          placeholder={`Enter your ${type === 'dropbox' ? 'Dropbox' : 'Google'} Client Secret`}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Path Selection */}
                <div>
                  <label htmlFor="path" className="form-label mb-1">
                    {type === 'local' ? 'Local Path' : 
                     type === 'sftp' ? 'Remote Path' : 
                     type === 'dropbox' ? 'Dropbox Path' : 'Google Drive Path'}
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      id="path"
                      value={config.path || ''}
                      onChange={(e) => setConfig({ ...config, path: e.target.value })}
                      className="input-field flex-grow rounded-r-none"
                      placeholder={type === 'local' ? '/path/to/backup' : 
                                  type === 'sftp' ? '/home/user/backups' : 
                                  type === 'dropbox' ? '/backups' : '/backups'}
                      required
                    />
                    {type === 'local' && (
                      <button
                        type="button"
                        onClick={() => setShowFileExplorer(true)}
                        className="btn-secondary rounded-l-none border-l-0"
                      >
                        Browse
                      </button>
                    )}
                  </div>
                </div>

                {/* SFTP Configuration */}
                {type === 'sftp' && (
                  <>
                    <div>
                      <label htmlFor="host" className="form-label mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        id="host"
                        value={config.host || ''}
                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                        className="input-field"
                        placeholder="sftp.example.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="port" className="form-label mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        id="port"
                        value={config.port || 22}
                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                        className="input-field"
                        placeholder="22"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="username" className="form-label mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={config.username || ''}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        className="input-field"
                        placeholder="username"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="form-label mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={config.password || ''}
                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        className="input-field"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </>
                )}

                {/* OAuth Connect Button */}
                {(type === 'dropbox' || type === 'google_drive') && config.clientId && config.clientSecret && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => initiateOAuth(type as 'dropbox' | 'google_drive')}
                      className={`w-full py-2 px-4 rounded-md font-medium text-white ${
                        type === 'dropbox' 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      Connect to {type === 'dropbox' ? 'Dropbox' : 'Google Drive'}
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      You'll be redirected to {type === 'dropbox' ? 'Dropbox' : 'Google'} to authorize access.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Target'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* File Explorer Modal */}
      {showFileExplorer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/30 dark:bg-black/70" onClick={() => setShowFileExplorer(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Select Directory
                </h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => setShowFileExplorer(false)}
                >
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="p-4">
                <FileExplorer
                  onSelect={(path) => {
                    handlePathSelect(path);
                    setShowFileExplorer(false);
                  }}
                  initialPath="/"
                  showFiles={false}
                />
              </div>
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowFileExplorer(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 