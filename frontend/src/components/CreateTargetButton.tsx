"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import FileExplorer from './FileExplorer';
import EmojiSelector from './EmojiSelector';

interface TargetConfig {
  path?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  share?: string;
  domain?: string;
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
  const [type, setType] = useState<'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive'>('local');
  const [emoji, setEmoji] = useState('');
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

  // Helper function to get the default emoji based on target type
  const getDefaultEmoji = (type: 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive') => {
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
    
    // Validate SMB fields
    if (type === 'smb') {
      if (!config.host || !config.share || !config.username || !config.password) {
        setError('Host, share, username, and password are required for SMB targets');
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
        emoji: emoji || getDefaultEmoji(type),
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
    setEmoji('');
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
        onClick={() => setIsOpen(true)}
        className="btn-primary flex items-center"
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
                Add Backup Target
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
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
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
                    disabled={loading}
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
                      const newType = e.target.value as 'local' | 'sftp' | 'smb' | 'dropbox' | 'google_drive';
                      setType(newType);
                      setConfig({}); // Reset config when changing type
                      setShowOAuthInstructions(false);
                      
                      // Set default emoji based on type if no emoji is selected
                      if (!emoji) {
                        setEmoji(getDefaultEmoji(newType));
                      }
                    }}
                    className="input-field"
                    disabled={loading}
                  >
                    <option value="local">Local</option>
                    <option value="sftp">SFTP</option>
                    <option value="smb">SMB</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="google_drive">Google Drive</option>
                  </select>
                </div>

                <EmojiSelector 
                  value={emoji}
                  onChange={setEmoji}
                  defaultEmoji={type}
                />

                {/* Dynamic config fields based on type */}
                {type === 'local' && (
                  <div>
                    <label htmlFor="path" className="form-label mb-1">
                      Local Path
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="input-field flex-1"
                        placeholder="/path/to/backups"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowFileExplorer(!showFileExplorer)}
                        className="btn-secondary whitespace-nowrap"
                        disabled={loading}
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

                {type === 'sftp' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="example.com"
                        required
                        disabled={loading}
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
                        required
                        disabled={loading}
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
                        disabled={loading}
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
                        placeholder="password"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="sftp-path" className="form-label mb-1">
                        Remote Path
                      </label>
                      <input
                        type="text"
                        id="sftp-path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="input-field"
                        placeholder="/remote/path"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

                {type === 'smb' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="192.168.1.100"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="share" className="form-label mb-1">
                        Share Name
                      </label>
                      <input
                        type="text"
                        id="share"
                        value={config.share || ''}
                        onChange={(e) => setConfig({ ...config, share: e.target.value })}
                        className="input-field"
                        placeholder="backup"
                        required
                        disabled={loading}
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
                        disabled={loading}
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
                        placeholder="password"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="domain" className="form-label mb-1">
                        Domain (Optional)
                      </label>
                      <input
                        type="text"
                        id="domain"
                        value={config.domain || ''}
                        onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                        className="input-field"
                        placeholder="WORKGROUP"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="smb-path" className="form-label mb-1">
                        Remote Path
                      </label>
                      <input
                        type="text"
                        id="smb-path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="input-field"
                        placeholder="/remote/path"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

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
                          disabled={loading}
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
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
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
    </>
  );
} 