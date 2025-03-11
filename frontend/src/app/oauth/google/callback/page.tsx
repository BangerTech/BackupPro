"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function GoogleCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

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
        
        // Exchange the code for a token
        await login(code, `${window.location.origin}/oauth/google/callback`);
        
        // Update status
        setStatus('success');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to authenticate');
        
        // Redirect to home page after a longer delay
        setTimeout(() => {
          router.push('/');
        }, 5000);
      }
    };
    
    handleOAuthCallback();
  }, [login, router]);

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
              You have successfully signed in with Google.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Redirecting to dashboard...
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
              {error || 'There was a problem signing in with Google.'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Redirecting to home page...
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 