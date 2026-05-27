const logger = require('../config/logger');
const { Market } = require('../models');
const OracleProviderLoader = require('./oracle/OracleProviderLoader');

const OUTLIER_THRESHOLD = 0.15;
const ANOMALY_THRESHOLD = 0.25; // 25% price drift threshold
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

/**
 * OracleService
 * 
 * Main oracle service that coordinates with pluggable oracle providers.
 * Uses a plugin-based architecture for flexible oracle provider integration.
 * 
 * New providers can be added without modifying this class.
 * See OracleProviderLoader for registering and managing providers.
 */
class OracleService {
  constructor() {
    this.providerLoader = OracleProviderLoader;
    this.registry = this.providerLoader.getRegistry();
    this.resultCache = new Map(); // {marketId: {result, timestamp}}
    this.discrepancyLog = []; // Track all discrepancies
    this.initialized = false;
  }

  /**
   * Initialize the oracle service with providers
   * Must be called before using the service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize default providers
      const results = await this.providerLoader.initializeDefaultProviders();
      
      // Initialize fallback chains
      this.providerLoader.initializeFallbackChains();

      // Log initialization results
      const successful = results.filter(r => r.status === 'registered').length;
      const failed = results.filter(r => r.status === 'failed').length;

      logger.oracle('OracleService initialized', {
        providersLoaded: successful,
        providersFailed: failed,
        totalProviders: results.length
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize OracleService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('OracleService not initialized. Call initialize() first.');
    }
  }

  /**
   * Set provider weights for aggregation
   */
  setWeights(sourceWeights) {
    this.ensureInitialized();
    this.registry.setWeights(sourceWeights);
    logger.oracle('Oracle provider weights updated', { weights: sourceWeights });
  }

  /**
   * Get provider weights
   */
  getWeights() {
    this.ensureInitialized();
    const providers = this.registry.getProviderNames();
    const weights = {};
    providers.forEach(name => {
      weights[name] = this.registry.getWeight(name);
    });
    return weights;
  }

  /**
   * Register a custom provider
   */
  registerCustomProvider(name, ProviderClass, options = {}) {
    this.ensureInitialized();
    return this.providerLoader.registerCustomProvider(name, ProviderClass, options);
  }

  /**
   * Get a provider instance
   */
  getProvider(name) {
    this.ensureInitialized();
    return this.registry.getProvider(name);
  }

  /**
   * List all available providers
   */
  listProviders() {
    this.ensureInitialized();
    return this.registry.listProviders();
  }

  /**
   * Get cached result if available and fresh
   */
  getCachedResult(marketId) {
    if (this.resultCache.has(marketId)) {
      const { result, timestamp } = this.resultCache.get(marketId);
      if (Date.now() - timestamp < CACHE_DURATION) {
        logger.oracle('Using cached oracle result', { marketId, cacheAge: Date.now() - timestamp });
        return result;
      }
    }
    return null;
  }

  /**
   * Cache a result with timestamp
   */
  cacheResult(marketId, result) {
    this.resultCache.set(marketId, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Resolve market with primary sources and fallback
   * Uses plugin-based providers from the registry
   */
  async resolveWithFallback(market) {
    this.ensureInitialized();
    const marketId = market.marketId;

    // Try to use cache first
    const cachedResult = this.getCachedResult(marketId);
    if (cachedResult) {
      return cachedResult;
    }

    // Get primary sources from market config or use default
    const primarySources = market.oracleConfig?.sources || [market.oracleSource];

    logger.oracle('Starting oracle resolution with primary sources', {
      marketId,
      primarySources,
      category: market.category
    });

    // Use registry's built-in fallback resolution
    const results = await this.registry.resolveWithFallback(market, primarySources);

    if (!results || results.length === 0) {
      logger.error('All oracle sources failed', {
        marketId,
        primarySources,
        category: market.category
      });
      return null;
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    // Detect anomalies
    this.detectAnomalies(marketId, aggregated, results);

    // Cache the result
    this.cacheResult(marketId, aggregated);

    logger.oracle('Aggregated oracle result with fallback handling', {
      marketId,
      sources: results.map(r => r.source),
      outcome: aggregated.outcome,
      confidence: aggregated.confidence,
      successfulSources: results.length
    });

    return aggregated;
  }

  /**
   * Aggregate results from multiple providers
   * Uses weighted voting to determine final outcome
   */
  aggregateResults(results) {
    this.ensureInitialized();
    const outcomes = { yes: 0, no: 0 };
    let totalWeight = 0;
    const sourceBreakdown = [];

    for (const result of results) {
      const weight = this.registry.getWeight(result.source) * result.confidence;
      if (result.outcome === 'yes') {
        outcomes.yes += weight;
      } else {
        outcomes.no += weight;
      }
      totalWeight += weight;
      sourceBreakdown.push({
        source: result.source,
        outcome: result.outcome,
        confidence: result.confidence,
        weight: weight
      });
    }

    const filteredResults = this.filterOutliers(results, totalWeight);

    if (filteredResults.length < results.length) {
      // Log which results were filtered as outliers
      const filteredOutSources = results
        .filter(r => !filteredResults.includes(r))
        .map(r => r.source);

      logger.oracle('Outliers detected and filtered', {
        filteredOutSources,
        remainingResults: filteredResults.length,
        totalResults: results.length
      });

      return this.aggregateResults(filteredResults);
    }

    const confidence = Math.min(totalWeight / results.length, 1.0);
    const outcome = outcomes.yes > outcomes.no ? 'yes' : 'no';

    return {
      outcome,
      confidence,
      sources: results.length,
      data: {
        breakdown: sourceBreakdown,
        yesWeight: outcomes.yes,
        noWeight: outcomes.no,
        totalWeight,
        aggregationMethod: 'weighted'
      }
    };
  }

  /**
   * Filter outlier results
   */
  filterOutliers(results, totalWeight) {
    if (results.length < 3) return results;

    const avgOutcome = totalWeight / results.length;
    const filtered = results.filter(result => {
      const weight = this.registry.getWeight(result.source) * result.confidence;
      const deviation = Math.abs(weight - avgOutcome) / avgOutcome;
      return deviation <= OUTLIER_THRESHOLD;
    });

    return filtered.length > 0 ? filtered : results; // Always return at least the original
  }

  /**
   * Detect anomalies in oracle results
   */
  detectAnomalies(marketId, aggregatedResult, individualResults) {
    const anomalies = {
      discrepancies: [],
      driftWarnings: [],
      lowConfidence: [],
      sourceDisagreement: []
    };

    // Check for source disagreements
    if (individualResults.length > 1) {
      const outcomes = individualResults.map(r => r.outcome);
      const uniqueOutcomes = new Set(outcomes);

      if (uniqueOutcomes.size > 1) {
        const disagreement = {
          marketId,
          timestamp: new Date().toISOString(),
          sources: individualResults.map(r => ({ source: r.source, outcome: r.outcome })),
          aggregatedOutcome: aggregatedResult.outcome
        };
        anomalies.sourceDisagreement.push(disagreement);

        logger.oracle('Oracle source disagreement detected', {
          marketId,
          disagreement,
          severity: 'warning'
        });

        this.discrepancyLog.push(disagreement);
      }
    }

    // Check for low confidence
    if (aggregatedResult.confidence < 0.6) {
      const lowConfAlert = {
        marketId,
        timestamp: new Date().toISOString(),
        confidence: aggregatedResult.confidence,
        sources: individualResults.length
      };
      anomalies.lowConfidence.push(lowConfAlert);

      logger.oracle('Low confidence oracle result', {
        marketId,
        confidence: aggregatedResult.confidence,
        severity: 'warning'
      });

      this.discrepancyLog.push(lowConfAlert);
    }

    return anomalies;
  }

  /**
   * Get all recorded discrepancies
   */
  getDiscrepancyLog(limit = 100) {
    return this.discrepancyLog.slice(-limit);
  }

  /**
   * Clear discrepancy log
   */
  clearDiscrepancyLog() {
    const count = this.discrepancyLog.length;
    this.discrepancyLog = [];
    logger.oracle('Discrepancy log cleared', { clearedCount: count });
    return count;
  }

  /**
   * Get health status of all providers
   */
  getSourceHealthStatus() {
    this.ensureInitialized();
    return this.registry.getHealthStatus();
  }

  /**
   * Get health status of specific provider
   */
  getProviderHealth(name) {
    this.ensureInitialized();
    return this.registry.getProviderHealth(name);
  }

  /**
   * Get overall health report
   */
  getHealthReport() {
    this.ensureInitialized();
    return this.providerLoader.getHealthReport();
  }

  /**
   * Main resolution method
   * Resolves a market using available providers
   */
  async resolveMarket(market) {
    this.ensureInitialized();
    try {
      if (market.oracleConfig && market.oracleConfig.sources && market.oracleConfig.sources.length > 0) {
        return this.resolveWithFallback(market);
      }

      if (!market.oracleSource || market.oracleSource === 'manual') {
        logger.oracle('Manual resolution required', { marketId: market.marketId });
        return null;
      }

      const provider = this.registry.getProvider(market.oracleSource);
      if (!provider) {
        logger.oracle('Unknown oracle provider', {
          provider: market.oracleSource,
          marketId: market.marketId
        });
        return null;
      }

      const result = await provider.resolveWithRetry(market);

      if (result) {
        logger.oracle('Market resolved by provider', {
          marketId: market.marketId,
          provider: market.oracleSource,
          outcome: result.outcome,
          confidence: result.confidence
        });
        this.cacheResult(market.marketId, result);
      }

      return result;
    } catch (error) {
      logger.error('Oracle resolution failed:', error);
      return null;
    }
  }

  /**
   * Shutdown oracle service and providers
   */
  async shutdown() {
    logger.oracle('Shutting down OracleService');
    await this.providerLoader.shutdownAll();
    this.resultCache.clear();
    this.initialized = false;
  }
}

module.exports = new OracleService();