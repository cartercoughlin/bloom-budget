import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create Redis client instance
 */
export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Redis: Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        // Exponential backoff: 100ms, 200ms, 400ms, etc.
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis: Connected successfully');
  });

  redisClient.on('reconnecting', () => {
    console.log('Redis: Reconnecting...');
  });

  redisClient.on('ready', () => {
    console.log('Redis: Ready to accept commands');
  });

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis: Failed to connect:', error);
    throw error;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis: Connection closed');
  }
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      const client = await getRedisClient();
      return await client.get(key);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const client = await getRedisClient();
      if (ttlSeconds) {
        await client.setEx(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  },

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  },

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.expire(key, ttlSeconds);
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
    }
  },
};
