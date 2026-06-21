const mongoose = require('mongoose');
const { IndexedEvent, Trade, Market, Position } = require('../src/models');
const eventReconciliationService = require('../src/services/eventReconciliationService');

describe('Event Reconciliation Service', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oryn-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await IndexedEvent.deleteMany({});
    await Trade.deleteMany({});
    await Market.deleteMany({});
    await Position.deleteMany({});
  });

  describe('reconcileEvent', () => {
    it('should reconcile a trade event with matching database record', async () => {
      // Create a trade record
      const trade = await Trade.create({
        tradeId: 'test-trade-1',
        marketId: 'market-1',
        userWalletAddress: 'GABC1234567890',
        tradeType: 'buy',
        tokenType: 'yes',
        amount: 100.5,
        price: 0.5,
        totalCost: 50.25,
        status: 'confirmed',
        stellarTransactionHash: 'a1b2c3d4e5f6',
        timestamp: new Date()
      });

      // Create an indexed event
      const event = await IndexedEvent.create({
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
      });

      // Mock the blockchain verification to return true
      jest.spyOn(eventReconciliationService, 'verifyEventOnChain').mockResolvedValue(true);

      await eventReconciliationService.reconcileEvent(event);

      const updatedEvent = await IndexedEvent.findById(event._id);
      expect(updatedEvent.reconciliationStatus).toBe('matched');
      expect(updatedEvent.reconciliationAttempts).toBe(1);
      expect(updatedEvent.lastReconciledAt).toBeDefined();
    });

    it('should mark event as mismatched when database record not found', async () => {
      const event = await IndexedEvent.create({
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
      });

      jest.spyOn(eventReconciliationService, 'verifyEventOnChain').mockResolvedValue(true);

      await eventReconciliationService.reconcileEvent(event);

      const updatedEvent = await IndexedEvent.findById(event._id);
      expect(updatedEvent.reconciliationStatus).toBe('mismatch');
      expect(updatedEvent.reconciliationError).toBe('Database record mismatch');
    });

    it('should mark event as error when blockchain verification fails', async () => {
      const event = await IndexedEvent.create({
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
      });

      jest.spyOn(eventReconciliationService, 'verifyEventOnChain').mockResolvedValue(false);

      await eventReconciliationService.reconcileEvent(event);

      const updatedEvent = await IndexedEvent.findById(event._id);
      expect(updatedEvent.reconciliationStatus).toBe('mismatch');
      expect(updatedEvent.reconciliationError).toBe('Blockchain verification failed');
    });

    it('should increment reconciliation attempts on each attempt', async () => {
      const event = await IndexedEvent.create({
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
        reconciliationAttempts: 2,
        payload: {}
      });

      jest.spyOn(eventReconciliationService, 'verifyEventOnChain').mockResolvedValue(false);

      await eventReconciliationService.reconcileEvent(event);

      const updatedEvent = await IndexedEvent.findById(event._id);
      expect(updatedEvent.reconciliationAttempts).toBe(3);
    });
  });

  describe('verifyTradeEvent', () => {
    it('should verify trade event matches database record', async () => {
      await Trade.create({
        tradeId: 'test-trade-1',
        marketId: 'market-1',
        userWalletAddress: 'GABC1234567890',
        tradeType: 'buy',
        tokenType: 'yes',
        amount: 100.5,
        price: 0.5,
        totalCost: 50.25,
        status: 'confirmed',
        stellarTransactionHash: 'a1b2c3d4e5f6',
        timestamp: new Date()
      });

      const event = {
        txHash: 'a1b2c3d4e5f6',
        marketId: 'market-1',
        userAddress: 'GABC1234567890',
        amount: '100.5',
        eventType: 'trade'
      };

      const result = await eventReconciliationService.verifyTradeEvent(event);
      expect(result).toBe(true);
    });

    it('should return false when trade record not found', async () => {
      const event = {
        txHash: 'nonexistent',
        marketId: 'market-1',
        userAddress: 'GABC1234567890',
        amount: '100.5',
        eventType: 'trade'
      };

      const result = await eventReconciliationService.verifyTradeEvent(event);
      expect(result).toBe(false);
    });
  });

  describe('verifyMarketCreationEvent', () => {
    it('should verify market creation event', async () => {
      await Market.create({
        marketId: 'market-1',
        question: 'Test question',
        category: 'crypto',
        creatorWalletAddress: 'GABC1234567890',
        expiresAt: new Date(Date.now() + 86400000),
        status: 'active',
        blockchainTxHash: 'a1b2c3d4e5f6',
        createdAt: new Date()
      });

      const event = {
        txHash: 'a1b2c3d4e5f6',
        marketId: 'market-1',
        eventType: 'market_creation'
      };

      const result = await eventReconciliationService.verifyMarketCreationEvent(event);
      expect(result).toBe(true);
    });

    it('should return false when market not found', async () => {
      const event = {
        txHash: 'nonexistent',
        marketId: 'market-1',
        eventType: 'market_creation'
      };

      const result = await eventReconciliationService.verifyMarketCreationEvent(event);
      expect(result).toBe(false);
    });
  });

  describe('detectDuplicates', () => {
    it('should detect and remove duplicate events', async () => {
      // Create duplicate events
      const eventData = {
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
      };

      await IndexedEvent.create(eventData);
      await IndexedEvent.create(eventData);
      await IndexedEvent.create(eventData);

      const result = await eventReconciliationService.detectDuplicates();

      expect(result.success).toBe(true);
      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesRemoved).toBe(2);

      const remainingEvents = await IndexedEvent.countDocuments({ txHash: 'a1b2c3d4e5f6' });
      expect(remainingEvents).toBe(1);
    });

    it('should not remove events when no duplicates exist', async () => {
      await IndexedEvent.create({
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
      });

      await IndexedEvent.create({
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
        payload: {}
      });

      const result = await eventReconciliationService.detectDuplicates();

      expect(result.success).toBe(true);
      expect(result.duplicatesFound).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('getReconciliationStats', () => {
    it('should return reconciliation statistics', async () => {
      await IndexedEvent.create({
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
      });

      await IndexedEvent.create({
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
        reconciliationStatus: 'mismatch',
        payload: {}
      });

      await IndexedEvent.create({
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        contractName: 'PREDICTION_MARKET_TEMPLATE',
        topic: 'trade_executed',
        txHash: 'c3d4e5f6a1b2',
        ledger: 12347,
        eventType: 'trade',
        userAddress: 'GABC1234567890',
        marketId: 'market-1',
        amount: 300.5,
        tokenType: 'yes',
        status: 'confirmed',
        reconciliationStatus: 'not_checked',
        payload: {}
      });

      const stats = await eventReconciliationService.getReconciliationStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.matched).toBe(1);
      expect(stats.mismatched).toBe(1);
      expect(stats.notChecked).toBe(1);
      expect(stats.reconciliationRate).toBe('33.33');
    });

    it('should handle empty database', async () => {
      const stats = await eventReconciliationService.getReconciliationStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.matched).toBe(0);
      expect(stats.mismatched).toBe(0);
      expect(stats.reconciliationRate).toBe('0');
    });
  });

  describe('reconcileTransaction', () => {
    it('should reconcile a specific transaction', async () => {
      const event = await IndexedEvent.create({
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
      });

      jest.spyOn(eventReconciliationService, 'verifyEventOnChain').mockResolvedValue(true);
      jest.spyOn(eventReconciliationService, 'verifyEventWithDatabase').mockResolvedValue(true);

      const result = await eventReconciliationService.reconcileTransaction('a1b2c3d4e5f6');

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('a1b2c3d4e5f6');
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(
        eventReconciliationService.reconcileTransaction('nonexistent')
      ).rejects.toThrow('Event not found');
    });
  });
});
