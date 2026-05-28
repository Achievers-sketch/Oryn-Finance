const redisAdapter = require('./redisAdapter');
const logger = require('../config/logger');

class CacheService {
  constructor() {
    this.DEFAULT_TTL = 300; // 5 minutes in seconds
    this.SHORT_TTL = 60;    // 1 minute in seconds
    this.LONG_TTL = 3600;   // 1 hour in seconds
  }

  /**
   * Helper to generate standardized cache keys
   */
  getKeys = {
    allMarkets: () => 'market:all',
    trendingMarkets: () => 'market:trending',
    marketDetail: (marketId) => `market:detail:${marketId}`,
    marketHistory: (marketId) => `market:history:${marketId}`,
    marketTrades: (marketId) => `market:trades:${marketId}`,
    categoryMarkets: (category) => `market:category:${category}`,
    userPositions: (walletAddress) => `user:positions:${walletAddress.toLowerCase()}`
  };

  /**
   * Safe wrapper to retrieve cached data
   */
  async get(key) {
    try {
      if (!redisAdapter.isConnected) return null;
      return await redisAdapter.get(key);
    } catch (error) {
      logger.error(`CacheService get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Safe wrapper to write to cache
   */
  async set(key, value, ttlSeconds = this.DEFAULT_TTL) {
    try {
      if (!redisAdapter.isConnected) return false;
      return await redisAdapter.set(key, value, ttlSeconds);
    } catch (error) {
      logger.error(`CacheService set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Evict single key
   */
  async evict(key) {
    try {
      if (!redisAdapter.isConnected) return false;
      logger.info(`Cache eviction: ${key}`);
      return await redisAdapter.del(key);
    } catch (error) {
      logger.error(`CacheService evict error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate a single market's detail and index lists
   */
  async invalidateMarket(marketId, category = null) {
    try {
      if (!redisAdapter.isConnected) return;
      
      const keysToEvict = [
        this.getKeys.marketDetail(marketId),
        this.getKeys.marketHistory(marketId),
        this.getKeys.marketTrades(marketId),
        this.getKeys.allMarkets(),
        this.getKeys.trendingMarkets()
      ];

      if (category) {
        keysToEvict.push(this.getKeys.categoryMarkets(category));
      }

      await Promise.all(keysToEvict.map(key => this.evict(key)));
      
      // Clear category patterns dynamically as a fallback
      await redisAdapter.clearPattern('market:category:*');
      logger.info(`Cache invalidated successfully for market ${marketId}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for market ${marketId}:`, error);
    }
  }

  /**
   * Invalidate all markets and lists (bulk refresh trigger)
   */
  async invalidateAllMarkets() {
    try {
      if (!redisAdapter.isConnected) return;
      await redisAdapter.clearPattern('market:*');
      logger.info('Bulk market cache eviction triggered');
    } catch (error) {
      logger.error('Failed to execute bulk market cache eviction:', error);
    }
  }

  /**
   * Auto-refresh cache with fresh active markets (Cache warming / Consistency)
   */
  async refreshActiveMarketsCache() {
    try {
      const { Market } = require('../models');
      if (!Market) return;

      logger.info('Auto-warming active markets cache...');

      // Get active markets from MongoDB
      const activeMarkets = await Market.find({ status: 'active' })
        .sort({ totalVolume: -1 })
        .limit(100)
        .lean();

      if (activeMarkets && activeMarkets.length > 0) {
        await this.set(this.getKeys.allMarkets(), activeMarkets, this.DEFAULT_TTL);
        
        // Cache top 10 as trending
        const trending = activeMarkets.slice(0, 10);
        await this.set(this.getKeys.trendingMarkets(), trending, this.DEFAULT_TTL);
        
        // Cache individual details
        await Promise.all(
          activeMarkets.map(market => 
            this.set(this.getKeys.marketDetail(market.marketId), market, this.DEFAULT_TTL)
          )
        );

        logger.info(`Auto-warmed cache with ${activeMarkets.length} active markets`);
      }
    } catch (error) {
      logger.error('Error warming active markets cache:', error);
    }
  }
}

module.exports = new CacheService();
