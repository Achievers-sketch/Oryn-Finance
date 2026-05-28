jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../src/config/logger', () => ({ oracle: jest.fn(), error: jest.fn() }));
jest.mock('../../src/models', () => ({ Market: {} }));

const axios = require('axios');
const oracleService = require('../../src/services/oracleService');

describe('OracleService', () => {
  beforeEach(() => {
    oracleService.setWeights({});
    oracleService.clearRetryQueue();
    oracleService.resultCache.clear();
    jest.clearAllMocks();
  });

  it('merges custom weights', () => {
    oracleService.setWeights({ coingecko: 0.8 });
    expect(oracleService.getWeights()).toEqual(expect.objectContaining({ coingecko: 0.8, 'news-api': 0.25 }));
  });

  it('aggregates weighted results', () => {
    const result = oracleService.aggregateResults([
      { source: 'coingecko', outcome: 'yes', confidence: 1, data: {} },
      { source: 'sports-api', outcome: 'yes', confidence: 0.9, data: {} },
      { source: 'news-api', outcome: 'no', confidence: 0.2, data: {} }
    ]);
    expect(['yes', 'no']).toContain(result.outcome);
    expect(result).toHaveProperty('confidence');
  });

  it('resolves crypto prices', async () => {
    axios.get.mockResolvedValueOnce({ data: { bitcoin: { usd: 65000 } } });
    await expect(oracleService.resolveCrypto({ oracleConfig: { symbol: 'bitcoin', targetPrice: 60000, condition: 'above' } })).resolves.toEqual(expect.objectContaining({ outcome: 'yes' }));
  });

  it('resolves sports outcomes', async () => {
    await expect(oracleService.resolveSports({ oracleConfig: { gameId: 'game-1', team: 'Team A', condition: 'win' } })).resolves.toEqual(expect.objectContaining({ outcome: 'yes' }));
  });

  it('resolves news sentiment', async () => {
    axios.get.mockResolvedValueOnce({ data: { articles: [{ title: 'Great success', description: 'good rise' }] } });
    await expect(oracleService.resolveNews({ oracleConfig: { keywords: ['oryn'], sentiment: 'positive', sources: [] } })).resolves.toEqual(expect.objectContaining({ outcome: 'yes' }));
  });

  it('queues failed oracle requests with fallback sources', async () => {
    oracleService.resolvers['test-primary'] = jest.fn().mockResolvedValue(null);

    const result = await oracleService.resolveWithFallback({
      marketId: 'market-retry-1',
      category: 'crypto',
      oracleConfig: { sources: ['test-primary'] }
    });

    const queueStatus = oracleService.getRetryQueueStatus();
    expect(result).toBeNull();
    expect(queueStatus.pending).toBe(1);
    expect(queueStatus.items[0]).toEqual(expect.objectContaining({
      marketId: 'market-retry-1',
      status: 'pending',
      sources: expect.arrayContaining(['test-primary', 'coingecko', 'chainlink'])
    }));
    expect(require('../../src/config/logger').oracle).toHaveBeenCalledWith(
      'Queued failed oracle request',
      expect.objectContaining({ marketId: 'market-retry-1' })
    );

    delete oracleService.resolvers['test-primary'];
  });

  it('retries queued requests through fallback providers and logs attempts', async () => {
    oracleService.resolvers['retry-primary'] = jest.fn().mockResolvedValue(null);
    oracleService.resolvers['retry-fallback'] = jest.fn().mockResolvedValue({
      outcome: 'yes',
      confidence: 0.88,
      data: { provider: 'fallback' }
    });

    oracleService.enqueueFailedRequest(
      {
        marketId: 'market-retry-2',
        category: 'generic',
        oracleSource: 'retry-primary',
        oracleConfig: {}
      },
      {
        sources: ['retry-primary', 'retry-fallback'],
        retryDelay: -1
      }
    );

    const processed = await oracleService.processRetryQueue(Date.now());
    const queueStatus = oracleService.getRetryQueueStatus();

    expect(processed).toHaveLength(1);
    expect(processed[0].result).toEqual(expect.objectContaining({ outcome: 'yes' }));
    expect(queueStatus.pending).toBe(0);
    expect(queueStatus.history[0]).toEqual(expect.objectContaining({
      marketId: 'market-retry-2',
      status: 'resolved',
      attempts: 1,
      sources: ['retry-fallback']
    }));
    expect(oracleService.resolvers['retry-primary']).toHaveBeenCalledTimes(1);
    expect(oracleService.resolvers['retry-fallback']).toHaveBeenCalledTimes(1);
    expect(require('../../src/config/logger').oracle).toHaveBeenCalledWith(
      'Processing queued oracle retry',
      expect.objectContaining({ marketId: 'market-retry-2', attempt: 1 })
    );

    delete oracleService.resolvers['retry-primary'];
    delete oracleService.resolvers['retry-fallback'];
  });
});
