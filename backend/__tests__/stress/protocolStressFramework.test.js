'use strict';

/**
 * Protocol Stress Testing Framework — Core utilities validation
 * Issue #172
 */

const { StressMetrics, StressTestRunner, MockStressOracleProvider } = require('./helpers');

describe('Protocol Stress Testing Framework (#172)', () => {
  it('StressMetrics computes latency percentiles and throughput', () => {
    const metrics = new StressMetrics('unit_test');
    metrics.start();

    [10, 20, 30, 40, 100].forEach((ms) => metrics.record('op', ms, true));
    metrics.record('op', 50, false);
    metrics.recordError('op', new Error('simulated'));

    metrics.end();
    const report = metrics.toReport();

    expect(report.totalOperations).toBe(7);
    expect(report.errorCount).toBe(2);
    expect(report.latencyMs.p50).toBeGreaterThan(0);
    expect(report.latencyMs.p95).toBeGreaterThanOrEqual(report.latencyMs.p50);
    expect(report.throughputOpsPerSec).toBeGreaterThan(0);
  });

  it('StressMetrics.assertThresholds throws when limits exceeded', () => {
    const metrics = new StressMetrics('threshold_test');
    metrics.start();
    metrics.record('op', 10, false);
    metrics.recordError('op', new Error('fail'));
    metrics.end();

    expect(() => metrics.assertThresholds({ maxErrorRate: 0 })).toThrow(/errorRate/);
  });

  it('StressTestRunner.runConcurrent respects concurrency bounds', async () => {
    let maxConcurrent = 0;
    let current = 0;

    const metrics = await StressTestRunner.runConcurrent(
      async () => {
        current += 1;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise((resolve) => setTimeout(resolve, 5));
        current -= 1;
      },
      { iterations: 20, concurrency: 4, label: 'bounded' }
    );

    expect(metrics.successCount).toBe(20);
    expect(maxConcurrent).toBeLessThanOrEqual(4);
  });

  it('MockStressOracleProvider supports failure and recovery modes', async () => {
    const provider = new MockStressOracleProvider({ name: 'mode-test', shouldFail: true });

    await expect(provider.resolve({ marketId: 'm1' })).rejects.toThrow(/simulated failure/);

    provider.simulateRecovery();
    const result = await provider.resolve({ marketId: 'm1' });
    expect(result.outcome).toBe('yes');
    expect(provider.resolveCount).toBe(2);
  });
});
