"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function OAuthCallbackPage({ params }: { params: { provider: string } }) {
  const router = useRouter();
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
        
        // Verify state to prevent CSRF attacks
        const storedState = localStorage.getItem('oauth_state');
        if (!state || !storedState || state !== storedState) {
          throw new Error('Invalid state parameter');
        }
        
        // Clear the stored state
        localStorage.removeItem('oauth_state');
        
        // Get client credentials from localStorage
        const clientId = localStorage.getItem(`${provider}_client_id`);
        const clientSecret = localStorage.getItem(`${provider}_client_secret`);
        
        if (!clientId || !clientSecret) {
          throw new Error('OAuth credentials not found. Please try connecting again.');
        }
        
        // Exchange the code for a token
        const response = await api.post('/oauth/token', {
          code,
          provider,
          redirectUri: `${window.location.origin}/oauth/${provider}/callback`,
          clientId,
          clientSecret
        });
        
        // Store the token
        localStorage.setItem(`${provider}_token`, response.data.accessToken);
        
        // Update status
        setStatus('success');
        
        // Redirect back to the targets page after a short delay
        setTimeout(() => {
          router.push('/targets');
        }, 2000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to authenticate');
      }
    };
    
    handleOAuthCallback();
  }, [provider, router]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
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
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Redirecting you back to create your backup target...
            </p>
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
            <button
              onClick={() => router.push('/targets')}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              Return to Targets
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 