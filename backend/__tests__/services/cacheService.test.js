const cacheService = require('../../src/services/cacheService');
const redisAdapter = require('../../src/services/redisAdapter');

jest.mock('../../src/services/redisAdapter', () => {
  const store = new Map();
  return {
    isConnected: true,
    _store: store,
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clearPattern: jest.fn(),
    messageHandlers: new Map()
  };
});

describe('CacheService Tests', () => {
  beforeEach(() => {
    redisAdapter._store.clear();
    jest.clearAllMocks();
    
    // Re-assign mock implementations to bypass resetMocks: true in jest.config.js
    redisAdapter.get.mockImplementation(async (key) => redisAdapter._store.get(key) || null);
    redisAdapter.set.mockImplementation(async (key, value, ttl) => {
      redisAdapter._store.set(key, value);
      return true;
    });
    redisAdapter.del.mockImplementation(async (key) => {
      redisAdapter._store.delete(key);
      return true;
    });
    redisAdapter.clearPattern.mockImplementation(async (pattern) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of redisAdapter._store.keys()) {
        if (regex.test(key)) {
          redisAdapter._store.delete(key);
        }
      }
      return true;
    });
  });

  test('should generate correct standardized cache keys', () => {
    expect(cacheService.getKeys.allMarkets()).toBe('market:all');
    expect(cacheService.getKeys.trendingMarkets()).toBe('market:trending');
    expect(cacheService.getKeys.marketDetail('123')).toBe('market:detail:123');
    expect(cacheService.getKeys.categoryMarkets('Sports')).toBe('market:category:Sports');
  });

  test('should set and get values from cache correctly', async () => {
    const data = { id: '1', question: 'Will it rain?' };
    await cacheService.set('test_key', data, 60);

    expect(redisAdapter.set).toHaveBeenCalledWith('test_key', data, 60);

    const retrieved = await cacheService.get('test_key');
    expect(redisAdapter.get).toHaveBeenCalledWith('test_key');
    expect(retrieved).toEqual(data);
  });

  test('should return null when cache has expired or does not exist', async () => {
    const result = await cacheService.get('non_existent');
    expect(result).toBeNull();
  });

  test('should evict cache keys properly', async () => {
    await cacheService.set('evict_key', 'some_value');
    await cacheService.evict('evict_key');

    expect(redisAdapter.del).toHaveBeenCalledWith('evict_key');
    
    const value = await cacheService.get('evict_key');
    expect(value).toBeNull();
  });

  test('should invalidate a market details and index lists', async () => {
    const marketId = 'm1';
    await cacheService.invalidateMarket(marketId, 'Finance');

    expect(redisAdapter.del).toHaveBeenCalledTimes(6); // detail, history, trades, all, trending, category
    expect(redisAdapter.clearPattern).toHaveBeenCalledWith('market:category:*');
  });

  test('should fail gracefully and return null when Redis is offline', async () => {
    redisAdapter.isConnected = false;
    
    const setSuccess = await cacheService.set('some_key', 'value');
    expect(setSuccess).toBe(false);

    const getValue = await cacheService.get('some_key');
    expect(getValue).toBeNull();

    redisAdapter.isConnected = true; // restore connection state
  });
});
