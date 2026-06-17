'use strict';

const BaseOracleProvider = require('../../../src/services/oracle/BaseOracleProvider');

/**
 * Configurable oracle provider for stress and chaos scenarios.
 * Issue #172: Simulate oracle failures under load
 */
class MockStressOracleProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = config.name || 'stress-oracle';
    this.shouldFail = config.shouldFail || false;
    this.failUntil = config.failUntil || null;
    this.resolveDelayMs = config.resolveDelayMs || 0;
    this.resolveCount = 0;
    this.failureMode = config.failureMode || 'throw'; // 'throw' | 'timeout' | 'stale'
  }

  getSupportedMarketTypes() {
    return ['crypto', 'sports', 'generic', 'test'];
  }

  async resolve(market) {
    this.resolveCount += 1;
    const start = Date.now();

    if (this.shouldFail) {
      this.recordFailure();
      throw new Error(`Provider ${this.name} simulated failure`);
    }

    if (this.failUntil && Date.now() < this.failUntil) {
      this.recordFailure();
      throw new Error(`Provider ${this.name} unavailable until recovery`);
    }

    if (this.failureMode === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, this.timeout + 100));
      this.recordFailure();
      throw new Error(`Provider ${this.name} timed out`);
    }

    if (this.resolveDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.resolveDelayMs));
    }

    this.recordSuccess();

    return {
      outcome: 'yes',
      confidence: 0.85,
      data: {
        source: this.name,
        marketId: market?.marketId || 'unknown',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    };
  }

  simulateRecovery() {
    this.shouldFail = false;
    this.failUntil = null;
    this.health.isHealthy = true;
  }

  simulateOutage(durationMs = 100) {
    this.failUntil = Date.now() + durationMs;
  }
}

module.exports = MockStressOracleProvider;
