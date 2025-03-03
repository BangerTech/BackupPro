import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

const router = Router();

// OAuth configuration
const OAUTH_CONFIG = {
  dropbox: {
    clientId: process.env.DROPBOX_CLIENT_ID || '',
    clientSecret: process.env.DROPBOX_CLIENT_SECRET || '',
    tokenUrl: 'https://api.dropbox.com/oauth2/token',
  },
  google_drive: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  }
};

// Exchange authorization code for access token
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { code, provider, redirectUri, clientId, clientSecret } = req.body;
    
    if (!code || !provider || !redirectUri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (!['dropbox', 'google_drive'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    // Check if OAuth credentials are provided
    if (!clientId || !clientSecret) {
      return res.status(400).json({ 
        error: 'Missing OAuth credentials', 
        message: 'Client ID and Client Secret are required' 
      });
    }
    
    let tokenResponse;
    let tokenData;
    
    if (provider === 'dropbox') {
      // Exchange code for Dropbox token
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('grant_type', 'authorization_code');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      
      tokenResponse = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
    } else if (provider === 'google_drive') {
      // Exchange code for Google token
      tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })
      });
    }
    
    if (!tokenResponse || !tokenResponse.ok) {
      const errorText = await tokenResponse?.text();
      logger.error(`OAuth token exchange error: ${errorText}`);
      throw new Error(`Failed to obtain access token: ${errorText || 'Unknown error'}`);
    }
    
    tokenData = await tokenResponse.json();
    
    // Return the access token to the client
    res.json({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (error: unknown) {
    logger.error('OAuth token exchange error:', error);
    
    // Handle specific error responses from OAuth providers
    if (error instanceof Error) {
      return res.status(500).json({
        error: 'OAuth authentication failed',
        message: error.message
      });
    }
    
    res.status(500).json({ error: 'Failed to authenticate with provider' });
  }
});

export { router as oauthRoutes }; 