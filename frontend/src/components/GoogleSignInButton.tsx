'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function GoogleSignInButton() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configNeeded, setConfigNeeded] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Check if Google OAuth is configured
  const checkConfig = async () => {
    try {
      const response = await api.get('/oauth/config');
      if (!response.google?.configured) {
        setConfigNeeded(true);
      }
    } catch (error) {
      console.error('Failed to check OAuth configuration:', error);
      setError('Failed to check OAuth configuration');
    }
  };

  // Initialize component
  useEffect(() => {
    checkConfig();
  }, []);

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Generate a random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('oauth_state', state);

      // Get client ID from environment or localStorage
      const googleClientId = clientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
      
      if (!googleClientId) {
        setConfigNeeded(true);
        setIsLoading(false);
        return;
      }

      // Google OAuth parameters
      const googleOAuthParams = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: `${window.location.origin}/oauth/google/callback`,
        response_type: 'code',
        scope: 'email profile',
        state,
        prompt: 'select_account',
        access_type: 'offline'
      });

      // Store client credentials in localStorage for the callback
      localStorage.setItem('google_client_id', clientId);
      localStorage.setItem('google_client_secret', clientSecret);

      // Redirect to Google OAuth
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${googleOAuthParams.toString()}`;
    } catch (error) {
      console.error('Google Sign In error:', error);
      setError('Failed to initiate Google Sign In');
    } finally {
      setIsLoading(false);
    }
  };

  // Save OAuth configuration
  const saveConfig = async () => {
    try {
      setIsLoading(true);
      
      // Store client credentials in localStorage
      localStorage.setItem('google_client_id', clientId);
      localStorage.setItem('google_client_secret', clientSecret);
      
      setConfigNeeded(false);
      setShowConfig(false);
      
      // You can also save these to the server if needed
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setError('Failed to save configuration');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-red-700 dark:text-red-300 text-sm w-full">
          {error}
        </div>
      )}
      
      {configNeeded && !showConfig ? (
        <div className="text-center">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Google Sign In needs to be configured first.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Configure Google Sign In
          </button>
        </div>
      ) : showConfig ? (
        <div className="w-full max-w-md p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
            Configure Google Sign In
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter your Google Client ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter your Google Client Secret"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={!clientId || !clientSecret || isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full max-w-xs"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      )}
    </div>
  );
} 