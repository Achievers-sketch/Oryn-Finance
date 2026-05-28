const redis = require('redis');
const logger = require('../config/logger');

class RedisAdapter {
  constructor() {
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.publisher = redis.createClient({ url: redisUrl });
      this.subscriber = redis.createClient({ url: redisUrl });

      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect()
      ]);

      this.subscriber.on('message', (channel, message) => {
        this.handleMessage(channel, message);
      });

      this.isConnected = true;
      logger.info('Redis adapter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis adapter:', error);
      throw error;
    }
  }

  async publish(channel, data) {
    if (!this.isConnected) return;
    
    try {
      const message = JSON.stringify({
        ...data,
        instanceId: process.env.INSTANCE_ID || 'default',
        timestamp: Date.now()
      });
      
      await this.publisher.publish(channel, message);
    } catch (error) {
      logger.error('Redis publish error:', error);
    }
  }

  async subscribe(channel, handler) {
    if (!this.isConnected) return;
    
    try {
      this.messageHandlers.set(channel, handler);
      await this.subscriber.subscribe(channel);
    } catch (error) {
      logger.error('Redis subscribe error:', error);
    }
  }

  handleMessage(channel, message) {
    try {
      const data = JSON.parse(message);
      
      // Skip messages from same instance
      if (data.instanceId === (process.env.INSTANCE_ID || 'default')) {
        return;
      }

      const handler = this.messageHandlers.get(channel);
      if (handler) {
        handler(data);
      }
    } catch (error) {
      logger.error('Redis message handling error:', error);
    }
  }

  /* ============================================================
     CACHING LAYER METHODS (Issue #96)
     ============================================================ */

  /**
   * Get cached value from Redis
   */
  async get(key) {
    if (!this.isConnected) return null;
    try {
      const data = await this.publisher.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch (parseError) {
        return data; // Return raw string if JSON parsing fails
      }
    } catch (error) {
      logger.error(`Redis cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cache value with TTL in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isConnected) return false;
    try {
      const stringifiedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await this.publisher.set(key, stringifiedValue, {
        EX: ttlSeconds
      });
      return true;
    } catch (error) {
      logger.error(`Redis cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete specific cache key
   */
  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.publisher.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern (e.g. 'market:*')
   */
  async clearPattern(pattern) {
    if (!this.isConnected) return false;
    try {
      let cursor = 0;
      let deletedCount = 0;
      
      do {
        const reply = await this.publisher.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = reply.cursor;
        const keys = reply.keys;
        
        if (keys && keys.length > 0) {
          await this.publisher.del(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== 0);
      
      logger.info(`Cleared ${deletedCount} cache keys matching pattern ${pattern}`);
      return true;
    } catch (error) {
      logger.error(`Redis clearPattern error for pattern ${pattern}:`, error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.publisher) await this.publisher.disconnect();
      if (this.subscriber) await this.subscriber.disconnect();
      this.isConnected = false;
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }
}

module.exports = new RedisAdapter();