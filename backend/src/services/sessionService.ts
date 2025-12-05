import { cache } from '../config/redis';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 15 * 60; // 15 minutes in seconds

interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
  lastActivity: number;
}

export class SessionService {
  /**
   * Create a new session
   */
  async createSession(userId: string, email: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionData: SessionData = {
      userId,
      email,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await cache.set(
      `${SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      SESSION_TTL
    );

    return sessionId;
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await cache.get(`${SESSION_PREFIX}${sessionId}`);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  /**
   * Update session activity timestamp and extend TTL
   */
  async refreshSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.lastActivity = Date.now();
    await cache.set(
      `${SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      SESSION_TTL
    );
  }

  /**
   * Delete a session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await cache.del(`${SESSION_PREFIX}${sessionId}`);
  }

  /**
   * Check if session exists and is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Check if session has expired (15 minutes of inactivity)
    const now = Date.now();
    const timeSinceLastActivity = now - session.lastActivity;
    const fifteenMinutes = 15 * 60 * 1000;

    return timeSinceLastActivity < fifteenMinutes;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Clean up expired sessions (can be called periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    // Redis automatically handles TTL expiration, so this is mainly for logging
    console.log('Session cleanup: Redis handles automatic expiration via TTL');
  }
}

export default new SessionService();
