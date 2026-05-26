# Plugin-Based Oracle Provider Architecture

## Overview

The oracle system has been refactored to use a **plugin-based architecture** that decouples oracle integrations and simplifies onboarding new APIs.

### Key Benefits

1. **Decoupled Architecture**: Oracle providers are independent modules
2. **Easy Provider Addition**: Add new providers without modifying core code
3. **Provider Interface**: Standardized interface all providers implement
4. **Provider Registry**: Centralized management and discovery
5. **Plugin Loader**: Simplified provider initialization and lifecycle management
6. **Flexible Configuration**: Per-provider configuration and weights
7. **Health Tracking**: Built-in health monitoring for all providers

## Architecture Components

### 1. BaseOracleProvider

Abstract base class that defines the provider interface.

**Location**: `backend/src/services/oracle/BaseOracleProvider.js`

**Key Methods**:
- `resolve(market)` - Resolve a market (must implement)
- `validateConfig(market)` - Validate market configuration
- `resolveWithRetry(market)` - Automatic retry logic with exponential backoff
- `getMetadata()` - Get provider information
- `getCapabilities()` - Get provider capabilities
- `getHealth()` - Get health metrics
- `recordSuccess()` / `recordFailure()` - Track resolution outcomes

**Example Implementation**:
```javascript
class MyProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'my-provider';
  }

  getSupportedMarketTypes() {
    return ['crypto', 'generic'];
  }

  getCapabilities() {
    return {
      supportsMultipleConditions: true,
      supportsPriceData: true,
      supportsHistoricalData: false,
      requiresApiKey: true
    };
  }

  async resolve(market) {
    // Implementation
    return {
      outcome: 'yes' | 'no',
      confidence: 0.0 - 1.0,
      data: { /* provider-specific data */ }
    };
  }

  validateConfig(market) {
    const validation = super.validateConfig(market);
    // Add custom validation
    return validation;
  }
}
```

### 2. OracleProviderRegistry

Manages provider registration, discovery, and lifecycle.

**Location**: `backend/src/services/oracle/OracleProviderRegistry.js`

**Key Methods**:
- `register(name, ProviderClass, options)` - Register provider
- `unregister(name)` - Unregister provider
- `getProvider(name)` - Get provider instance
- `setWeights(weights)` - Set provider weights for aggregation
- `setFallbackChain(category, providers)` - Set fallback resolution chain
- `resolveWithFallback(market, primarySources)` - Multi-source resolution
- `getHealthStatus()` - Get health metrics for all providers
- `listProviders()` - List all registered providers

### 3. OracleProviderLoader

Factory for loading and initializing providers.

**Location**: `backend/src/services/oracle/OracleProviderLoader.js`

**Key Methods**:
- `initializeDefaultProviders(config)` - Load built-in providers
- `initializeFallbackChains(chains)` - Setup fallback chains
- `registerCustomProvider(name, Class, options)` - Add custom provider
- `loadProviderFromFile(name, path, options)` - Dynamic provider loading
- `getHealthReport()` - Get overall system health
- `shutdownAll()` - Cleanup all providers

### 4. OracleService

Main service coordinating with provider plugins.

**Location**: `backend/src/services/oracleService.js`

**Key Methods**:
- `initialize()` - Initialize service with providers
- `resolveMarket(market)` - Main resolution method
- `resolveWithFallback(market)` - Multi-source resolution
- `aggregateResults(results)` - Weighted voting aggregation
- `detectAnomalies(marketId, result, sources)` - Anomaly detection
- `registerCustomProvider(name, Class, options)` - Add custom provider
- `getSourceHealthStatus()` - Get provider health
- `shutdown()` - Cleanup

## Built-in Providers

### CoinGeckoProvider

Cryptocurrency price oracle from CoinGecko API.

**Supported Conditions**: `above`, `below`, `equals`

**Configuration**:
```javascript
{
  symbol: 'bitcoin',        // CoinGecko symbol (lowercase)
  targetPrice: 50000,       // Target price in USD
  condition: 'above'        // Comparison condition
}
```

### SportsApiProvider

Sports event resolution (win/loss, scores).

**Supported Conditions**: `win`, `score_over`, `score_under`, `draw`

**Configuration**:
```javascript
{
  gameId: 'game_123',       // Game identifier
  team: 'Team A',           // Team name
  condition: 'win',         // Condition
  threshold: 45             // Score threshold (for score conditions)
}
```

### NewsApiProvider

Sentiment analysis from news articles.

**Supported Sentiments**: `positive`, `negative`, `neutral`

**Configuration**:
```javascript
{
  keywords: ['bitcoin', 'price', 'surge'],  // Search keywords
  sentiment: 'positive',                     // Target sentiment
  sources: ['bbc-news', 'cnn']              // Optional news sources
}
```

### ChainlinkProvider

Decentralized oracle data from Chainlink (Stellar integration pending).

**Status**: Beta - requires Soroban contract integration

## How to Add a Custom Provider

### Step 1: Create Provider Class

Create `backend/src/services/oracle/providers/MyProvider.js`:

```javascript
const BaseOracleProvider = require('../BaseOracleProvider');
const logger = require('../../config/logger');

class MyProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'my-provider';
  }

  getMetadata() {
    return {
      name: this.name,
      version: '1.0.0',
      displayName: 'My Custom Provider',
      description: 'Custom oracle provider',
      weight: this.defaultWeight,
      supportedMarketTypes: this.getSupportedMarketTypes(),
      capabilities: this.getCapabilities()
    };
  }

  getSupportedMarketTypes() {
    return ['crypto', 'generic'];
  }

  getCapabilities() {
    return {
      supportsMultipleConditions: true,
      supportsPriceData: true,
      supportsHistoricalData: false,
      requiresApiKey: true
    };
  }

  validateConfig(market) {
    const validation = super.validateConfig(market);
    const config = market.oracleConfig || {};
    const errors = validation.errors;

    // Add custom validation
    if (!config.customField) {
      errors.push('Missing customField');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async resolve(market) {
    try {
      const config = market.oracleConfig || {};
      
      // Validate
      const validation = this.validateConfig(market);
      if (!validation.valid) {
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }

      // Fetch data from external source
      const data = await this.fetchData(config);

      // Determine outcome
      const outcome = this.determineOutcome(data, config);

      return {
        outcome,
        confidence: 0.95,
        data: {
          source: 'my-provider',
          ...data
        }
      };
    } catch (error) {
      logger.error('My provider resolution failed', { error: error.message });
      throw error;
    }
  }

  async fetchData(config) {
    // Implement data fetching
    return {};
  }

  determineOutcome(data, config) {
    // Implement outcome logic
    return 'yes';
  }
}

module.exports = MyProvider;
```

### Step 2: Register Provider

**Option A: Runtime Registration**

```javascript
const oracleService = require('./services/oracleService');
const MyProvider = require('./services/oracle/providers/MyProvider');

// Initialize service first
await oracleService.initialize();

// Register custom provider
const result = oracleService.registerCustomProvider('my-provider', MyProvider, {
  weight: 0.6,
  config: {
    apiKey: process.env.MY_API_KEY,
    timeout: 5000
  }
});

console.log('Provider registered:', result);
```

**Option B: Configuration-based Registration**

Extend `OracleProviderLoader.js`:

```javascript
const DEFAULT_PROVIDERS = {
  // ... existing providers ...
  'my-provider': {
    class: MyProvider,
    weight: 0.6,
    enabled: true,
    config: {
      timeout: 5000,
      maxRetries: 3
    }
  }
};
```

## Usage Examples

### Initialize Oracle Service

```javascript
const oracleService = require('./services/oracleService');

// Initialize with default providers
await oracleService.initialize();

// Service is now ready to use
console.log(oracleService.listProviders());
```

### Resolve a Market

```javascript
const market = {
  marketId: 'market_123',
  oracleSource: 'coingecko',
  category: 'crypto',
  oracleConfig: {
    symbol: 'bitcoin',
    targetPrice: 50000,
    condition: 'above'
  }
};

const result = await oracleService.resolveMarket(market);
console.log(result);
// Output:
// {
//   outcome: 'yes',
//   confidence: 1.0,
//   data: {
//     currentPrice: 52000,
//     targetPrice: 50000,
//     symbol: 'bitcoin',
//     condition: 'above',
//     source: 'CoinGecko'
//   }
// }
```

### Multi-Source Resolution with Fallback

```javascript
const market = {
  marketId: 'market_456',
  category: 'crypto',
  oracleConfig: {
    sources: ['coingecko', 'chainlink'],  // Try CoinGecko first, then Chainlink
    symbol: 'ethereum',
    targetPrice: 3000,
    condition: 'above'
  }
};

const result = await oracleService.resolveWithFallback(market);
// Tries CoinGecko first, falls back to Chainlink if needed
// Returns aggregated result from all successful sources
```

### Configure Weights

```javascript
// Adjust provider weights for aggregation
oracleService.setWeights({
  coingecko: 0.5,
  'sports-api': 0.3,
  'news-api': 0.2
});
```

### Set Fallback Chains

```javascript
const providerLoader = oracleService.providerLoader;

// Configure fallback for market categories
providerLoader.initializeFallbackChains({
  crypto: ['coingecko', 'chainlink'],
  sports: ['sports-api'],
  news: ['news-api']
});
```

### Monitor Provider Health

```javascript
// Get health of all providers
const health = oracleService.getSourceHealthStatus();
console.log(health);
// Output:
// {
//   coingecko: {
//     successCount: 150,
//     failureCount: 5,
//     failureRate: 0.032,
//     isHealthy: true,
//     lastFailure: '2024-05-26T10:30:00Z'
//   },
//   'sports-api': { ... }
// }

// Get health report
const report = oracleService.getHealthReport();
console.log(report);
```

### List Available Providers

```javascript
const providers = oracleService.listProviders();
console.log(providers);
// Output: Array of provider metadata with capabilities and health
```

## Error Handling

Providers use standardized error handling with automatic retry logic:

```javascript
// Automatic retry with exponential backoff
// Configured per provider in BaseOracleProvider
const result = await provider.resolveWithRetry(market);

if (!result) {
  console.log('Resolution failed after retries');
  // Falls back to next provider in chain
}
```

## Testing

### Test Provider Implementation

```javascript
const oracleService = require('./services/oracleService');

async function testProvider() {
  await oracleService.initialize();

  const market = {
    marketId: 'test_market',
    oracleSource: 'coingecko',
    oracleConfig: {
      symbol: 'bitcoin',
      targetPrice: 40000,
      condition: 'above'
    }
  };

  try {
    const result = await oracleService.resolveMarket(market);
    console.log('Provider test passed:', result);
  } catch (error) {
    console.error('Provider test failed:', error);
  }
}

testProvider();
```

## Migration Guide

### For Existing Code

The refactoring maintains backward compatibility:

```javascript
// Old code still works
const result = await oracleService.resolveMarket(market);

// But now uses plugin system internally
```

### Updating Market Configurations

No changes needed for existing market configurations - they work with the new system.

## Best Practices

1. **Always Initialize**: Call `oracleService.initialize()` before using
2. **Use Fallbacks**: Configure fallback chains for reliability
3. **Monitor Health**: Check provider health regularly
4. **Handle Errors**: Implement proper error handling for custom providers
5. **Cache Results**: Use built-in caching to avoid redundant API calls
6. **Validate Config**: Implement comprehensive config validation
7. **Test Thoroughly**: Test new providers with various market types

## Troubleshooting

### Provider Not Found

```
Error: Unknown oracle provider: my-provider
```

**Solution**: Ensure provider is registered before use
```javascript
await oracleService.initialize();
// Provider auto-loads if defined in DEFAULT_PROVIDERS
// Or manually register:
oracleService.registerCustomProvider('my-provider', MyProvider);
```

### Resolution Failed

Check provider health and logs:

```javascript
const health = oracleService.getProviderHealth('coingecko');
if (!health.isHealthy) {
  console.log('Provider unhealthy:', health.failureRate);
}
```

### Invalid Configuration

Implement comprehensive validation:

```javascript
const validation = provider.validateConfig(market);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}
```

## Next Steps

1. Replace existing provider-specific code with new providers
2. Add more third-party oracle integrations as plugins
3. Implement on-chain proof verification for Chainlink
4. Add custom provider creation guide to documentation
5. Create provider testing framework
6. Monitor provider reliability and implement scoring

## References

- [BaseOracleProvider](./BaseOracleProvider.js)
- [OracleProviderRegistry](./OracleProviderRegistry.js)
- [OracleProviderLoader](./OracleProviderLoader.js)
- [CoinGeckoProvider](./providers/CoinGeckoProvider.js)
- [SportsApiProvider](./providers/SportsApiProvider.js)
- [NewsApiProvider](./providers/NewsApiProvider.js)
- [ChainlinkProvider](./providers/ChainlinkProvider.js)
