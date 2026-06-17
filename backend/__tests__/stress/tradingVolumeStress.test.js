'use strict';

/**
 * Protocol Stress Testing — Heavy Trading Volume
 * Issue #172: Simulate heavy trading volume under batch processing
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trade: jest.fn(),
}));

jest.mock('../../src/models', () => ({
  Trade: { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) },
  Market: { findOne: jest.fn() },
}));

jest.mock('../../src/services/sorobanService', () => ({
  executeBatchedTrades: jest.fn().mockResolvedValue({ hash: 'batch-tx-hash' }),
}));

jest.mock('../../src/services/stellarService', () => ({
  adminKeypair: {},
  Asset: jest.fn(),
  placeOrder: jest.fn().mockResolvedValue({ hash: 'stellar-tx' }),
}));

jest.mock('../../src/services/websocketHandler', () => ({
  broadcastMarketUpdate: jest.fn(),
  sendUserNotification: jest.fn(),
}));

const { StressTestRunner, StressMetrics } = require('./helpers');
const tradeBatcher = require('../../src/services/tradeBatcher');
const { Market } = require('../../src/models');
const sorobanService = require('../../src/services/sorobanService');

function resetTradeBatcher() {
  for (const timeout of tradeBatcher.batchTimeouts.values()) {
    clearTimeout(timeout);
  }
  tradeBatcher.pendingTrades.clear();
  tradeBatcher.batchTimeouts.clear();
  tradeBatcher.isProcessing.clear();
}

function mockMarket(marketId) {
  return {
    marketId,
    status: 'active',
    currentYesPrice: 0.55,
    currentNoPrice: 0.45,
    totalVolume: 50000,
    platformFee: 0.01,
    yesTokenAssetCode: 'YES',
    yesTokenIssuer: 'GISSUER',
    noTokenAssetCode: 'NO',
    noTokenIssuer: 'GISSUER',
    metadata: { contractAddress: 'CONTRACT_ADDR' },
    updatePrices: jest.fn(),
    addTrade: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
  };
}

describe('Protocol Stress — Heavy Trading Volume (#172)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTradeBatcher();
    Market.findOne.mockImplementation(({ marketId }) => Promise.resolve(mockMarket(marketId)));
  });

  afterEach(async () => {
    await tradeBatcher.processAllPending();
    resetTradeBatcher();
  });

  it('processes 100 concurrent trade enqueues across multiple markets', async () => {
    const result = await StressTestRunner.simulateTradingBurst({
      tradeCount: 100,
      concurrency: 25,
      enqueueTrade: (trade) => {
        tradeBatcher.addTrade({
          ...trade,
          userWalletAddress: `guser${trade.tradeId}`,
          maxSlippage: 0.05,
        });
      },
      waitForDrain: () => tradeBatcher.processAllPending(),
    });

    expect(result.enqueue.successCount).toBe(100);
    expect(result.enqueue.errorRate).toBe(0);
    expect(sorobanService.executeBatchedTrades).toHaveBeenCalled();
  });

  it('flushes batches immediately when max batch size is reached', async () => {
    const marketId = 'hot-market';
    const processSpy = jest.spyOn(tradeBatcher, 'processBatch');

    for (let i = 0; i < tradeBatcher.maxBatchSize; i += 1) {
      tradeBatcher.addTrade({
        tradeId: `batch-${i}`,
        marketId,
        tradeType: 'buy',
        tokenType: 'yes',
        amount: 50,
        price: 0.6,
        userWalletAddress: 'gtrader',
      });
    }

    expect(processSpy).toHaveBeenCalledWith(marketId);
    await tradeBatcher.processAllPending();

    const stats = tradeBatcher.getBatchStats();
    expect(stats.totalPendingTrades).toBe(0);
    processSpy.mockRestore();
  });

  it('maintains low error rate under sustained burst load', async () => {
    const metrics = new StressMetrics('sustained_trading_burst');
    metrics.start();

    const rounds = 5;
    const tradesPerRound = 20;

    for (let round = 0; round < rounds; round += 1) {
      const roundStart = Date.now();
      await StressTestRunner.runConcurrent(
        (i) => {
          tradeBatcher.addTrade({
            tradeId: `round-${round}-trade-${i}`,
            marketId: `market-${i % 3}`,
            tradeType: 'buy',
            tokenType: 'yes',
            amount: 25,
            price: 0.55,
            userWalletAddress: `gwallet-${i}`,
          });
          return Promise.resolve();
        },
        { iterations: tradesPerRound, concurrency: 10, label: 'enqueue' }
      );
      await tradeBatcher.processAllPending();
      metrics.record(`round_${round}`, Date.now() - roundStart, true);
    }

    metrics.end();
    const report = metrics.assertThresholds({ maxErrorRate: 0.05 });

    expect(report.totalOperations).toBe(rounds);
    expect(sorobanService.executeBatchedTrades.mock.calls.length).toBeGreaterThan(0);
  });

  it('reports throughput metrics for batch execution', async () => {
    const metrics = new StressMetrics('batch_throughput');
    metrics.start();

    for (let i = 0; i < 50; i += 1) {
      const start = Date.now();
      tradeBatcher.addTrade({
        tradeId: `throughput-${i}`,
        marketId: 'throughput-market',
        tradeType: i % 2 === 0 ? 'buy' : 'sell',
        tokenType: 'yes',
        amount: 10,
        price: 0.5,
        userWalletAddress: 'gtrader',
      });
      metrics.record('enqueue', Date.now() - start, true);
    }

    const batchStart = Date.now();
    await tradeBatcher.processAllPending();
    metrics.record('batch_process', Date.now() - batchStart, true);
    metrics.end();

    const report = metrics.toReport();
    expect(report.successCount).toBe(51);
    expect(report.throughputOpsPerSec).toBeGreaterThan(0);
    expect(report.latencyMs.p95).toBeGreaterThanOrEqual(0);
  });
});
