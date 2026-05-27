# Quick Start: Adding New Oracle Providers

## 5-Minute Setup for New Providers

### Step 1: Create Your Provider

Create a new file in `backend/src/services/oracle/providers/YourProviderName.js`:

```javascript
const BaseOracleProvider = require('../BaseOracleProvider');
const logger = require('../../config/logger');

class YourProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'your-provider';
  }

  getMetadata() {
    return {
      name: this.name,
      version: '1.0.0',
      displayName: 'Your Provider Name',
      weight: this.defaultWeight
    };
  }

  getSupportedMarketTypes() {
    return ['your-category', 'generic'];
  }

  validateConfig(market) {
    const validation = super.validateConfig(market);
    // Add validation
    return validation;
  }

  async resolve(market) {
    // 1. Extract config
    const config = market.oracleConfig || {};
    
    // 2. Validate
    const validation = this.validateConfig(market);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    // 3. Fetch data from your API
    const data = await this.fetchFromApi(config);

    // 4. Determine outcome (yes/no)
    const outcome = data.result > config.threshold ? 'yes' : 'no';

    // 5. Return result
    return {
      outcome,
      confidence: 0.9,  // 0.0 - 1.0
      data: {
        source: this.name,
        apiData: data
      }
    };
  }

  async fetchFromApi(config) {
    // Implement your API call here
    throw new Error('Implement fetchFromApi()');
  }
}

module.exports = YourProvider;
```

### Step 2: Register Provider

In your application initialization code:

```javascript
const oracleService = require('./services/oracleService');
const YourProvider = require('./services/oracle/providers/YourProvider');

// Initialize service
await oracleService.initialize();

// Register your provider
oracleService.registerCustomProvider('your-provider', YourProvider, {
  weight: 0.6,
  config: {
    apiKey: process.env.YOUR_API_KEY,
    timeout: 5000
  }
});
```

### Step 3: Use Provider

```javascript
const market = {
  marketId: 'market_123',
  oracleSource: 'your-provider',
  oracleConfig: {
    threshold: 100
  }
};

const result = await oracleService.resolveMarket(market);
console.log(result.outcome); // 'yes' or 'no'
```

## Template Providers

### Minimal Provider

```javascript
const BaseOracleProvider = require('../BaseOracleProvider');

class MinimalProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'minimal';
  }

  async resolve(market) {
    // Simple yes/no decision
    return {
      outcome: 'yes',
      confidence: 0.5,
      data: { source: 'minimal' }
    };
  }
}

module.exports = MinimalProvider;
```

### API-Based Provider

```javascript
const axios = require('axios');
const BaseOracleProvider = require('../BaseOracleProvider');

class ApiProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'api-provider';
    this.apiUrl = config.apiUrl || 'https://api.example.com';
    this.apiKey = process.env.API_KEY;
  }

  async resolve(market) {
    const config = market.oracleConfig || {};
    
    // Call external API
    const response = await axios.get(this.apiUrl, {
      params: {
        query: config.query
      },
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: this.timeout
    });

    // Parse response
    const value = response.data.value;
    const outcome = value > config.threshold ? 'yes' : 'no';

    return {
      outcome,
      confidence: 0.9,
      data: {
        source: this.name,
        value,
        timestamp: new Date().toISOString()
      }
    };
  }
}

module.exports = ApiProvider;
```

### Cached Provider

```javascript
const BaseOracleProvider = require('../BaseOracleProvider');

class CachedProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'cached-provider';
    this.cache = new Map();
    this.cacheDuration = config.cacheDuration || 5 * 60 * 1000;
  }

  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async resolve(market) {
    const cacheKey = market.marketId;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch fresh data
    const result = await this.fetchData(market);
    this.setCache(cacheKey, result);
    
    return result;
  }

  async fetchData(market) {
    throw new Error('Implement fetchData()');
  }
}

module.exports = CachedProvider;
```

### Multi-Source Provider

```javascript
const BaseOracleProvider = require('../BaseOracleProvider');

class MultiSourceProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'multi-source';
    this.sources = config.sources || [];
  }

  async resolve(market) {
    // Fetch from multiple sources
    const results = await Promise.all(
      this.sources.map(source => this.fetchFromSource(source, market))
    );

    // Aggregate results
    const yesCount = results.filter(r => r === 'yes').length;
    const outcome = yesCount > results.length / 2 ? 'yes' : 'no';
    const confidence = yesCount / results.length;

    return {
      outcome,
      confidence,
      data: {
        source: this.name,
        results,
        sourceCount: this.sources.length
      }
    };
  }

  async fetchFromSource(source, market) {
    // Implement source fetching
    throw new Error('Implement fetchFromSource()');
  }
}

module.exports = MultiSourceProvider;
```

## Configuration

### Market Configuration

```javascript
const market = {
  marketId: 'unique_id',
  category: 'crypto',              // Optional: for fallback routing
  oracleSource: 'your-provider',   // Primary provider
  oracleConfig: {                  // Provider-specific config
    // Your provider config here
  }
};

// With fallback chain
const marketWithFallback = {
  marketId: 'market_2',
  oracleConfig: {
    sources: ['provider1', 'provider2', 'provider3'],  // Fallback order
    // Config shared by all sources
  }
};
```

### Environment Variables

```bash
# For API-based providers
export YOUR_PROVIDER_API_KEY="your_key_here"
export YOUR_PROVIDER_API_URL="https://api.example.com"

# For existing providers
export COINGECKO_API_KEY="your_key"
export NEWS_API_KEY="your_key"
export SPORTS_API_KEY="your_key"
```

## Common Patterns

### Retry Logic

Built-in automatic retry with exponential backoff:

```javascript
// Automatically retries up to 3 times with 1-2-3 second delays
const result = await provider.resolveWithRetry(market);
```

Configure in provider:

```javascript
constructor(config = {}) {
  super(config);
  this.maxRetries = config.maxRetries || 3;
  this.retryDelay = config.retryDelay || 1000;
}
```

### Error Handling

```javascript
async resolve(market) {
  try {
    const data = await this.fetchData(market);
    if (!data) {
      throw new Error('No data returned');
    }
    return {
      outcome: 'yes',
      confidence: 0.9,
      data
    };
  } catch (error) {
    // Provider logs error, caller handles retry
    throw error;
  }
}
```

### Confidence Scoring

```javascript
// Confidence should reflect uncertainty (0.0 - 1.0)
const confidence = Math.min(
  dataFreshness *          // High confidence for fresh data
  sourceAgreement *        // High confidence if sources agree
  1.0                      // Cap at 1.0
);

return {
  outcome,
  confidence,
  data
};
```

## Testing Your Provider

```javascript
async function testYourProvider() {
  const oracleService = require('./services/oracleService');
  const YourProvider = require('./services/oracle/providers/YourProvider');

  // Initialize
  await oracleService.initialize();

  // Register
  oracleService.registerCustomProvider('test-provider', YourProvider, {
    weight: 0.5
  });

  // Test resolution
  const market = {
    marketId: 'test_1',
    oracleSource: 'test-provider',
    oracleConfig: {
      testParam: 'value'
    }
  };

  try {
    const result = await oracleService.resolveMarket(market);
    console.log('✓ Resolution successful:', result);
  } catch (error) {
    console.error('✗ Resolution failed:', error);
  }
}

testYourProvider();
```

## Checklist

- [ ] Create provider class extending BaseOracleProvider
- [ ] Implement `resolve()` method
- [ ] Implement `getSupportedMarketTypes()`
- [ ] Implement `validateConfig()` for validation
- [ ] Return correct result format: `{ outcome, confidence, data }`
- [ ] Handle errors and let resolveWithRetry manage retries
- [ ] Test with sample market configurations
- [ ] Register provider in initialization code
- [ ] Document provider configuration requirements
- [ ] Add environment variables if needed

## Examples in Repository

- CoinGecko: `backend/src/services/oracle/providers/CoinGeckoProvider.js`
- Sports API: `backend/src/services/oracle/providers/SportsApiProvider.js`
- News API: `backend/src/services/oracle/providers/NewsApiProvider.js`

## Support

For issues or questions:
1. Check [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md) for detailed docs
2. Review existing provider implementations
3. Check logs with `logger.oracle()` calls
4. Monitor provider health: `oracleService.getSourceHealthStatus()`
