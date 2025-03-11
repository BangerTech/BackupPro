import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = {
  /**
   * Middleware to verify JWT token and attach user to request
   */
  verifyToken: (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
      }
      
      // Extract token
      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = authService.verifyToken(token);
      
      // Attach user to request
      req.user = decoded;
      
      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
  },
  
  /**
   * Middleware to check if user is an admin
   */
  isAdmin: (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    
    next();
  }
}; 