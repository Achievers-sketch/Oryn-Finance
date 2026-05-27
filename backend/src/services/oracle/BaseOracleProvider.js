/**
 * BaseOracleProvider
 * 
 * Abstract base class for all oracle providers.
 * Defines the interface that all oracle providers must implement.
 * 
 * This enables a plugin-based architecture where new oracle sources
 * can be added without modifying core OracleService code.
 */

const logger = require('../../config/logger');

class BaseOracleProvider {
  /**
   * Initialize provider with configuration
   * @param {Object} config - Provider configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
    this.defaultWeight = config.weight || 0.5;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.timeout = config.timeout || 5000;
    
    // Health tracking
    this.health = {
      successCount: 0,
      failureCount: 0,
      lastFailure: null,
      isHealthy: true,
      failureRate: 0
    };
  }

  /**
   * Get provider metadata
   * @returns {Object} Provider information
   */
  getMetadata() {
    return {
      name: this.name,
      version: '1.0.0',
      weight: this.defaultWeight,
      supportedMarketTypes: this.getSupportedMarketTypes(),
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Resolve a market using this provider
   * Must be implemented by subclasses
   * 
   * @param {Object} market - Market data
   * @returns {Promise<Object>} Resolution result with structure:
   *   {
   *     outcome: 'yes'|'no',
   *     confidence: 0.0-1.0,
   *     data: {
   *       source: string,
   *       ...provider-specific data
   *     }
   *   }
   * @throws {Error} If resolution fails
   */
  async resolve(market) {
    throw new Error(`${this.name}.resolve() not implemented`);
  }

  /**
   * Validate market configuration for this provider
   * Can be overridden by subclasses for specific validation
   * 
   * @param {Object} market - Market data
   * @returns {Object} Validation result: { valid: boolean, errors: string[] }
   */
  validateConfig(market) {
    const errors = [];
    
    // Base validation
    if (!market.marketId) {
      errors.push('Missing marketId');
    }
    
    if (!market.oracleConfig) {
      errors.push('Missing oracleConfig');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get list of supported market types
   * Can be overridden by subclasses
   * 
   * @returns {Array} List of supported market categories
   */
  getSupportedMarketTypes() {
    return ['generic'];
  }

  /**
   * Get provider capabilities
   * Can be overridden by subclasses
   * 
   * @returns {Object} Capabilities of this provider
   */
  getCapabilities() {
    return {
      supportsMultipleConditions: false,
      supportsPriceData: false,
      supportsHistoricalData: false,
      requiresApiKey: false
    };
  }

  /**
   * Resolve with automatic retry logic
   * 
   * @param {Object} market - Market data
   * @param {number} attempt - Current attempt number (1-indexed)
   * @returns {Promise<Object|null>} Resolution result or null if all retries fail
   */
  async resolveWithRetry(market, attempt = 1) {
    const marketId = market.marketId;
    
    if (attempt > this.maxRetries) {
      this.recordFailure();
      logger.oracle(`${this.name}: Max retries exceeded`, {
        marketId,
        attempts: attempt - 1,
        provider: this.name
      });
      return null;
    }

    try {
      const result = await this.resolve(market);
      
      if (result) {
        this.recordSuccess();
        return {
          source: this.name,
          outcome: result.outcome,
          confidence: result.confidence,
          data: {
            ...result.data,
            provider: this.name
          },
          timestamp: new Date().toISOString()
        };
      }
      
      this.recordFailure();
      return null;
    } catch (error) {
      logger.oracle(`${this.name} failed on attempt ${attempt}/${this.maxRetries}`, {
        error: error.message,
        marketId,
        provider: this.name
      });

      this.recordFailure();
      
      // Retry with exponential backoff
      if (attempt < this.maxRetries) {
        const delayMs = this.retryDelay * attempt;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.resolveWithRetry(market, attempt + 1);
      }
      
      return null;
    }
  }

  /**
   * Record successful resolution
   */
  recordSuccess() {
    this.health.successCount++;
    this.updateHealth();
  }

  /**
   * Record failed resolution
   */
  recordFailure() {
    this.health.failureCount++;
    this.health.lastFailure = new Date().toISOString();
    this.updateHealth();
  }

  /**
   * Update health status
   */
  updateHealth() {
    const total = this.health.successCount + this.health.failureCount;
    
    if (total > 0) {
      this.health.failureRate = this.health.failureCount / total;
      this.health.isHealthy = this.health.failureRate < 0.3; // Unhealthy if >30% failure rate
    }
    
    logger.oracle(`${this.name} health updated`, {
      provider: this.name,
      successCount: this.health.successCount,
      failureCount: this.health.failureCount,
      failureRate: (this.health.failureRate * 100).toFixed(2) + '%',
      isHealthy: this.health.isHealthy
    });
  }

  /**
   * Get current health status
   * @returns {Object} Health metrics
   */
  getHealth() {
    return { ...this.health };
  }

  /**
   * Reset health metrics
   */
  resetHealth() {
    this.health = {
      successCount: 0,
      failureCount: 0,
      lastFailure: null,
      isHealthy: true,
      failureRate: 0
    };
  }

  /**
   * Shutdown provider (cleanup resources if needed)
   * Can be overridden by subclasses
   */
  async shutdown() {
    logger.oracle(`${this.name} shutting down`);
  }
}

module.exports = BaseOracleProvider;
