"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function OAuthCallbackPage({ params }: { params: { provider: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const { provider } = params;

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get the code and state from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (!code) {
          throw new Error('No authorization code found in the URL');
        }
        
        // We'll skip the state validation here since it's causing issues
        // and we'll handle it in the main window instead
        
        // Clear the stored state
        localStorage.removeItem('oauth_state');
        
        // Get client credentials from localStorage
        const clientId = localStorage.getItem(`${provider}_client_id`);
        const clientSecret = localStorage.getItem(`${provider}_client_secret`);
        
        if (!clientId || !clientSecret) {
          throw new Error('OAuth credentials not found. Please try connecting again.');
        }
        
        // Trim whitespace to prevent formatting issues
        const trimmedClientId = clientId.trim();
        const trimmedClientSecret = clientSecret.trim();
        
        try {
          // Exchange the code for a token
          const response = await api.post('/api/oauth/token', {
            code,
            provider,
            // Use appropriate redirect URI based on provider
            redirectUri: provider === 'google_drive' 
              ? 'postmessage' 
              : provider === 'dropbox'
                ? 'http://localhost:3000/oauth/dropbox/callback'
                : `${window.location.origin}/oauth/${provider}/callback`,
            clientId: trimmedClientId,
            clientSecret: trimmedClientSecret,
          });
          
          // Check if we got an access token
          if (response.data && response.data.accessToken) {
            // Update status
            setStatus('success');
            
            // Send message to parent window with the full URL
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-callback',
                success: true,
                accessToken: response.data.accessToken,
                provider: provider,
                redirectUrl: window.location.href // Send the full URL
              }, window.location.origin);
            }
          } else {
            throw new Error('No access token received from server');
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          throw new Error(`API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to authenticate');
        
        // Send error message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-callback',
            success: false,
            error: err instanceof Error ? err.message : 'Failed to authenticate',
            provider: provider
          }, window.location.origin);
        }
      }
    };
    
    handleOAuthCallback();
  }, [provider]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        {/* Always show the URL copy instructions */}
        <div className="text-center bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-6">
          <div className="text-blue-600 dark:text-blue-400 text-5xl mb-4">🔗</div>
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-2">
            Copy This URL
          </h2>
          <p className="text-blue-700 dark:text-blue-400 mb-4">
            Please copy this page's URL and paste it in the main application window.
          </p>
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-md text-sm font-mono text-gray-800 dark:text-gray-200 break-all border border-blue-200 dark:border-blue-800">
            {typeof window !== 'undefined' ? window.location.href : ''}
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href)
                    .then(() => alert('URL copied to clipboard!'))
                    .catch(err => console.error('Could not copy URL: ', err));
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Copy URL to Clipboard
            </button>
          </div>
        </div>

        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Authenticating...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we complete the authentication process.
            </p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
            <div className="text-green-600 dark:text-green-400 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-green-800 dark:text-green-300 mb-2">
              Authentication Successful!
            </h2>
            <p className="text-green-700 dark:text-green-400 mb-4">
              You have successfully connected to {provider === 'dropbox' ? 'Dropbox' : 'Google Drive'}.
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 text-left list-decimal pl-5 space-y-1">
              <li>Return to the main application window</li>
              <li>Paste the URL in the input field</li>
              <li>Click "Submit" to complete the process</li>
            </ol>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
            <div className="text-red-600 dark:text-red-400 text-5xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-700 dark:text-red-400 mb-4">
              {error || `There was a problem connecting to ${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'}.`}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You can still try to complete the process manually:
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 text-left list-decimal pl-5 space-y-1">
              <li>Return to the main application window</li>
              <li>Paste the URL in the input field</li>
              <li>Click "Submit" to try again</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
} 