'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function GoogleDriveCallback() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const [copied, setCopied] = useState(false);

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  useEffect(() => {
    // Send message to parent window if this is in a popup
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'oauth_callback',
          provider: 'google_drive',
          code,
          error,
          redirectUrl: window.location.href
        }, '*');
      } catch (e) {
        console.error('Failed to send message to opener:', e);
      }
    }
  }, [code, error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Google Drive Authorization
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {code ? (
            <div>
              <div className="rounded-md bg-green-50 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Authorization Successful
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Google Drive has been successfully authorized.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-md bg-red-50 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Authorization Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        {error || 'No authorization code was received from Google Drive.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Instructions
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p className="mb-2">
                      Please copy the URL from this page and paste it back into the application.
                    </p>
                    <div className="bg-blue-100 p-2 rounded-md text-xs font-mono overflow-x-auto whitespace-nowrap">
                      {typeof window !== 'undefined' ? window.location.href : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={copyUrlToClipboard}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {copied ? 'Copied!' : 'Copy URL to Clipboard'}
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-gray-600">
            <p>You can close this window after copying the URL.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 