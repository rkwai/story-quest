import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../db/models/User';

interface DecodedToken {
  id: number;
  iat: number;
  exp: number;
}

interface AuthRequest extends Request {
  user?: User;
}

/**
 * Middleware to protect routes that require authentication
 */
export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;

      // Get user from token
      const user = await User.findByPk(decoded.id);

      if (!user) {
        res.status(401).json({ error: 'Not authorized, user not found' });
        return;
      }

      // Store user in request
      req.user = user;

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

/**
 * Middleware to restrict routes to admin users
 */
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized, admin access required' });
  }
};

export default { protect, adminOnly }; 