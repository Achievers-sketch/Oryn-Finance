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