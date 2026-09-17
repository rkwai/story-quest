import jwt from 'jsonwebtoken';
import User from '../../shared/db/models/User';
import { SignOptions } from 'jsonwebtoken';

/**
 * Auth Service - Handles business logic for authentication
 */
export class AuthService {
  /**
   * Generate JWT token
   * @param id User ID
   * @returns JWT token
   */
  generateToken(id: number): string {
    const payload = { id };
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
    const options = { expiresIn: '7d' };
    
    // @ts-ignore - Ignore TypeScript errors for this line
    return jwt.sign(payload, secret, options);
  }

  /**
   * Find user by email
   * @param email User email
   * @returns User or null
   */
  async findUserByEmail(email: string): Promise<any> {
    return await User.findOne({ where: { email } });
  }

  /**
   * Create a new user
   * @param userData User data
   * @returns Created user
   */
  async createUser(userData: { username: string; email: string; password: string }): Promise<any> {
    const user = User.build({
      username: userData.username,
      email: userData.email,
      password_hash: '',
      role: 'player'
    });
    
    user.password = userData.password;
    
    return await user.save();
  }

  /**
   * Update user profile
   * @param user User object
   * @param userData User data to update
   * @returns Updated user
   */
  async updateUserProfile(user: any, userData: { username?: string; email?: string; password?: string }): Promise<any> {
    if (userData.username) user.username = userData.username;
    if (userData.email) user.email = userData.email;
    if (userData.password) user.password = userData.password;

    await user.save();
    return user;
  }
} 