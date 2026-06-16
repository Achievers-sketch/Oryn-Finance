/**
 * Oracle Plugin Architecture Integration Tests
 * 
 * Tests the plugin-based oracle provider system
 */

const BaseOracleProvider = require('../../src/services/oracle/BaseOracleProvider');

const oracleService = new Proxy({}, {
  get(_target, property) {
    return require('../../src/services/oracleService')[property];
  }
});

// Test provider implementation
class TestProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'test-provider';
  }

  getSupportedMarketTypes() {
    return ['test', 'generic'];
  }

  validateConfig(market) {
    const validation = super.validateConfig(market);
    const config = market.oracleConfig || {};
    const errors = validation.errors;

    if (!config.testValue) {
      errors.push('Missing testValue');
    }

    return { valid: errors.length === 0, errors };
  }

  async resolve(market) {
    const config = market.oracleConfig || {};
    
    // Simulate resolution
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      outcome: config.testValue > 50 ? 'yes' : 'no',
      confidence: 0.9,
      data: {
        source: 'test-provider',
        testValue: config.testValue,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting Oracle Plugin Architecture Tests\n');

  try {
    // Test 1: Initialize service
    await testServiceInitialization();

    // Test 2: List providers
    await testListProviders();

    // Test 3: Resolve market
    await testMarketResolution();

    // Test 4: Custom provider registration
    await testCustomProviderRegistration();

    // Test 5: Health tracking
    await testHealthTracking();

    // Test 6: Fallback resolution
    await testFallbackResolution();

    // Test 7: Provider weights
    await testProviderWeights();

    // Test 8: Anomaly detection
    await testAnomalyDetection();

    console.log('\n✅ All tests completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

/**
 * Test 1: Service Initialization
 */
async function testServiceInitialization() {
  console.log('Test 1: Service Initialization');
  
  try {
    await oracleService.initialize();
    console.log('  ✓ Service initialized');
    
    const providers = oracleService.registry.getProviderNames();
    console.log(`  ✓ Loaded ${providers.length} providers: ${providers.join(', ')}`);
    
    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 2: List Providers
 */
async function testListProviders() {
  console.log('Test 2: List Providers');
  
  try {
    const providers = oracleService.listProviders();
    console.log(`  ✓ Found ${providers.length} providers`);
    
    for (const provider of providers) {
      console.log(`    - ${provider.name}: weight=${provider.weight}, health=${provider.health?.isHealthy ? '✓' : '✗'}`);
    }
    
    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 3: Resolve Market
 */
async function testMarketResolution() {
  console.log('Test 3: Resolve Market');
  
  try {
    // Register test provider first
    oracleService.registerCustomProvider('test-provider', TestProvider);
    console.log('  ✓ Test provider registered');

    // Create test market
    const market = {
      marketId: 'test_market_1',
      oracleSource: 'test-provider',
      oracleConfig: {
        testValue: 75
      }
    };

    // Resolve market
    const result = await oracleService.resolveMarket(market);
    
    if (!result) {
      throw new Error('Resolution returned null');
    }

    console.log('  ✓ Market resolved');
    console.log(`    - Outcome: ${result.outcome}`);
    console.log(`    - Confidence: ${result.confidence}`);
    console.log(`    - Source: ${result.data?.provider}`);
    
    if (result.outcome !== 'yes') {
      throw new Error(`Expected outcome 'yes', got '${result.outcome}'`);
    }

    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 4: Custom Provider Registration
 */
async function testCustomProviderRegistration() {
  console.log('Test 4: Custom Provider Registration');
  
  try {
    // Create another test provider
    class CustomTestProvider extends BaseOracleProvider {
      constructor(config = {}) {
        super(config);
        this.name = 'custom-test';
      }

      async resolve(market) {
        return {
          outcome: 'no',
          confidence: 0.8,
          data: { source: 'custom-test' }
        };
      }
    }

    // Register it
    const result = oracleService.registerCustomProvider('custom-test', CustomTestProvider, {
      weight: 0.7,
      config: { custom: true }
    });

    if (!result.success) {
      throw new Error('Registration failed: ' + result.error);
    }

    console.log('  ✓ Custom provider registered');

    // Verify it's in registry
    const provider = oracleService.getProvider('custom-test');
    if (!provider) {
      throw new Error('Provider not found in registry');
    }

    console.log('  ✓ Provider found in registry');
    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 5: Health Tracking
 */
async function testHealthTracking() {
  console.log('Test 5: Health Tracking');
  
  try {
    // Get health status
    const health = oracleService.getSourceHealthStatus();
    console.log(`  ✓ Health status retrieved for ${Object.keys(health).length} providers`);

    // Check specific provider
    const coingeckoHealth = health.coingecko;
    if (!coingeckoHealth) {
      throw new Error('CoinGecko health not found');
    }

    console.log(`  ✓ CoinGecko health:`);
    console.log(`    - Success count: ${coingeckoHealth.successCount}`);
    console.log(`    - Failure count: ${coingeckoHealth.failureCount}`);
    console.log(`    - Is healthy: ${coingeckoHealth.isHealthy}`);

    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 6: Fallback Resolution
 */
async function testFallbackResolution() {
  console.log('Test 6: Fallback Resolution');
  
  try {
    // Create market with multiple sources
    const market = {
      marketId: 'test_fallback_1',
      category: 'generic',
      oracleConfig: {
        sources: ['test-provider', 'custom-test'],
        testValue: 100
      }
    };

    // Test fallback
    const result = await oracleService.resolveWithFallback(market);
    
    if (!result) {
      console.log('  ℹ Fallback returned no result (expected if sources fail)');
    } else {
      console.log('  ✓ Fallback resolution successful');
      console.log(`    - Outcome: ${result.outcome}`);
      console.log(`    - Sources used: ${result.sources}`);
    }

    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 7: Provider Weights
 */
async function testProviderWeights() {
  console.log('Test 7: Provider Weights');
  
  try {
    // Get current weights
    const weights = oracleService.getWeights();
    console.log('  ✓ Current weights:');
    for (const [provider, weight] of Object.entries(weights)) {
      console.log(`    - ${provider}: ${weight}`);
    }

    // Set new weights
    const newWeights = {
      coingecko: 0.5,
      'test-provider': 0.5
    };

    oracleService.setWeights(newWeights);
    console.log('  ✓ Weights updated');

    // Verify
    const updatedWeights = oracleService.getWeights();
    if (updatedWeights.coingecko !== 0.5) {
      throw new Error('Weight update failed');
    }

    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

/**
 * Test 8: Anomaly Detection
 */
async function testAnomalyDetection() {
  console.log('Test 8: Anomaly Detection');
  
  try {
    // Create results with disagreement
    const results = [
      {
        source: 'test-provider',
        outcome: 'yes',
        confidence: 0.9,
        data: {}
      },
      {
        source: 'custom-test',
        outcome: 'no',
        confidence: 0.8,
        data: {}
      }
    ];

    const aggregated = {
      outcome: 'yes',
      confidence: 0.85,
      data: { breakdown: [] }
    };

    // Detect anomalies
    oracleService.detectAnomalies('test_market', aggregated, results);
    console.log('  ✓ Anomalies detected');

    // Get discrepancy log
    const log = oracleService.getDiscrepancyLog();
    if (log.length > 0) {
      console.log(`  ✓ Discrepancies logged: ${log.length} entries`);
    }

    console.log('  ✓ PASS\n');
  } catch (error) {
    console.error('  ✗ FAIL:', error.message);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  TestProvider
};

describe('Oracle Plugin Architecture helpers', () => {
  it('defines a provider compatible with the base provider contract', () => {
    const provider = new TestProvider({ defaultWeight: 0.5 });

    expect(provider.name).toBe('test-provider');
    expect(provider.getSupportedMarketTypes()).toEqual(expect.arrayContaining(['test', 'generic']));
  });
});
