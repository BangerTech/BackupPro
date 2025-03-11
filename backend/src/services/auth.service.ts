import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const userRepository = AppDataSource.getRepository(User);

// Standardwert für JWT Secret
const JWT_SECRET = 'backup-scheduler-default-secret-key';
const JWT_EXPIRES_IN = '7d';

export const authService = {
  /**
   * Find or create a user based on Google profile information
   */
  async findOrCreateGoogleUser(profile: any): Promise<User> {
    try {
      // Check if user already exists
      let user = await userRepository.findOne({ where: { email: profile.email } });
      
      if (!user) {
        // Create new user if not exists
        user = new User();
        user.email = profile.email;
        user.googleId = profile.id;
        user.isAdmin = false; // Default to non-admin
        
        // Check if this is the first user and make them admin
        const userCount = await userRepository.count();
        if (userCount === 0) {
          logger.info(`First user ${profile.email} is being created as admin`);
          user.isAdmin = true;
        }
      }
      
      // Update user information
      user.name = profile.name;
      user.picture = profile.picture;
      
      // Save user
      await userRepository.save(user);
      return user;
    } catch (error) {
      logger.error('Error finding or creating Google user:', error);
      throw error;
    }
  },
  
  /**
   * Generate JWT token for a user
   */
  generateToken(user: User): string {
    try {
      const payload = {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      };
      
      // Einfache Signierung mit festem Secret
      return jwt.sign(payload, JWT_SECRET);
    } catch (error) {
      logger.error('Error generating token:', error);
      throw error;
    }
  },
  
  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.error('Error verifying token:', error);
      throw error;
    }
  }
}; 