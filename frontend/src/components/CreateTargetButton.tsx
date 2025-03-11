"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon, InformationCircleIcon, CheckCircleIcon, ArrowPathIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import FileExplorer from './FileExplorer';
import EmojiSelector from './EmojiSelector';
import { oauthServer } from '@/lib/oauth-server';

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
  refreshToken?: string;
  tokenExpiresAt?: number;
}

interface CreateTargetButtonProps {
  onTargetCreated?: () => void;
}

// OAuth configuration
const OAUTH_CONFIG = {
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    scope: 'files.content.write files.content.read',
  },
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/drive.file',
    // Additional scopes if needed
    // scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
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
  const [showEmojiSelector, setShowEmojiSelector] = useState(false);
  
  // New state for OAuth dialog
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);
  const [oauthStep, setOAuthStep] = useState<'instructions' | 'waiting' | 'input'>('instructions');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [oauthService, setOAuthService] = useState<'dropbox' | 'google_drive'>('google_drive');
  const [oauthWindow, setOAuthWindow] = useState<Window | null>(null);
  const [loopbackRedirectUri, setLoopbackRedirectUri] = useState('');
  const [oauthState, setOAuthState] = useState('');
  const [oauthClientId, setOAuthClientId] = useState('');
  const [oauthClientSecret, setOAuthClientSecret] = useState('');

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
          const response = await api.post('/api/oauth/token', {
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
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken || null,
            tokenExpiresAt: response.data.expiresIn ? Date.now() + (response.data.expiresIn * 1000) : undefined,
            clientId: localStorage.getItem(`${service}_client_id`) || '',
            clientSecret: localStorage.getItem(`${service}_client_secret`) || '',
            path: service === 'dropbox' ? '/BackupPro' : 'BackupPro'
          });
          
          // Auto-create the target if we have all the necessary information
          if (response.data.accessToken && service) {
            const targetName = service === 'dropbox' ? 'My Dropbox' : 'My Google Drive';
            const emoji = service === 'dropbox' ? '📦' : '📁';
            const path = service === 'dropbox' ? '/BackupPro' : 'BackupPro';
            
            try {
              await api.post('/targets', {
                name: targetName,
                type: service,
                emoji: emoji,
                path: path,
                config: {
                  accessToken: response.data.accessToken,
                  refreshToken: response.data.refreshToken || null,
                  tokenExpiresAt: response.data.expiresIn ? Date.now() + (response.data.expiresIn * 1000) : undefined,
                  clientId: localStorage.getItem(`${service}_client_id`) || '',
                  clientSecret: localStorage.getItem(`${service}_client_secret`) || ''
                }
              });
              
              // Notify about target creation
              if (onTargetCreated) {
                onTargetCreated();
              }
              
              // Don't open the dialog since we've already created the target
              setIsOpen(false);
              
              // Show a success message
              alert(`${service === 'dropbox' ? 'Dropbox' : 'Google Drive'} target created successfully!`);
            } catch (createErr) {
              console.error('Error creating target:', createErr);
              // Still open the dialog so the user can try manually
              setIsOpen(true);
            }
          } else {
            // Open the dialog if we couldn't auto-create
            setIsOpen(true);
          }
        } catch (err) {
          console.error('OAuth callback error:', err);
          setOauthStatus('error');
          setOauthError(err instanceof Error ? err.message : 'Failed to authenticate');
        }
      }
    };
    
    checkOAuthCallback();
  }, []);

  // Listen for messages from OAuth popup windows
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Only accept messages from the same origin
      if (event.origin !== window.location.origin) return;
      
      // Check if this is an OAuth callback message
      if (event.data && event.data.type === 'oauth-callback') {
        const { success, accessToken, provider, error, redirectUrl } = event.data;
        
        if (success && accessToken && provider) {
          // Close the OAuth dialog
          setShowOAuthDialog(false);
          
          // Update the form with the token
          setType(provider as 'dropbox' | 'google_drive');
          setConfig({
            ...config,
            accessToken: accessToken,
            clientId: localStorage.getItem(`${provider}_client_id`) || '',
            clientSecret: localStorage.getItem(`${provider}_client_secret`) || '',
            path: provider === 'dropbox' ? '/BackupPro' : 'BackupPro'
          });
          
          // If we received the redirectUrl, process it automatically
          if (redirectUrl) {
            console.log('Received redirect URL from popup:', redirectUrl);
            setRedirectUrl(redirectUrl);
            
            // Process the URL automatically
            try {
              const urlObj = new URL(redirectUrl);
              const code = urlObj.searchParams.get('code');
              const state = urlObj.searchParams.get('state');
              
              if (code && state) {
                // Show the OAuth dialog in input mode
                setOAuthService(provider as 'dropbox' | 'google_drive');
                setOAuthStep('input');
                setShowOAuthDialog(true);
                
                // Auto-submit after a short delay
                setTimeout(() => {
                  handleOAuthRedirectSubmit();
                }, 500);
              }
            } catch (err) {
              console.error('Error processing redirect URL:', err);
            }
          } else {
            // Auto-create the target
            // Use the name entered by the user, or a default if empty
            const targetName = name || (provider === 'dropbox' ? 'Dropbox' : 'Google Drive');
            const targetEmoji = emoji || (provider === 'dropbox' ? '📦' : '📁');
            const path = provider === 'dropbox' ? '/BackupPro' : 'BackupPro';
            
            api.post('/targets', {
              name: targetName,
              type: provider,
              emoji: targetEmoji,
              path: path,
              config: {
                accessToken: accessToken,
                clientId: localStorage.getItem(`${provider}_client_id`) || '',
                clientSecret: localStorage.getItem(`${provider}_client_secret`) || ''
              }
            })
            .then(() => {
              // Notify about target creation
              if (onTargetCreated) {
                onTargetCreated();
              }
              
              // Show a success message
              alert(`${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} target created successfully!`);
            })
            .catch(err => {
              console.error('Error creating target:', err);
              setError(`Failed to create target: ${err instanceof Error ? err.message : String(err)}`);
              setIsOpen(true);
            });
          }
        } else if (error) {
          setOauthError(error);
          setOauthStatus('error');
        }
      }
    };
    
    // Add the event listener
    window.addEventListener('message', handleOAuthMessage);
    
    // Clean up
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [config, onTargetCreated, name, emoji]);

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

  const initiateOAuth = async (service: 'dropbox' | 'google_drive') => {
    try {
      setLoading(true);
      setOauthStatus('pending');
      setOauthError(null);
      
      // Generate a random state to prevent CSRF attacks
      const state = `${service}-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('oauth_state', state);
      
      const clientId = config.clientId;
      if (!clientId) {
        setError('Client ID is required');
        setLoading(false);
        return;
      }
      
      let authUrl = '';
      
      if (service === 'dropbox') {
        // Always use localhost for Dropbox redirect URI, even if accessed via IP
        const dropboxRedirectUri = 'http://localhost:3000/oauth/dropbox/callback';
        
        // Store the redirect URI for the callback
        localStorage.setItem('dropbox_redirect_uri', dropboxRedirectUri);
        
        // Add scope parameter for Dropbox
        authUrl = `${OAUTH_CONFIG.dropbox.authUrl}?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(dropboxRedirectUri)}&state=${state}&scope=${encodeURIComponent(OAUTH_CONFIG.dropbox.scope)}`;
        
        // Show the OAuth dialog instead of using alert/prompt
        setOAuthService(service);
        setOAuthStep('instructions');
        setShowOAuthDialog(true);
        
        // Store credentials for the callback
        localStorage.setItem(`${service}_client_id`, clientId);
        localStorage.setItem(`${service}_client_secret`, config.clientSecret || '');
        
        // Open the OAuth popup
        const width = 800;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const authWindow = window.open(
          authUrl,
          'oauth-popup',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
        
        setOAuthWindow(authWindow);
        
        return;
      } else if (service === 'google_drive') {
        // Create a unique device ID that remains consistent for this browser
        const deviceId = localStorage.getItem('google_device_id') || `backup-pro-device-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('google_device_id', deviceId);
        
        // For Google Drive, we need to use a loopback IP address for the redirect URI
        // This is a special case for desktop applications
        const loopbackPort = 3395; // Use a specific port for consistency
        const loopbackRedirectUri = `http://127.0.0.1:${loopbackPort}`;
        
        // Store the redirect URI for the callback
        localStorage.setItem('google_redirect_uri', loopbackRedirectUri);
        
        // Create URL parameters
        const params = new URLSearchParams();
        params.append('client_id', clientId.trim()); // Trim to remove any whitespace
        params.append('response_type', 'code');
        params.append('redirect_uri', loopbackRedirectUri);
        params.append('scope', OAUTH_CONFIG.google_drive.scope);
        params.append('access_type', 'offline');
        params.append('state', state);
        params.append('prompt', 'consent');
        params.append('include_granted_scopes', 'true');
        
        // Always add device_id and device_name for Desktop App Flow
        params.append('device_id', deviceId);
        params.append('device_name', 'BackupPro App');
        
        // For Google Drive, we need to ensure the redirect URI is properly encoded
        authUrl = `${OAUTH_CONFIG.google_drive.authUrl}?${params.toString()}`;
        
        // Log the auth URL for debugging
        console.log('Google Drive Auth URL:', authUrl);
        
        // Create a custom HTML page for the Google Drive callback
        // This will be served locally when Google redirects to the loopback address
        const googleCallbackHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Drive Authorization</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #f9f9f9;
      color: #333;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 30px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #4285F4;
      margin-top: 0;
    }
    .success {
      color: #34A853;
      font-weight: bold;
    }
    .error {
      color: #EA4335;
      font-weight: bold;
    }
    .button {
      background-color: #4285F4;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #3367D6;
    }
    .url-display {
      background-color: #f1f3f4;
      padding: 10px;
      border-radius: 4px;
      margin: 20px 0;
      word-break: break-all;
      text-align: left;
      font-family: monospace;
      font-size: 14px;
    }
    .instructions {
      margin-top: 20px;
      font-size: 14px;
      color: #5f6368;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Google Drive Authorization</h1>
    <div id="status-message"></div>
    <div id="url-container" class="url-display"></div>
    <button id="copy-button" class="button">Copy URL to Clipboard</button>
    <div class="instructions">
      <p>Please copy this URL and paste it back into the application.</p>
      <p>You can close this window after copying the URL.</p>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const urlContainer = document.getElementById('url-container');
      const copyButton = document.getElementById('copy-button');
      const statusMessage = document.getElementById('status-message');
      
      // Get the current URL
      const currentUrl = window.location.href;
      
      // Display the URL
      urlContainer.textContent = currentUrl;
      
      // Check if there's a code parameter (successful auth)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (code) {
        statusMessage.innerHTML = '<p class="success">✅ Authorization successful!</p>';
      } else if (error) {
        statusMessage.innerHTML = '<p class="error">❌ Authorization failed: ' + error + '</p>';
      } else {
        statusMessage.innerHTML = '<p class="error">❌ No authorization code found</p>';
      }
      
      // Copy URL functionality
      copyButton.addEventListener('click', function() {
        navigator.clipboard.writeText(currentUrl).then(function() {
          copyButton.textContent = 'Copied!';
          setTimeout(function() {
            copyButton.textContent = 'Copy URL to Clipboard';
          }, 2000);
        }).catch(function(err) {
          console.error('Could not copy text: ', err);
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = currentUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          copyButton.textContent = 'Copied!';
          setTimeout(function() {
            copyButton.textContent = 'Copy URL to Clipboard';
          }, 2000);
        });
      });
    });
  </script>
</body>
</html>
        `;
        
        // Create a Blob with the HTML content
        const blob = new Blob([googleCallbackHtml], { type: 'text/html' });
        const callbackUrl = URL.createObjectURL(blob);
        
        // Store the callback URL for later use
        localStorage.setItem('google_callback_html_url', callbackUrl);
        
        // Show the OAuth dialog instead of using alert/prompt
        setOAuthService(service);
        setOAuthStep('instructions');
        setShowOAuthDialog(true);
        setLoopbackRedirectUri(loopbackRedirectUri);
        setOAuthState(state);
        setOAuthClientId(clientId.trim()); // Trim to remove any whitespace
        setOAuthClientSecret(config.clientSecret?.trim() || ''); // Trim to remove any whitespace
        
        // Open the auth URL in a popup window instead of a new tab
        const width = 800;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const authWindow = window.open(
          authUrl,
          'oauth-popup',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
        
        setOAuthWindow(authWindow);
        
        // Set up a listener for the redirect
        const checkRedirect = setInterval(() => {
          try {
            // Check if the window location has changed to our loopback URI
            if (authWindow && authWindow.location.href.startsWith('http://127.0.0.1')) {
              // Clear the interval
              clearInterval(checkRedirect);
              
              // Replace the content with our custom HTML
              authWindow.location.href = callbackUrl;
            }
          } catch (e) {
            // This will throw a cross-origin error if the window is on a different domain
            // We can ignore this error
          }
        }, 500);
        
        // Clear the interval after 5 minutes (300000ms) to prevent memory leaks
        setTimeout(() => {
          clearInterval(checkRedirect);
        }, 300000);
        
        // Don't open the OAuth URL in a popup window for Google Drive
        // We're handling it differently
        return;
      }
      
      // We don't need this anymore as we handle both Dropbox and Google Drive above
      // and don't support any other OAuth services
    } catch (error) {
      console.error('Failed to start OAuth process:', error);
      setError(`Failed to start OAuth process: ${error instanceof Error ? error.message : String(error)}`);
      setLoading(false);
    }
  };
  
  const handleOAuthRedirectSubmit = async () => {
    try {
      // Get the URL from the input
      const url = redirectUrl;
      
      if (!url) {
        setOauthError('Please enter the redirect URL');
        setLoading(false);
        return;
      }
      
      // Parse the URL to get the code and state
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const storedState = localStorage.getItem('oauth_state');
      
      if (!code) {
        setOauthError('No authorization code found in the URL');
        setOauthStatus('error');
        setLoading(false);
        return;
      }
      
      // For Dropbox, the state might be URL-encoded, so decode it first
      const decodedState = state ? decodeURIComponent(state) : '';
      
      // Determine which service we're authenticating with based on state
      // Even if state doesn't match, we can still try to extract the service
      let service = '';
      if (decodedState && decodedState.includes('-')) {
        service = decodedState.split('-')[0]; // Format: "service-randomstring"
      } else if (url.includes('/oauth/dropbox/')) {
        service = 'dropbox';
      } else if (url.includes('/oauth/google_drive/') || url.includes('accounts.google.com')) {
        service = 'google_drive';
      }
      
      if (!service || (service !== 'dropbox' && service !== 'google_drive')) {
        setOauthError('Could not determine the service type from the URL');
        setOauthStatus('error');
        setLoading(false);
        return;
      }
      
      // Get the stored client credentials
      let clientId = localStorage.getItem(`${service}_client_id`);
      let clientSecret = localStorage.getItem(`${service}_client_secret`);
      
      // Trim whitespace from credentials
      clientId = clientId ? clientId.trim() : '';
      clientSecret = clientSecret ? clientSecret.trim() : '';
      
      if (!clientId || !clientSecret) {
        setOauthError('OAuth credentials not found. Please try again.');
        setOauthStatus('error');
        setLoading(false);
        return;
      }
      
      // Get the redirect URI
      const redirectUri = service === 'dropbox' 
        ? localStorage.getItem('dropbox_redirect_uri') || 'http://localhost:3000/oauth/dropbox/callback'
        : localStorage.getItem('google_redirect_uri');
      
      if (!redirectUri) {
        setOauthError('Redirect URI not found');
        setOauthStatus('error');
        setLoading(false);
        return;
      }
      
      // Show loading state
      setLoading(true);
      
      try {
        // Exchange code for token
        console.log('Exchanging code for token:', {
          code,
          provider: service,
          redirectUri,
          clientId,
          clientSecret
        });
        
        const response = await api.post('/oauth/token', {
          code,
          provider: service,
          redirectUri,
          clientId,
          clientSecret
        });
        
        console.log('Token exchange response:', response);
        
        // Update the config with the tokens
        setConfig({
          ...config,
          accessToken: response?.accessToken,
          refreshToken: response?.refreshToken || null,
          tokenExpiresAt: response?.expiresIn ? Date.now() + (response.expiresIn * 1000) : undefined,
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined,
          path: service === 'dropbox' ? '/BackupPro' : 'BackupPro'
        });
        
        // Show success message
        setOauthStatus('success');
        
        // Auto-create the target
        const targetName = name || (service === 'dropbox' ? 'Dropbox' : 'Google Drive');
        const targetEmoji = emoji || (service === 'dropbox' ? '📦' : '📁');
        const path = service === 'dropbox' ? '/BackupPro' : 'BackupPro';
        
        try {
          await api.post('/targets', {
            name: targetName,
            type: service,
            emoji: targetEmoji,
            path: path,
            config: {
              accessToken: response?.accessToken,
              refreshToken: response?.refreshToken || null,
              tokenExpiresAt: response?.expiresIn ? Date.now() + (response.expiresIn * 1000) : undefined,
              clientId: clientId || undefined,
              clientSecret: clientSecret || undefined
            }
          });
          
          // Notify about target creation
          if (onTargetCreated) {
            onTargetCreated();
          }
          
          // Close the OAuth dialog after a short delay to show the success message
          setTimeout(() => {
            setShowOAuthDialog(false);
            // Reset OAuth state
            setOauthStatus('idle');
            setOauthError('');
            // Show a success message - only show it here, not in the browser alert
            // alert(`${service === 'dropbox' ? 'Dropbox' : 'Google Drive'} target created successfully!`);
          }, 1500);
        } catch (createErr) {
          console.error('Error creating target:', createErr);
          setOauthError(`Failed to create target: ${createErr instanceof Error ? createErr.message : String(createErr)}`);
        }
      } catch (error) {
        console.error('Error exchanging code for token:', error);
        setOauthError(`Failed to exchange code for token: ${error instanceof Error ? error.message : String(error)}`);
        setOauthStatus('error');
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error handling OAuth redirect:', error);
      setOauthError('Invalid URL format');
      setOauthStatus('error');
      setLoading(false);
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
            <li><strong>Important:</strong> Go to the "Permissions" tab and enable <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">files.content.write</code> and <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">files.content.read</code> permissions</li>
            <li>Click "Submit" to save the permissions</li>
            <li>Under "OAuth 2", add the following Redirect URI: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">http://localhost:3000/oauth/dropbox/callback</code></li>
            <li><strong>Important:</strong> Always use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">localhost</code> in the Redirect URI, even if you're accessing the app via an IP address</li>
            <li>Copy the "App key" as your Client ID</li>
            <li>Click "Show" next to "App secret" and copy it as your Client Secret</li>
            <li>Enter these values in the fields below</li>
            <li className="font-medium text-blue-900 dark:text-blue-200 mt-2">Important Notes:</li>
            <li className="italic">• When you click "Connect to Dropbox", a popup window will open</li>
            <li className="italic">• After authorization, you'll be redirected to a page that may show "This site can't be reached" if you're accessing via IP address</li>
            <li className="italic">• This is normal! Copy the entire URL from the popup's address bar</li>
            <li className="italic">• Paste the URL back into the prompt that appears in this application</li>
            <li className="italic">• If you see an error about the redirect URI, make sure you've entered exactly <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">http://localhost:3000/oauth/dropbox/callback</code> in the Dropbox App Console</li>
            <li className="italic">• If you see an error about missing permissions, make sure you've enabled the required permissions in the Dropbox App Console</li>
          </ol>
        </div>
      );
    } else if (type === 'google_drive') {
      return (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">How to set up Google Drive OAuth</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-red-700 dark:text-red-400">
            <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console Credentials Page</a></li>
            <li>Create a new project or select an existing one</li>
            <li>Go to "APIs & Services" → "Library" and search for "Google Drive API"</li>
            <li><strong>Important:</strong> Click on "Google Drive API" and then click "Enable" to activate the API</li>
            <li>Wait a few minutes for the API activation to propagate</li>
            <li>Go back to "Credentials" and click "Create Credentials" → "OAuth client ID"</li>
            <li><strong>Important:</strong> For Application type, select "Desktop application"</li>
            <li>Give your application a name (e.g., "BackupPro")</li>
            <li>Click "Create" and copy the Client ID and Client Secret</li>
            <li>Enter these values in the fields below</li>
            <li className="font-medium text-red-900 dark:text-red-200 mt-2">Adding Test Users (Required):</li>
            <li>Go to "APIs & Services" → "OAuth consent screen"</li>
            <li>Navigate to the "Test users" section</li>
            <li>Click "Add users" and enter your email</li>
            <li>Click "Save" to confirm</li>
            <li className="font-medium text-red-900 dark:text-red-200 mt-2">Important Notes:</li>
            <li className="italic">• You may see a warning about an unverified app - this is normal for personal use</li>
            <li className="italic">• When you click "Connect to Google Drive", a popup window will open</li>
            <li className="italic">• After authorization, you'll be redirected to a page that says "This site can't be reached"</li>
            <li className="italic">• This is normal! Copy the entire URL from the popup's address bar</li>
            <li className="italic">• Paste the URL back into the prompt that appears in this application</li>
            <li className="italic">• This method works with both localhost and IP addresses</li>
            <li className="font-medium text-red-900 dark:text-red-200 mt-2">Common Errors:</li>
            <li className="italic">• If you see an error about "Google Drive API has not been used in project..." or "Google Drive API is disabled", return to step 4 and make sure you've enabled the API</li>
          </ol>
        </div>
      );
    }
    
    return null;
  };

  // Handle pasting from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      // Check if the Clipboard API is available
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.includes('code=')) {
          setRedirectUrl(clipboardText);
        } else {
          // If the clipboard doesn't contain a valid URL, show a message
          setOauthError('The clipboard does not contain a valid OAuth URL. Please copy the URL from your browser and try again.');
        }
      } else {
        // Fallback for browsers that don't support the Clipboard API
        setOauthError('Clipboard access is not available in your browser. Please paste the URL manually.');
        
        // Focus the input field to make it easier for the user to paste
        const inputField = document.getElementById('redirect-url');
        if (inputField) {
          inputField.focus();
        }
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      setOauthError('Failed to read clipboard. Please paste the URL manually.');
      
      // Focus the input field to make it easier for the user to paste
      const inputField = document.getElementById('redirect-url');
      if (inputField) {
        inputField.focus();
      }
    }
  };
  
  // Auto-focus the input field when the dialog is shown
  useEffect(() => {
    if (showOAuthDialog && oauthStep === 'input') {
      // Reset loading state when the input step is shown
      setLoading(false);
      
      // Try to automatically paste from clipboard after a short delay
      const timer = setTimeout(() => {
        handlePasteFromClipboard();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [showOAuthDialog, oauthStep]);

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
              
              <div className="space-y-4 mt-6">
                {/* Target Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="My Backup Target"
                  />
                </div>
                
                {/* Target Type */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as any);
                      setConfig({});
                      setEmoji(getDefaultEmoji(e.target.value as any));
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="local">Local Directory</option>
                    <option value="sftp">SFTP Server</option>
                    <option value="smb">SMB/CIFS Share</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="google_drive">Google Drive</option>
                  </select>
                </div>
                
                {/* Target Emoji */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Emoji
                  </label>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setShowEmojiSelector(true)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      {emoji ? (
                        <span className="text-2xl mr-2">{emoji}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">Select Emoji</span>
                      )}
                      {emoji && 'Change'}
                    </button>
                  </div>
                </div>
                
                {/* Target Configuration */}
                {type === 'local' && (
                  <div>
                    <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Path
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="flex-1 min-w-0 block w-full rounded-none rounded-l-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:ring-primary-500"
                        placeholder="/path/to/backup/directory"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFileExplorer(true)}
                        className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                )}
                
                {type === 'sftp' && (
                  <>
                    <div>
                      <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Host
                      </label>
                      <input
                        type="text"
                        id="host"
                        value={config.host || ''}
                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="sftp.example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Port
                      </label>
                      <input
                        type="number"
                        id="port"
                        value={config.port || 22}
                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="22"
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={config.username || ''}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={config.password || ''}
                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Path
                      </label>
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="flex-1 min-w-0 block w-full rounded-none rounded-l-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:ring-primary-500"
                        placeholder="/path/to/backup/directory"
                      />
                    </div>
                  </>
                )}
                
                {type === 'smb' && (
                  <>
                    <div>
                      <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Host
                      </label>
                      <input
                        type="text"
                        id="host"
                        value={config.host || ''}
                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="server.example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="share" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Share
                      </label>
                      <input
                        type="text"
                        id="share"
                        value={config.share || ''}
                        onChange={(e) => setConfig({ ...config, share: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="backup"
                      />
                    </div>
                    <div>
                      <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Domain (Optional)
                      </label>
                      <input
                        type="text"
                        id="domain"
                        value={config.domain || ''}
                        onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="WORKGROUP"
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={config.username || ''}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={config.password || ''}
                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Path (Optional)
                      </label>
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="flex-1 min-w-0 block w-full rounded-none rounded-l-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:ring-primary-500"
                        placeholder="path/within/share"
                      />
                    </div>
                  </>
                )}
                
                {type === 'dropbox' && (
                  <>
                    <div>
                      <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client ID
                      </label>
                      <input
                        type="text"
                        id="clientId"
                        value={config.clientId || ''}
                        onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="Dropbox App Key"
                      />
                    </div>
                    <div>
                      <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        id="clientSecret"
                        value={config.clientSecret || ''}
                        onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="Dropbox App Secret"
                      />
                    </div>
                    <div>
                      <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Path
                      </label>
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:ring-primary-500"
                        placeholder="BackupPro"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleOAuthInstructions()}
                        className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <InformationCircleIcon className="h-5 w-5 mr-1" />
                        {showOAuthInstructions ? 'Hide OAuth Instructions' : 'Show OAuth Instructions'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => initiateOAuth('dropbox')}
                        disabled={!config.clientId || !config.clientSecret || loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Connecting...' : 'Connect to Dropbox'}
                      </button>
                    </div>
                    {renderOAuthInstructions()}
                    {oauthStatus === 'success' && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-green-800 dark:text-green-300 text-sm">
                        Successfully connected to Dropbox!
                      </div>
                    )}
                    {oauthStatus === 'error' && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-800 dark:text-red-300 text-sm">
                        Error connecting to Dropbox: {oauthError}
                      </div>
                    )}
                  </>
                )}
                
                {type === 'google_drive' && (
                  <>
                    <div>
                      <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client ID
                      </label>
                      <input
                        type="text"
                        id="clientId"
                        value={config.clientId || ''}
                        onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="Google OAuth Client ID"
                      />
                    </div>
                    <div>
                      <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        id="clientSecret"
                        value={config.clientSecret || ''}
                        onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="Google OAuth Client Secret"
                      />
                    </div>
                    <div>
                      <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Path (Folder in Google Drive)
                      </label>
                      <input
                        type="text"
                        id="path"
                        value={config.path || ''}
                        onChange={(e) => setConfig({ ...config, path: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:ring-primary-500"
                        placeholder="BackupPro"
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Folder will be created if it doesn't exist
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleOAuthInstructions()}
                        className="inline-flex items-center text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <InformationCircleIcon className="h-5 w-5 mr-1" />
                        {showOAuthInstructions ? 'Hide OAuth Instructions' : 'Show OAuth Instructions'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => initiateOAuth('google_drive')}
                        disabled={!config.clientId || !config.clientSecret || loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Connecting...' : 'Connect to Google Drive'}
                      </button>
                    </div>
                    {renderOAuthInstructions()}
                    {oauthStatus === 'success' && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-green-800 dark:text-green-300 text-sm">
                        Successfully connected to Google Drive!
                      </div>
                    )}
                    {oauthStatus === 'error' && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-800 dark:text-red-300 text-sm">
                        Error connecting to Google Drive: {oauthError}
                      </div>
                    )}
                  </>
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
      
      {/* OAuth Dialog */}
      <Dialog
        open={showOAuthDialog}
        onClose={() => setShowOAuthDialog(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-md w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                {oauthService === 'dropbox' ? 'Connect to Dropbox' : 'Connect to Google Drive'}
              </Dialog.Title>
              <button
                type="button"
                onClick={() => setShowOAuthDialog(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            <div className="p-6">
              {oauthStep === 'instructions' && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {oauthService === 'dropbox' 
                      ? 'A popup window has opened for you to authorize Dropbox. Please complete the authorization process in that window.'
                      : 'A popup window has opened for you to authorize Google Drive. Please complete the authorization process in that window.'}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span>Open the popup window</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span>Log in to your {oauthService === 'dropbox' ? 'Dropbox' : 'Google'} account</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span>Authorize the application</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin mr-2" />
                      <span>Wait for the authorization to complete...</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        // Close the OAuth window if it's still open
                        if (oauthWindow && !oauthWindow.closed) {
                          oauthWindow.close();
                        }
                        setShowOAuthDialog(false);
                      }}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setOAuthStep('input')}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      I've Completed These Steps
                    </button>
                  </div>
                </div>
              )}
              
              {oauthStep === 'input' && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {oauthService === 'dropbox'
                      ? 'Please paste the URL from the Dropbox authorization page:'
                      : 'Please paste the URL from the Google authorization page:'}
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="redirect-url" className="sr-only">Redirect URL</label>
                      <input
                        type="text"
                        id="redirect-url"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        placeholder="Paste the URL here..."
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="inline-flex w-full justify-center items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <ClipboardIcon className="h-5 w-5 mr-2" />
                      Paste from Clipboard
                    </button>
                  </div>
                  
                  {oauthError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                      <p className="text-sm text-red-700 dark:text-red-400">{oauthError}</p>
                    </div>
                  )}
                  
                  {oauthStatus === 'success' && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Authentication successful! Creating {oauthService === 'dropbox' ? 'Dropbox' : 'Google Drive'} target...
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setOAuthStep('instructions')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Back
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleOAuthRedirectSubmit}
                      disabled={!redirectUrl || loading}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      {/* Emoji Selector Dialog */}
      <Dialog
        open={showEmojiSelector}
        onClose={() => setShowEmojiSelector(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-md w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl border dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                Select Emoji
              </Dialog.Title>
              <button
                onClick={() => setShowEmojiSelector(false)}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <EmojiSelector 
                value={emoji}
                onChange={(newEmoji) => {
                  setEmoji(newEmoji);
                  setShowEmojiSelector(false);
                }}
                defaultEmoji={type}
              />
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      {/* File Explorer Dialog */}
      {showFileExplorer && (
        <Dialog
          open={showFileExplorer}
          onClose={() => setShowFileExplorer(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/30 dark:bg-black/70" aria-hidden="true" />
          
          <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
            <Dialog.Panel className="mx-auto max-w-3xl w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl border dark:border-gray-700">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                  Select Directory
                </Dialog.Title>
                <button
                  onClick={() => setShowFileExplorer(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                <FileExplorer 
                  onSelect={(path) => {
                    handlePathSelect(path);
                    setShowFileExplorer(false);
                  }}
                  initialPath="/"
                  showFiles={false}
                />
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </>
  );
} 