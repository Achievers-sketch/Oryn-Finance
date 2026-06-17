'use strict';

/**
 * Protocol Stress Testing — Recovery Performance Benchmarks
 * Issue #172: Benchmark recovery performance for tx retry queue and service health
 */

jest.useFakeTimers();

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../src/services/sorobanService', () => ({
  submitSignedTransaction: jest.fn(),
  getHealth: jest.fn(),
}));

const sorobanService = require('../../src/services/sorobanService');
const retryQueue = require('../../src/services/transactionRetryQueue');
const { StressTestRunner, StressMetrics } = require('./helpers');

describe('Protocol Stress — Recovery Benchmarks (#172)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retryQueue.recentFailures = [];
    retryQueue.recentSuccesses = [];
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('benchmarks transaction recovery after transient RPC failure', async () => {
    let attempt = 0;
    sorobanService.submitSignedTransaction.mockImplementation(async () => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error('Soroban RPC unavailable');
      }
      return { hash: 'recovered-tx-hash' };
    });

    const job = {
      jobId: 'stress-recovery-1',
      signedXDR: 'XDR_STRESS',
      txHash: null,
      attempt: 0,
    };

    const benchmarkStart = Date.now();
    await retryQueue.processJob(job);
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    const recoveryTimeMs = Date.now() - benchmarkStart;
    const snapshot = retryQueue.getRecoverySnapshot();

    expect(snapshot.recentRecoveries).toHaveLength(1);
    expect(snapshot.recentRecoveries[0].txHash).toBe('recovered-tx-hash');
    expect(attempt).toBe(3);
    expect(recoveryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('benchmarks concurrent transaction enqueue under outage', async () => {
    sorobanService.submitSignedTransaction.mockRejectedValue(new Error('network partition'));

    const enqueueResults = await StressTestRunner.runConcurrent(
      (i) => Promise.resolve(retryQueue.enqueue({ signedXDR: `XDR_${i}`, txHash: null })),
      { iterations: 25, concurrency: 10, label: 'enqueue' }
    );

    await retryQueue.processJob({
      jobId: 'stress-exhaust-representative',
      signedXDR: 'XDR_STRESS',
      txHash: null,
      attempt: 0,
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    const report = enqueueResults.toReport();
    const snapshot = retryQueue.getRecoverySnapshot();

    expect(report.successCount).toBe(25);
    expect(report.errorRate).toBe(0);
    expect(snapshot.recentFailures.length).toBeGreaterThan(0);
  });

  it('records recovery snapshot metrics after exhausted retries', async () => {
    sorobanService.submitSignedTransaction.mockRejectedValue(new Error('persistent outage'));

    await retryQueue.processJob({
      jobId: 'exhausted-job',
      signedXDR: 'XDR_FAIL',
      txHash: 'hash-fail',
      attempt: 0,
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    const snapshot = retryQueue.getRecoverySnapshot();
    expect(snapshot.recentFailures[0]).toEqual(
      expect.objectContaining({
        jobId: 'exhausted-job',
        attempts: 4,
        message: 'persistent outage',
      })
    );
    expect(snapshot.maxAttempts).toBe(4);
    expect(snapshot.backoffMs).toBe(2000);
  });

  it('validates service health transition from degraded to healthy', async () => {
    let sorobanHealthy = false;
    sorobanService.getHealth.mockImplementation(async () => {
      if (!sorobanHealthy) throw new Error('Soroban RPC unavailable');
      return { status: 'healthy', latestLedger: 5000 };
    });

    const degradedCheck = await sorobanService.getHealth().catch(() => ({ status: 'degraded' }));
    expect(degradedCheck.status).toBe('degraded');

    sorobanHealthy = true;

    const benchmark = await StressTestRunner.benchmarkRecovery({
      checkHealthy: async () => {
        const health = await sorobanService.getHealth();
        return health.status === 'healthy';
      },
      maxAttempts: 5,
      intervalMs: 5,
    });

    expect(benchmark.recovered).toBe(true);
    expect(benchmark.recoveryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reports structured benchmark metrics for recovery operations', async () => {
    sorobanService.submitSignedTransaction.mockResolvedValue({ hash: 'fast-recovery' });

    const metrics = new StressMetrics('fast_recovery');
    metrics.start();

    for (let i = 0; i < 10; i += 1) {
      const start = Date.now();
      const { jobId } = retryQueue.enqueue({ signedXDR: `XDR_FAST_${i}`, txHash: null });
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      metrics.record('tx_recovery', Date.now() - start, true);
      expect(jobId).toMatch(/^tx_/);
    }

    metrics.end();
    const report = metrics.assertThresholds({ maxErrorRate: 0.05 });

    expect(report.totalOperations).toBe(10);
    expect(retryQueue.getRecoverySnapshot().recentRecoveries.length).toBeGreaterThanOrEqual(10);
  });
});
