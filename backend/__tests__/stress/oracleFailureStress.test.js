'use strict';

/**
 * Protocol Stress Testing — Oracle Failures
 * Issue #172: Simulate oracle failures, fallback chains, and partial outages
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  oracle: jest.fn(),
}));

const { StressTestRunner, MockStressOracleProvider } = require('./helpers');

describe('Protocol Stress — Oracle Failures (#172)', () => {
  const market = { marketId: 'btc-100k', category: 'crypto' };

  it('handles primary oracle outage via fallback chain under concurrent load', async () => {
    const primary = new MockStressOracleProvider({ name: 'coingecko', shouldFail: true });
    const fallback = new MockStressOracleProvider({ name: 'chainlink', shouldFail: false });
    const tertiary = new MockStressOracleProvider({ name: 'sports-api', shouldFail: false });

    const { summary, fallbackSuccessRate } = await StressTestRunner.simulateOracleFailureLoad({
      providers: [primary, fallback, tertiary],
      market,
      iterations: 50,
      concurrency: 15,
    });

    expect(summary.successCount).toBe(50);
    expect(summary.errorRate).toBe(0);
    expect(fallbackSuccessRate).toBe(1);
    expect(fallback.resolveCount).toBe(50);
    expect(primary.resolveCount).toBe(50);
  });

  it('survives partial oracle cluster outage (30% nodes down)', async () => {
    const providers = Array.from({ length: 10 }, (_, i) =>
      new MockStressOracleProvider({
        name: `oracle-node-${i}`,
        shouldFail: i < 3,
      })
    );

    const metrics = await StressTestRunner.runConcurrent(
      async () => {
        const healthyProviders = providers.filter((p) => !p.shouldFail);
        const result = await StressTestRunner.resolveWithFallbackChain(
          providers,
          market,
          { record: () => {}, recordError: () => {}, samples: [], errors: [] }
        );
        if (!result) throw new Error('No healthy oracle');
        expect(healthyProviders.some((p) => p.name === result.provider)).toBe(true);
      },
      { iterations: 40, concurrency: 10, label: 'partial_outage' }
    );

    expect(metrics.successCount).toBe(40);
    expect(metrics.errorRate).toBe(0);
  });

  it('detects total oracle failure when all providers are down', async () => {
    const deadChain = [
      new MockStressOracleProvider({ name: 'dead-1', shouldFail: true }),
      new MockStressOracleProvider({ name: 'dead-2', shouldFail: true }),
      new MockStressOracleProvider({ name: 'dead-3', shouldFail: true }),
    ];

    const { summary } = await StressTestRunner.simulateOracleFailureLoad({
      providers: deadChain,
      market,
      iterations: 10,
      concurrency: 5,
    });

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBeGreaterThan(0);
    expect(summary.errorRate).toBe(1);
  });

  it('recovers after transient oracle outage without cascading failures', async () => {
    const provider = new MockStressOracleProvider({ name: 'transient-oracle' });
    provider.simulateOutage(80);

    const outageMetrics = await StressTestRunner.runConcurrent(
      () => provider.resolve(market),
      { iterations: 5, concurrency: 5, label: 'during_outage' }
    );
    expect(outageMetrics.successCount).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const recoveryMetrics = await StressTestRunner.runConcurrent(
      () => provider.resolve(market),
      { iterations: 10, concurrency: 5, label: 'after_recovery' }
    );

    expect(recoveryMetrics.successCount).toBe(10);
    expect(recoveryMetrics.errorRate).toBe(0);
  });

  it('handles rapid concurrent failures without crashing the service', async () => {
    const unstable = new MockStressOracleProvider({ name: 'hammered', shouldFail: true });

    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        unstable.resolve(market).catch((err) => ({ failed: true, message: err.message }))
      )
    );

    expect(results.every((r) => r.failed === true)).toBe(true);
    expect(unstable.resolveCount).toBe(30);
    expect(unstable.health.failureCount).toBe(30);
  });

  it('aggregates consensus from healthy providers during mixed failure window', async () => {
    const providers = [
      new MockStressOracleProvider({ name: 'p1', shouldFail: true }),
      new MockStressOracleProvider({ name: 'p2', shouldFail: false }),
      new MockStressOracleProvider({ name: 'p3', shouldFail: true }),
      new MockStressOracleProvider({ name: 'p4', shouldFail: false }),
    ];

    const resolutions = [];
    for (const provider of providers) {
      try {
        const result = await provider.resolve(market);
        resolutions.push(result);
      } catch {
        /* skip failed nodes */
      }
    }

    const yesWeight = resolutions.reduce((sum, r) => sum + r.confidence, 0);
    expect(resolutions.length).toBe(2);
    expect(yesWeight).toBeGreaterThan(1.5);
  });
});
