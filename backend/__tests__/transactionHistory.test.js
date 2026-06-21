const request = require('supertest');
const mongoose = require('mongoose');
const { IndexedEvent, Market, Trade, Position } = require('../src/models');
const app = require('../server');

describe('Transaction History API', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oryn-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear IndexedEvent collection before each test
    await IndexedEvent.deleteMany({});
    await Market.deleteMany({});
    await Trade.deleteMany({});
    await Position.deleteMany({});
  });

  describe('GET /api/transactions/history', () => {
    it('should return transaction history with pagination', async () => {
      // Create sample events
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: { test: 'data' }
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_made',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'investment',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 500.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: { test: 'data' }
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_withdrawn',
          txHash: 'c3d4e5f6a1b2',
          ledger: 12347,
          eventType: 'withdrawal',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 200.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: { test: 'data' }
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(3);
      expect(response.body.data.pagination.totalItems).toBe(3);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    it('should filter by eventType', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_made',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'investment',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 500.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history?eventType=investment')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].eventType).toBe('investment');
    });

    it('should filter by userAddress', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'trade',
          userAddress: 'GDEF9876543210',
          marketId: 'market-1',
          amount: 200.5,
          tokenType: 'no',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history?userAddress=GABC1234567890')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].userAddress).toBe('GABC1234567890');
    });

    it('should paginate results correctly', async () => {
      // Create 25 events
      const events = Array.from({ length: 25 }, (_, i) => ({
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        contractName: 'PREDICTION_MARKET_TEMPLATE',
        topic: 'trade_executed',
        txHash: `tx${i}`,
        ledger: 12345 + i,
        eventType: 'trade',
        userAddress: 'GABC1234567890',
        marketId: 'market-1',
        amount: 100 + i,
        tokenType: 'yes',
        status: 'confirmed',
        payload: {}
      }));

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(10);
      expect(response.body.data.pagination.currentPage).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(3);
      expect(response.body.data.pagination.totalItems).toBe(25);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {},
          createdAt: twoDaysAgo
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 200.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {},
          createdAt: yesterday
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get(`/api/transactions/history?startDate=${yesterday.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
    });
  });

  describe('GET /api/transactions/history/user/:userAddress', () => {
    it('should return user transaction history with statistics', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_made',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'investment',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 500.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history/user/GABC1234567890')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userAddress).toBe('GABC1234567890');
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing user address', async () => {
      const response = await request(app)
        .get('/api/transactions/history/user/')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/transactions/history/market/:marketId', () => {
    it('should return market transaction history', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'trade',
          userAddress: 'GDEF9876543210',
          marketId: 'market-1',
          amount: 200.5,
          tokenType: 'no',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history/market/market-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.marketId).toBe('market-1');
      expect(response.body.data.events).toHaveLength(2);
    });
  });

  describe('GET /api/transactions/history/tx/:txHash', () => {
    it('should return transaction by hash', async () => {
      const event = {
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        contractName: 'PREDICTION_MARKET_TEMPLATE',
        topic: 'trade_executed',
        txHash: 'a1b2c3d4e5f6',
        ledger: 12345,
        eventType: 'trade',
        userAddress: 'GABC1234567890',
        marketId: 'market-1',
        amount: 100.5,
        tokenType: 'yes',
        status: 'confirmed',
        reconciliationStatus: 'not_checked',
        payload: {}
      };

      await IndexedEvent.create(event);

      const response = await request(app)
        .get('/api/transactions/history/tx/a1b2c3d4e5f6')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.txHash).toBe('a1b2c3d4e5f6');
      expect(response.body.data.eventType).toBe('trade');
      expect(response.body.data.reconciliationStatus).toBe('not_checked');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/transactions/history/tx/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TRANSACTION_NOT_FOUND');
    });
  });

  describe('GET /api/transactions/history/statistics', () => {
    it('should return transaction statistics', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          reconciliationStatus: 'matched',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_made',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'investment',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 500.0,
          tokenType: 'yes',
          status: 'confirmed',
          reconciliationStatus: 'matched',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEvents).toBe(2);
      expect(response.body.data.byEventType).toBeDefined();
      expect(response.body.data.byStatus).toBeDefined();
      expect(response.body.data.byReconciliationStatus).toBeDefined();
      expect(response.body.data.volume).toBeDefined();
    });
  });

  describe('GET /api/transactions/history/investments', () => {
    it('should return investment events only', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_made',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'investment',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 500.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history/investments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].eventType).toBe('investment');
    });
  });

  describe('GET /api/transactions/history/withdrawals', () => {
    it('should return withdrawal events only', async () => {
      const events = [
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'investment_withdrawn',
          txHash: 'a1b2c3d4e5f6',
          ledger: 12345,
          eventType: 'withdrawal',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 200.0,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        },
        {
          contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
          contractName: 'PREDICTION_MARKET_TEMPLATE',
          topic: 'trade_executed',
          txHash: 'b2c3d4e5f6a1',
          ledger: 12346,
          eventType: 'trade',
          userAddress: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes',
          status: 'confirmed',
          payload: {}
        }
      ];

      await IndexedEvent.insertMany(events);

      const response = await request(app)
        .get('/api/transactions/history/withdrawals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].eventType).toBe('withdrawal');
    });
  });
});
