/**
 * OracleProviderLoader
 * 
 * Factory for loading and initializing oracle providers.
 * Simplifies the process of registering plugins and managing their lifecycle.
 */

const logger = require('../../config/logger');
const OracleProviderRegistry = require('./OracleProviderRegistry');

// Import provider implementations
const CoinGeckoProvider = require('./providers/CoinGeckoProvider');
const SportsApiProvider = require('./providers/SportsApiProvider');
const NewsApiProvider = require('./providers/NewsApiProvider');
const ChainlinkProvider = require('./providers/ChainlinkProvider');

// Default provider configurations
const DEFAULT_PROVIDERS = {
  coingecko: {
    class: CoinGeckoProvider,
    weight: 0.4,
    enabled: true,
    config: {
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  'sports-api': {
    class: SportsApiProvider,
    weight: 0.35,
    enabled: true,
    config: {
      timeout: 8000,
      maxRetries: 2,
      retryDelay: 1000,
      cacheDuration: 5 * 60 * 1000
    }
  },
  'news-api': {
    class: NewsApiProvider,
    weight: 0.25,
    enabled: true,
    config: {
      timeout: 8000,
      maxRetries: 2,
      retryDelay: 1000,
      cacheDuration: 10 * 60 * 1000
    }
  },
  chainlink: {
    class: ChainlinkProvider,
    weight: 0.5,
    enabled: false, // Disabled until Stellar integration is complete
    config: {
      timeout: 10000,
      maxRetries: 1,
      retryDelay: 2000,
      cacheDuration: 1 * 60 * 1000
    }
  }
};

// Default fallback chains by market category
const DEFAULT_FALLBACK_CHAINS = {
  crypto: ['coingecko', 'chainlink'],
  sports: ['sports-api'],
  news: ['news-api'],
  generic: ['coingecko', 'chainlink', 'sports-api', 'news-api']
};

class OracleProviderLoader {
  constructor() {
    this.registry = OracleProviderRegistry;
    this.customProviders = new Map();
  }

  /**
   * Initialize default providers
   * Loads all built-in providers with their default configurations
   */
  async initializeDefaultProviders(overrideConfig = {}) {
    logger.oracle('Initializing default oracle providers');

    const providers = { ...DEFAULT_PROVIDERS, ...overrideConfig };
    const results = [];

    for (const [name, config] of Object.entries(providers)) {
      if (!config.enabled) {
        logger.oracle(`Skipping disabled provider: ${name}`);
        continue;
      }

      try {
        const result = this.registry.register(name, config.class, {
          weight: config.weight,
          autoInstantiate: true,
          config: config.config
        });

        if (result.success) {
          results.push({
            provider: name,
            status: 'registered',
            weight: config.weight
          });
        } else {
          results.push({
            provider: name,
            status: 'failed',
            error: result.error
          });
        }
      } catch (error) {
        logger.error(`Failed to register provider ${name}`, {
          error: error.message
        });
        results.push({
          provider: name,
          status: 'failed',
          error: error.message
        });
      }
    }

    logger.oracle('Default providers initialized', { results });
    return results;
  }

  /**
   * Initialize fallback chains
   * Sets up default fallback chains for different market categories
   */
  initializeFallbackChains(overrideChains = {}) {
    logger.oracle('Initializing fallback chains');

    const chains = { ...DEFAULT_FALLBACK_CHAINS, ...overrideChains };

    for (const [category, providers] of Object.entries(chains)) {
      try {
        this.registry.setFallbackChain(category, providers);
      } catch (error) {
        logger.error(`Failed to set fallback chain for ${category}`, {
          error: error.message
        });
      }
    }

    logger.oracle('Fallback chains initialized', {
      chains: Object.keys(chains)
    });
  }

  /**
   * Register a custom provider
   * Allows users to add their own oracle providers
   */
  registerCustomProvider(name, ProviderClass, options = {}) {
    try {
      if (this.registry.hasProvider(name)) {
        throw new Error(`Provider ${name} already registered`);
      }

      const result = this.registry.register(name, ProviderClass, {
        weight: options.weight || 0.5,
        autoInstantiate: true,
        config: options.config || {}
      });

      if (result.success) {
        this.customProviders.set(name, {
          class: ProviderClass,
          registered: new Date().toISOString(),
          ...options
        });

        logger.oracle(`Custom provider registered: ${name}`, {
          weight: options.weight,
          config: options.config
        });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to register custom provider ${name}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load provider from file path
   * For dynamically loading providers at runtime
   */
  async loadProviderFromFile(name, filePath, options = {}) {
    try {
      // Clear require cache to load fresh module
      delete require.cache[require.resolve(filePath)];
      
      const ProviderClass = require(filePath);
      return this.registerCustomProvider(name, ProviderClass, options);
    } catch (error) {
      logger.error(`Failed to load provider from ${filePath}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get provider by name
   */
  getProvider(name) {
    return this.registry.getProvider(name);
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return this.registry.getAllProviders();
  }

  /**
   * List all available providers
   */
  listProviders() {
    return this.registry.listProviders();
  }

  /**
   * Get registry
   */
  getRegistry() {
    return this.registry;
  }

  /**
   * Enable provider
   */
  enableProvider(name) {
    const provider = this.getProvider(name);
    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }

    logger.oracle(`Provider enabled: ${name}`);
    return provider;
  }

  /**
   * Disable provider
   */
  disableProvider(name) {
    this.registry.unregister(name);
    logger.oracle(`Provider disabled: ${name}`);
  }

  /**
   * Get default configuration
   */
  static getDefaultProviderConfig(providerName) {
    return DEFAULT_PROVIDERS[providerName] || null;
  }

  /**
   * Get default fallback chains
   */
  static getDefaultFallbackChains() {
    return { ...DEFAULT_FALLBACK_CHAINS };
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(providerName, config) {
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

    return provider.validateConfig(config);
  }

  /**
   * Shutdown all providers
   */
  async shutdownAll() {
    logger.oracle('Shutting down all oracle providers');

    for (const [name, provider] of this.registry.getAllProviders()) {
      try {
        if (provider.shutdown) {
          await provider.shutdown();
        }
      } catch (error) {
        logger.error(`Error shutting down provider ${name}`, {
          error: error.message
        });
      }
    }

    this.registry.clear();
    logger.oracle('All oracle providers shut down');
  }

  /**
   * Get health report for all providers
   */
  getHealthReport() {
    return {
      timestamp: new Date().toISOString(),
      providers: this.registry.getHealthStatus(),
      registeredCount: this.registry.getProviderNames().length,
      allHealthy: Object.values(this.registry.getHealthStatus())
        .every(health => health.isHealthy !== false)
    };
  }
}

module.exports = new OracleProviderLoader();
