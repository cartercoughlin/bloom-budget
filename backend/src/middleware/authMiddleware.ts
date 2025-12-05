import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Middleware to validate JWT token and attach user to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.accessToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token
    const payload = AuthService.verifyToken(token);

    // Attach user to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Token has expired') {
        res.status(401).json({ error: 'Token has expired' });
        return;
      }
      if (error.message === 'Invalid token') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.accessToken;

    if (token) {
      const payload = AuthService.verifyToken(token);
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  next();
};

/**
 * Session timeout tracking middleware
 * Tracks last activity time and enforces 15-minute timeout
 */
const sessionStore = new Map<string, number>();
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export const sessionTimeout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    next();
    return;
  }

  const userId = req.user.userId;
  const now = Date.now();
  const lastActivity = sessionStore.get(userId);

  // Check if session has timed out
  if (lastActivity && now - lastActivity > SESSION_TIMEOUT) {
    sessionStore.delete(userId);
    res.status(401).json({ error: 'Session has timed out due to inactivity' });
    return;
  }

  // Update last activity time
  sessionStore.set(userId, now);
  next();
};

/**
 * Clear session on logout
 */
export const clearSession = (userId: string): void => {
  sessionStore.delete(userId);
};
