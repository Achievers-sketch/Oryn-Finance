# Migration Guide: Oracle Plugin Architecture

## Overview

The oracle system has been refactored to a plugin-based architecture. This document explains how to migrate existing code and integrate with the new system.

## Breaking Changes

**None!** The refactoring maintains backward compatibility with existing code.

```javascript
// Old code still works exactly as before
const result = await oracleService.resolveMarket(market);
```

However, to take advantage of the new plugin architecture, follow the migration patterns below.

## Migration Timeline

### Phase 1: Initialization (Required)

Update your application startup to initialize the oracle service:

**Before:**
```javascript
const oracleService = require('./services/oracleService');
// Service started automatically
```

**After:**
```javascript
const oracleService = require('./services/oracleService');

// Add initialization to your startup code
app.listen(3000, async () => {
  try {
    await oracleService.initialize();
    console.log('Oracle service initialized');
  } catch (error) {
    console.error('Failed to initialize oracle service:', error);
    process.exit(1);
  }
});
```

### Phase 2: Use New Provider API (Optional)

Update code to use new provider features:

**Before:**
```javascript
// Direct provider access (still works)
const weights = oracleService.getWeights();
```

**After:**
```javascript
// Use new provider registry
const providers = oracleService.listProviders();
const health = oracleService.getSourceHealthStatus();
const report = oracleService.getHealthReport();
```

### Phase 3: Add Custom Providers (As Needed)

Create new oracle providers using the plugin architecture:

**Instead of modifying oracleService.js:**
```javascript
// ❌ Don't do this - modifying core service
oracleService.resolveCustom = async (market) => {
  // ...
};
```

**Do this - create a provider:**
```javascript
// ✅ Create provider plugin
class MyProvider extends BaseOracleProvider {
  async resolve(market) {
    // Implementation
  }
}

// Register it
oracleService.registerCustomProvider('my-provider', MyProvider);
```

## Step-by-Step Migration

### 1. Update Application Initialization

**File:** `backend/server.js` or your main entry point

```javascript
const oracleService = require('./services/oracleService');

// Find your app.listen() call and add initialization
app.listen(PORT, async () => {
  try {
    // Initialize oracle service
    await oracleService.initialize();
    console.log(`Server running on port ${PORT}`);
    console.log('Oracle service initialized with providers:', 
      oracleService.registry.getProviderNames().join(', '));
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
});

// Add graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await oracleService.shutdown();
  process.exit(0);
});
```

### 2. Update Market Resolution Code

**No changes needed** - existing code works as-is:

```javascript
// This still works exactly the same
const result = await oracleService.resolveMarket(market);
```

### 3. Migrate Health Monitoring

**Before:**
```javascript
// Old health API (still works)
const health = oracleService.getSourceHealthStatus();
```

**After (Enhanced):**
```javascript
// New comprehensive health API
const health = oracleService.getSourceHealthStatus();
const report = oracleService.getHealthReport();

// Monitor specific provider
const coingeckoHealth = oracleService.getProviderHealth('coingecko');
if (!coingeckoHealth.isHealthy) {
  console.warn('CoinGecko unhealthy, failureRate:', coingeckoHealth.failureRate);
}
```

### 4. Create Custom Providers

**Before (if you extended oracleService):**
```javascript
// ❌ Don't modify core service
class OracleService {
  async resolveCustomApi(market) {
    // ...
  }
}
```

**After (create a plugin):**
```javascript
// ✅ Create plugin file
// File: backend/src/services/oracle/providers/MyApiProvider.js
const BaseOracleProvider = require('../BaseOracleProvider');

class MyApiProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'my-api';
  }

  async resolve(market) {
    // Implementation
    return {
      outcome: 'yes',
      confidence: 0.9,
      data: { /* ... */ }
    };
  }
}

module.exports = MyApiProvider;

// Register in your app
const MyApiProvider = require('./services/oracle/providers/MyApiProvider');
oracleService.registerCustomProvider('my-api', MyApiProvider);
```

### 5. Update Configuration

**Market configurations remain unchanged:**

```javascript
// This configuration works with new system
const market = {
  marketId: 'market_1',
  oracleSource: 'coingecko',
  oracleConfig: {
    symbol: 'bitcoin',
    targetPrice: 50000,
    condition: 'above'
  }
};

// Multi-source still works the same way
const market2 = {
  marketId: 'market_2',
  oracleConfig: {
    sources: ['coingecko', 'chainlink'],
    symbol: 'ethereum',
    targetPrice: 3000,
    condition: 'above'
  }
};
```

## API Changes Summary

### Removed (Don't Use)

These internal methods are no longer available:

- `oracleService.resolveCrypto()` - Use CoinGeckoProvider
- `oracleService.resolveSports()` - Use SportsApiProvider
- `oracleService.resolveNews()` - Use NewsApiProvider
- `oracleService.resolveChainlink()` - Use ChainlinkProvider
- `oracleService.resolveSourceWithRetry()` - Internal to providers
- `oracleService.recordSourceSuccess/Failure()` - Moved to providers

### Added (Use These)

```javascript
// Provider management
oracleService.initialize()                      // Initialize service
oracleService.listProviders()                   // List all providers
oracleService.getProvider(name)                 // Get specific provider
oracleService.registerCustomProvider(...)       // Register new provider
oracleService.getProviderHealth(name)           // Provider health
oracleService.getHealthReport()                 // System health report
oracleService.shutdown()                        // Graceful shutdown

// Configuration
oracleService.setWeights({...})                // Update aggregation weights
oracleService.getWeights()                     // Get current weights

// Resolution
oracleService.resolveMarket(market)            // Main resolution (unchanged)
oracleService.resolveWithFallback(market)      // Multi-source (unchanged)

// Monitoring
oracleService.getSourceHealthStatus()          // All provider health
oracleService.getDiscrepancyLog()              // Anomaly log
oracleService.detectAnomalies(...)             // Anomaly detection
```

### Unchanged (Still Work)

```javascript
oracleService.resolveMarket(market)              // ✓ Still works
oracleService.resolveWithFallback(market)       // ✓ Still works
oracleService.resolveWithWeightedAggregation()  // ✓ Still works
oracleService.aggregateResults(results)        // ✓ Still works
oracleService.setWeights({...})                // ✓ Still works
oracleService.getWeights()                     // ✓ Still works
oracleService.getSourceHealthStatus()          // ✓ Still works
oracleService.getDiscrepancyLog()              // ✓ Still works
oracleService.clearDiscrepancyLog()            // ✓ Still works
oracleService.cacheResult()                    // ✓ Still works
oracleService.getCachedResult()                // ✓ Still works
```

## Testing

### Add Initialization to Tests

```javascript
// __tests__/setup.js or test file
describe('Oracle Service', () => {
  beforeAll(async () => {
    await oracleService.initialize();
  });

  afterAll(async () => {
    await oracleService.shutdown();
  });

  it('should resolve market', async () => {
    const market = { /* ... */ };
    const result = await oracleService.resolveMarket(market);
    expect(result).toBeDefined();
  });
});
```

### Test Custom Providers

```javascript
// __tests__/integration/customProvider.test.js
describe('Custom Provider', () => {
  beforeAll(async () => {
    await oracleService.initialize();
    const MyProvider = require('../services/oracle/providers/MyProvider');
    oracleService.registerCustomProvider('my-provider', MyProvider);
  });

  it('should register and resolve', async () => {
    const market = {
      marketId: 'test_1',
      oracleSource: 'my-provider',
      oracleConfig: { /* ... */ }
    };
    const result = await oracleService.resolveMarket(market);
    expect(result).toBeDefined();
  });
});
```

## Troubleshooting

### Error: "OracleService not initialized"

**Cause:** Called `oracleService` before initialization

**Fix:** Call `await oracleService.initialize()` in your startup code

```javascript
app.listen(3000, async () => {
  await oracleService.initialize();  // Add this
  // ...
});
```

### Error: "Provider not found"

**Cause:** Provider not registered

**Fix:** Ensure provider is registered before use

```javascript
// Option 1: In initialization
await oracleService.initialize();  // Loads default providers

// Option 2: Register custom provider
oracleService.registerCustomProvider('my-provider', MyProvider);
```

### No Providers Available

**Cause:** Default providers disabled in OracleProviderLoader

**Fix:** Enable in `DEFAULT_PROVIDERS` or register manually

```javascript
// File: OracleProviderLoader.js
const DEFAULT_PROVIDERS = {
  coingecko: {
    // ...
    enabled: true  // Make sure this is true
  }
};
```

## Rollback Plan

If you need to revert to the old system:

1. Keep a git branch with the old oracleService.js
2. The plugin architecture is backward compatible
3. Simply don't call new methods

```javascript
// Old code still works even with new system
const result = await oracleService.resolveMarket(market);
```

## Timeline

- **Week 1**: Update initialization in all applications
- **Week 2**: Add tests for custom providers
- **Week 3**: Migrate any custom oracle code to providers
- **Week 4**: Monitor system and optimize

## Checklist

- [ ] Update server.js with `oracleService.initialize()`
- [ ] Add graceful shutdown handler
- [ ] Run existing tests (should all pass)
- [ ] Update any custom oracle code to use plugins
- [ ] Add health monitoring to your app
- [ ] Test with sample markets
- [ ] Deploy to staging
- [ ] Deploy to production

## Support

For questions or issues:
1. Check [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md)
2. Check [QUICK_START.md](./QUICK_START.md)
3. Review example providers
4. Check test files: `__tests__/integration/oraclePluginArchitecture.test.js`

## References

- New Architecture: [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md)
- Quick Start: [QUICK_START.md](./QUICK_START.md)
- Test File: [oraclePluginArchitecture.test.js](../../../__tests__/integration/oraclePluginArchitecture.test.js)
