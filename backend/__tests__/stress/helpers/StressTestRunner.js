'use strict';

const StressMetrics = require('./StressMetrics');

/**
 * Orchestrates concurrent load, failure injection, and recovery benchmarks.
 * Issue #172: Protocol Stress Testing Framework
 */
class StressTestRunner {
  /**
   * Execute an async operation many times with bounded concurrency.
   */
  static async runConcurrent(operation, { iterations = 100, concurrency = 10, label = 'concurrent' } = {}) {
    const metrics = new StressMetrics(label);
    metrics.start();

    let index = 0;

    const worker = async () => {
      while (index < iterations) {
        const current = index;
        index += 1;
        const opStart = Date.now();
        try {
          await operation(current);
          metrics.record(label, Date.now() - opStart, true);
        } catch (error) {
          metrics.record(label, Date.now() - opStart, false);
          metrics.recordError(`${label}:${current}`, error);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, iterations) }, () => worker());
    await Promise.all(workers);

    metrics.end();
    return metrics;
  }

  /**
   * Walk a fallback chain of oracle providers until one succeeds.
   */
  static async resolveWithFallbackChain(providers, market, metrics) {
    for (const provider of providers) {
      const start = Date.now();
      try {
        const result = await provider.resolve(market);
        metrics.record('oracle_resolve', Date.now() - start, true);
        return { result, provider: provider.name, usedFallback: provider !== providers[0] };
      } catch (error) {
        metrics.record('oracle_resolve', Date.now() - start, false);
        metrics.recordError(`oracle:${provider.name}`, error);
      }
    }
    return null;
  }

  /**
   * Simulate oracle failures under load with optional fallback chain.
   */
  static async simulateOracleFailureLoad({
    providers,
    market = { marketId: 'stress-market' },
    iterations = 50,
    concurrency = 10,
    label = 'oracle_failure_load',
  } = {}) {
    const metrics = new StressMetrics(label);
    metrics.start();

    const operation = async () => {
      const resolution = await StressTestRunner.resolveWithFallbackChain(providers, market, metrics);
      if (!resolution) {
        throw new Error('All oracle providers failed');
      }
      return resolution;
    };

    const loadMetrics = await StressTestRunner.runConcurrent(operation, {
      iterations,
      concurrency,
      label: 'oracle_request',
    });

    metrics.end();

    return {
      summary: loadMetrics.toReport(),
      fallbackSuccessRate: loadMetrics.successCount / Math.max(loadMetrics.totalOperations, 1),
    };
  }

  /**
   * Measure how long until a health check passes after injected failure.
   */
  static async benchmarkRecovery({
    triggerFailure,
    checkHealthy,
    maxAttempts = 20,
    intervalMs = 10,
    label = 'recovery_benchmark',
  } = {}) {
    const metrics = new StressMetrics(label);
    metrics.start();

    if (triggerFailure) {
      await triggerFailure();
    }

    const recoveryStart = Date.now();
    let recovered = false;
    let attempts = 0;

    while (!recovered && attempts < maxAttempts) {
      attempts += 1;
      const attemptStart = Date.now();
      try {
        recovered = await checkHealthy();
        metrics.record('recovery_check', Date.now() - attemptStart, recovered);
        if (!recovered) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        metrics.record('recovery_check', Date.now() - attemptStart, false);
        metrics.recordError(`recovery_attempt_${attempts}`, error);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    const recoveryTimeMs = recovered ? Date.now() - recoveryStart : null;
    metrics.end();

    return {
      recovered,
      attempts,
      recoveryTimeMs,
      report: metrics.toReport(),
    };
  }

  /**
   * Burst trades into a batch processor and wait for completion.
   */
  static async simulateTradingBurst({
    enqueueTrade,
    waitForDrain,
    tradeCount = 100,
    concurrency = 20,
    label = 'trading_burst',
  } = {}) {
    const metrics = new StressMetrics(label);
    metrics.start();

    const enqueueMetrics = await StressTestRunner.runConcurrent(
      (i) =>
        enqueueTrade({
          tradeId: `stress-trade-${i}`,
          marketId: `market-${i % 5}`,
          tradeType: i % 2 === 0 ? 'buy' : 'sell',
          tokenType: i % 3 === 0 ? 'no' : 'yes',
          amount: 100 + (i % 50),
          price: 0.5 + (i % 10) * 0.01,
        }),
      { iterations: tradeCount, concurrency, label: 'enqueue_trade' }
    );

    const drainStart = Date.now();
    await waitForDrain();
    metrics.record('drain_batches', Date.now() - drainStart, true);
    metrics.end();

    return {
      enqueue: enqueueMetrics.toReport(),
      totalDurationMs: metrics.durationMs,
      throughputTradesPerSec: enqueueMetrics.throughputOpsPerSec,
    };
  }
}

module.exports = StressTestRunner;
