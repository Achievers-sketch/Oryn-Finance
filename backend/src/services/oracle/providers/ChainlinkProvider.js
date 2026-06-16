/**
 * ChainlinkProvider
 * 
 * Oracle provider for Chainlink price feeds.
 * Integrates with Chainlink VRF and price feed contracts on Stellar.
 */

const BaseOracleProvider = require('../BaseOracleProvider');
const logger = require('../../../config/logger');

class ChainlinkProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'chainlink';
    this.timeout = config.timeout || 10000;
    this.feedCache = new Map();
    this.cacheDuration = config.cacheDuration || 1 * 60 * 1000; // 1 minute
    this.feedRegistry = new Map(); // feedAddress -> metadata
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: '1.0.0',
      displayName: 'Chainlink',
      description: 'Decentralized oracle data from Chainlink network',
      weight: this.defaultWeight,
      supportedMarketTypes: this.getSupportedMarketTypes(),
      capabilities: this.getCapabilities(),
      status: 'BETA - Implementation pending for Stellar'
    };
  }

  /**
   * Get supported market types
   */
  getSupportedMarketTypes() {
    return ['crypto', 'forex', 'commodities', 'generic'];
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      supportsMultipleConditions: true,
      supportsPriceData: true,
      supportsHistoricalData: true,
      requiresApiKey: false,
      supportedConditions: ['above', 'below', 'equals'],
      supportedAssets: 'Chainlink supported price feeds',
      onChainVerification: true,
      decentralized: true
    };
  }

  /**
   * Validate market configuration for Chainlink
   */
  validateConfig(market) {
    const baseValidation = super.validateConfig(market);
    const errors = baseValidation.errors;
    const config = market.oracleConfig || {};

    if (!config.feedAddress) {
      errors.push('Missing feedAddress in oracleConfig');
    }

    if (!config.targetValue && config.targetValue !== 0) {
      errors.push('Missing targetValue in oracleConfig');
    }

    if (!['above', 'below', 'equals'].includes(config.operator)) {
      errors.push(`Invalid operator: ${config.operator}. Must be 'above', 'below', or 'equals'`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Resolve market using Chainlink price feed
   */
  async resolve(market) {
    try {
      const config = market.oracleConfig || {};
      const { feedAddress, targetValue, operator } = config;

      // Validate configuration
      const validation = this.validateConfig(market);
      if (!validation.valid) {
        logger.oracle('Invalid Chainlink config', {
          marketId: market.marketId,
          errors: validation.errors
        });
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }

      logger.oracle('Chainlink oracle resolution initiated', {
        marketId: market.marketId,
        feedAddress,
        targetValue,
        operator
      });

      // Fetch latest round data from Chainlink feed
      const feedData = await this.fetchFeedData(feedAddress);

      if (!feedData) {
        logger.oracle('Failed to fetch Chainlink feed data', {
          feedAddress,
          marketId: market.marketId
        });
        throw new Error(`Failed to fetch data from feed ${feedAddress}`);
      }

      // Check data freshness
      if (!this.isDataFresh(feedData)) {
        logger.oracle('Chainlink data is stale', {
          feedAddress,
          age: Date.now() - feedData.timestamp,
          marketId: market.marketId
        });
        throw new Error('Chainlink data is stale');
      }

      // Determine outcome based on operator
      let outcome;
      const currentValue = feedData.value;

      switch (operator) {
        case 'above':
          outcome = currentValue > targetValue ? 'yes' : 'no';
          break;
        case 'below':
          outcome = currentValue < targetValue ? 'yes' : 'no';
          break;
        case 'equals': {
          const tolerance = targetValue * 0.01;
          outcome = Math.abs(currentValue - targetValue) <= tolerance ? 'yes' : 'no';
          break;
        }
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }

      const confidence = this.calculateConfidence(feedData);

      logger.oracle('Chainlink oracle resolved', {
        marketId: market.marketId,
        feedAddress,
        currentValue,
        targetValue,
        operator,
        outcome,
        confidence: confidence.toFixed(2)
      });

      return {
        outcome,
        confidence,
        data: {
          currentValue,
          targetValue,
          operator,
          feedAddress,
          source: 'Chainlink',
          roundId: feedData.roundId,
          timestamp: feedData.timestamp,
          aggregator: feedData.aggregator,
          answeredInRound: feedData.answeredInRound,
          onChainVerifiable: true
        }
      };
    } catch (error) {
      logger.error('Chainlink oracle resolution failed', {
        error: error.message,
        marketId: market.marketId
      });
      throw error;
    }
  }

  /**
   * Fetch latest round data from Chainlink feed
   * 
   * This is a placeholder that demonstrates the integration pattern.
   * In production, this would:
   * 1. Connect to Stellar Soroban contracts
   * 2. Call Chainlink price feed contract
   * 3. Parse latest round data
   */
  async fetchFeedData(feedAddress) {
    try {
      // Check cache first
      const cached = this.getFeedCache(feedAddress);
      if (cached) {
        return cached;
      }

      // In a real implementation:
      // 1. Use sorobanService to invoke contract
      // 2. Parse the price feed response
      // 3. Return { value, roundId, timestamp, aggregator, answeredInRound }

      logger.oracle('Chainlink feed fetch placeholder', {
        feedAddress,
        message: 'Requires Soroban contract integration'
      });

      // For now, return null to indicate not yet implemented
      return null;
    } catch (error) {
      logger.error('Failed to fetch Chainlink feed data', {
        feedAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if Chainlink data is fresh
   */
  isDataFresh(feedData, maxAge = 3600000) { // 1 hour default
    if (!feedData.timestamp) {
      return false;
    }

    const age = Date.now() - feedData.timestamp;
    return age <= maxAge;
  }

  /**
   * Calculate confidence from Chainlink data
   */
  calculateConfidence(feedData) {
    let confidence = 0.95; // Base confidence for Chainlink data

    // Reduce confidence if data is near max age
    const age = Date.now() - feedData.timestamp;
    if (age > 30 * 60 * 1000) { // 30 minutes
      confidence -= 0.1;
    }

    // Consider number of oracles that answered
    if (feedData.answeredInRound && feedData.roundId) {
      const oracleCount = parseInt(feedData.answeredInRound, 16);
      if (oracleCount < 5) {
        confidence -= 0.05;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get cached feed data
   */
  getFeedCache(feedAddress) {
    const cached = this.feedCache.get(feedAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    return null;
  }

  /**
   * Cache feed data
   */
  setCacheData(feedAddress, data) {
    this.feedCache.set(feedAddress, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Register a price feed
   */
  registerFeed(feedAddress, metadata) {
    this.feedRegistry.set(feedAddress, {
      ...metadata,
      registered: new Date().toISOString()
    });

    logger.oracle('Chainlink price feed registered', {
      feedAddress,
      metadata
    });
  }

  /**
   * Get registered feeds
   */
  getRegisteredFeeds() {
    return Array.from(this.feedRegistry.entries()).map(([address, meta]) => ({
      feedAddress: address,
      ...meta
    }));
  }

  /**
   * Verify on-chain proof
   */
  async verifyProof(marketId, resolution) {
    try {
      logger.oracle('Chainlink proof verification initiated', {
        marketId,
        message: 'Requires on-chain verification logic'
      });

      // In a real implementation:
      // 1. Call Soroban contract to verify
      // 2. Check cryptographic signatures
      // 3. Validate round data against latest blocks
      // 4. Return verification result

      return {
        verified: false,
        reason: 'On-chain verification not yet implemented for Stellar'
      };
    } catch (error) {
      logger.error('Proof verification failed', {
        marketId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reset provider state
   */
  resetHealth() {
    super.resetHealth();
    this.feedCache.clear();
  }
}

module.exports = ChainlinkProvider;
