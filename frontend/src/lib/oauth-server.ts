// Ensure this code only runs in the browser
const isBrowser = typeof window !== 'undefined';

interface OAuthServerOptions {
  provider: 'dropbox' | 'google_drive';
  clientId: string;
  clientSecret: string;
  onSuccess: (accessToken: string) => void;
  onError: (error: Error) => void;
}

class OAuthServer {
  private provider: string = '';
  private clientId: string = '';
  private clientSecret: string = '';
  private onSuccess: (accessToken: string) => void = () => {};
  private onError: (error: Error) => void = () => {};
  private popupWindow: Window | null = null;
  private checkInterval: number | null = null;

  async start(options: OAuthServerOptions): Promise<string> {
    // Ensure we're in a browser environment
    if (!isBrowser) {
      throw new Error('OAuth server can only be started in a browser environment');
    }

    this.provider = options.provider;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;

    // Generate a random state to prevent CSRF
    const state = `${this.provider}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Store state in localStorage to verify when we return
    localStorage.setItem('oauth_state', state);
    
    // Store client credentials in localStorage for the OAuth callback
    localStorage.setItem(`${this.provider}_client_id`, this.clientId);
    localStorage.setItem(`${this.provider}_client_secret`, this.clientSecret);

    // Set up message listener for the popup window
    this.setupMessageListener();

    // Always use localhost for the redirect URI, regardless of how the user is accessing the app
    // This works because we're using a popup and postMessage for communication
    const redirectUri = `http://localhost:3000/oauth/${this.provider}/callback`;
    
    return redirectUri;
  }

  openAuthWindow(authUrl: string) {
    // Open the OAuth URL in a new window
    this.popupWindow = window.open(authUrl, 'oauth-popup', 'width=800,height=600');
    
    if (!this.popupWindow) {
      this.onError(new Error('Failed to open popup window. Please check your popup blocker settings.'));
      return;
    }
    
    // Check if the popup is closed
    this.checkInterval = window.setInterval(() => {
      if (this.popupWindow && this.popupWindow.closed) {
        this.cleanup();
      }
    }, 500);
  }

  private setupMessageListener() {
    // Listen for messages from the popup window
    const messageHandler = (event: MessageEvent) => {
      // Verify the origin
      if (event.origin !== window.location.origin) {
        return;
      }
      
      // Check if the message is from our OAuth callback
      if (event.data && event.data.type === 'oauth-callback') {
        const { success, accessToken, error } = event.data;
        
        if (success && accessToken) {
          // Store the token
          localStorage.setItem(`${this.provider}_token`, accessToken);
          
          // Call success callback
          this.onSuccess(accessToken);
        } else if (error) {
          // Call error callback
          this.onError(new Error(error));
        }
        
        // Cleanup
        this.cleanup();
      }
    };
    
    // Add event listener
    window.addEventListener('message', messageHandler);
    
    // Store the handler to remove it later
    (this as any).messageHandler = messageHandler;
  }

  private cleanup() {
    // Clear the check interval
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Remove the message listener
    if ((this as any).messageHandler) {
      window.removeEventListener('message', (this as any).messageHandler);
      (this as any).messageHandler = null;
    }
    
    // Close the popup window if it's still open
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
      this.popupWindow = null;
    }
  }

  stop() {
    this.cleanup();
  }
}

// Singleton instance
export const oauthServer = new OAuthServer(); 