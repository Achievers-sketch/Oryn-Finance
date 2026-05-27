/**
 * OracleProviderRegistry
 * 
 * Manages registration, discovery, and lifecycle of oracle provider plugins.
 * Provides centralized control over provider loading and configuration.
 */

const logger = require('../../config/logger');

class OracleProviderRegistry {
  constructor() {
    this.providers = new Map(); // name -> provider instance
    this.providerClasses = new Map(); // name -> provider class
    this.fallbackChain = {}; // category -> [provider names]
    this.weights = {}; // provider name -> weight
  }

  /**
   * Register a provider class
   * 
   * @param {string} name - Provider identifier
   * @param {Function} ProviderClass - Provider class (must extend BaseOracleProvider)
   * @param {Object} options - Registration options
   * @param {number} options.weight - Provider weight for aggregation (default: 0.5)
   * @param {boolean} options.autoInstantiate - Automatically create instance (default: true)
   * @param {Object} options.config - Configuration to pass to provider
   * @returns {Object} Registration result
   */
  register(name, ProviderClass, options = {}) {
    const { weight = 0.5, autoInstantiate = true, config = {} } = options;

    // Validate provider class
    if (!ProviderClass.prototype || typeof ProviderClass !== 'function') {
      throw new Error(`Invalid provider class for ${name}`);
    }

    // Store class
    this.providerClasses.set(name, ProviderClass);
    this.weights[name] = weight;

    // Instantiate if requested
    if (autoInstantiate) {
      try {
        const instance = new ProviderClass({ weight, ...config });
        this.providers.set(name, instance);
        
        logger.oracle(`Oracle provider registered: ${name}`, {
          weight,
          metadata: instance.getMetadata?.() || {}
        });

        return {
          success: true,
          provider: name,
          instance
        };
      } catch (error) {
        logger.error(`Failed to instantiate provider ${name}`, { error: error.message });
        return {
          success: false,
          provider: name,
          error: error.message
        };
      }
    }

    logger.oracle(`Oracle provider class registered: ${name}`, { weight });
    return {
      success: true,
      provider: name,
      instantiated: false
    };
  }

  /**
   * Unregister a provider
   * 
   * @param {string} name - Provider identifier
   * @returns {boolean} True if unregistered successfully
   */
  unregister(name) {
    const provider = this.providers.get(name);
    
    if (provider && provider.shutdown) {
      try {
        provider.shutdown();
      } catch (error) {
        logger.error(`Error shutting down provider ${name}`, { error: error.message });
      }
    }

    this.providers.delete(name);
    this.providerClasses.delete(name);
    delete this.weights[name];

    logger.oracle(`Oracle provider unregistered: ${name}`);
    return true;
  }

  /**
   * Get a provider instance by name
   * 
   * @param {string} name - Provider identifier
   * @returns {Object|null} Provider instance or null if not found
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Get all registered providers
   * 
   * @returns {Map} Map of provider name -> instance
   */
  getAllProviders() {
    return new Map(this.providers);
  }

  /**
   * Get list of provider names
   * 
   * @returns {Array} Array of provider identifiers
   */
  getProviderNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider exists
   * 
   * @param {string} name - Provider identifier
   * @returns {boolean}
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * Get provider weight
   * 
   * @param {string} name - Provider identifier
   * @returns {number} Weight or default 0.5
   */
  getWeight(name) {
    return this.weights[name] || 0.5;
  }

  /**
   * Set provider weights (for aggregation)
   * 
   * @param {Object} weights - Map of provider name -> weight
   */
  setWeights(weights) {
    this.weights = { ...this.weights, ...weights };
    logger.oracle('Oracle provider weights updated', { weights });
  }

  /**
   * Set fallback chain for market category
   * 
   * @param {string} category - Market category
   * @param {Array} providerNames - Ordered list of provider names to try
   */
  setFallbackChain(category, providerNames) {
    // Validate all providers exist
    const missing = providerNames.filter(name => !this.hasProvider(name));
    if (missing.length > 0) {
      throw new Error(`Unknown providers in fallback chain: ${missing.join(', ')}`);
    }

    this.fallbackChain[category] = providerNames;
    logger.oracle(`Fallback chain set for category ${category}`, {
      providers: providerNames
    });
  }

  /**
   * Get fallback chain for category
   * 
   * @param {string} category - Market category
   * @returns {Array} Ordered list of provider names
   */
  getFallbackChain(category) {
    return this.fallbackChain[category] || [];
  }

  /**
   * Get all fallback chains
   * 
   * @returns {Object} Map of category -> provider names
   */
  getAllFallbackChains() {
    return { ...this.fallbackChain };
  }

  /**
   * Resolve market with primary sources, falling back to configured chain
   * 
   * @param {Object} market - Market data
   * @param {Array} primarySources - Primary provider names to try first
   * @returns {Promise<Object|null>} Resolution result or null if all fail
   */
  async resolveWithFallback(market, primarySources = []) {
    const marketId = market.marketId;
    const results = [];

    // Try primary sources first
    logger.oracle('Starting resolution with fallback', {
      marketId,
      primarySources,
      category: market.category
    });

    for (const source of primarySources) {
      const provider = this.getProvider(source);
      if (!provider) {
        logger.oracle(`Provider not found: ${source}`, { marketId });
        continue;
      }

      const result = await provider.resolveWithRetry(market);
      if (result) {
        results.push(result);
        logger.oracle(`Primary source succeeded: ${source}`, { marketId, result });
      }
    }

    // Try fallback chain if primary sources failed
    if (results.length === 0 && market.category) {
      const fallbackChain = this.getFallbackChain(market.category);
      logger.oracle('Trying fallback chain', {
        marketId,
        category: market.category,
        fallbackChain
      });

      for (const source of fallbackChain) {
        if (primarySources.includes(source)) {
          continue; // Skip if already tried as primary
        }

        const provider = this.getProvider(source);
        if (!provider) {
          continue;
        }

        const result = await provider.resolveWithRetry(market);
        if (result) {
          results.push(result);
          logger.oracle(`Fallback source succeeded: ${source}`, {
            marketId,
            result
          });
          break; // Use first successful fallback
        }
      }
    }

    if (results.length === 0) {
      logger.error('All oracle sources failed', {
        marketId,
        primarySources,
        fallbackChain: market.category ? this.getFallbackChain(market.category) : []
      });
      return null;
    }

    return results; // Return raw results for aggregation
  }

  /**
   * Get health status of all providers
   * 
   * @returns {Object} Map of provider name -> health metrics
   */
  getHealthStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getHealth?.() || {};
    }
    return status;
  }

  /**
   * Get health status of specific provider
   * 
   * @param {string} name - Provider identifier
   * @returns {Object|null} Health metrics or null if provider not found
   */
  getProviderHealth(name) {
    const provider = this.getProvider(name);
    return provider ? provider.getHealth?.() || {} : null;
  }

  /**
   * List all registered providers with metadata
   * 
   * @returns {Array} Array of provider metadata
   */
  listProviders() {
    const providers = [];
    for (const [name, provider] of this.providers) {
      providers.push({
        name,
        weight: this.getWeight(name),
        metadata: provider.getMetadata?.() || {},
        health: provider.getHealth?.() || {}
      });
    }
    return providers;
  }

  /**
   * Validate provider for market
   * 
   * @param {string} providerName - Provider identifier
   * @param {Object} market - Market data
   * @returns {Object} Validation result
   */
  validateProvider(providerName, market) {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return {
        valid: false,
        errors: [`Provider not found: ${providerName}`]
      };
    }

    if (!provider.validateConfig) {
      return { valid: true, errors: [] };
    }

    return provider.validateConfig(market);
  }

  /**
   * Clear and reset registry
   */
  clear() {
    for (const [name, provider] of this.providers) {
      if (provider.shutdown) {
        try {
          provider.shutdown();
        } catch (error) {
          logger.error(`Error shutting down provider ${name}`, { error: error.message });
        }
      }
    }

    this.providers.clear();
    this.providerClasses.clear();
    this.fallbackChain = {};
    this.weights = {};

    logger.oracle('Oracle provider registry cleared');
  }
}

module.exports = new OracleProviderRegistry();
