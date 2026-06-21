const mongoose = require('mongoose');
const { IndexedEvent, Market, Trade, Position } = require('../src/models');
const contractEventIndexer = require('../src/services/contractEventIndexer');

describe('Contract Event Indexer', () => {
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
    await Market.deleteMany({});
    await Trade.deleteMany({});
    await Position.deleteMany({});
  });

  describe('extractEventMetadata', () => {
    it('should extract metadata from investment event', () => {
      const eventValue = {
        investor: 'GABC1234567890',
        marketId: 'market-1',
        amount: 500.0,
        tokenType: 'yes'
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'investment_made', eventValue);

      expect(metadata.eventType).toBe('investment');
      expect(metadata.userAddress).toBe('GABC1234567890');
      expect(metadata.marketId).toBe('market-1');
      expect(metadata.amount).toBe(500.0);
      expect(metadata.tokenType).toBe('yes');
    });

    it('should extract metadata from withdrawal event', () => {
      const eventValue = {
        withdrawer: 'GABC1234567890',
        marketId: 'market-1',
        withdrawalAmount: 200.0,
        tokenType: 'no'
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'investment_withdrawn', eventValue);

      expect(metadata.eventType).toBe('withdrawal');
      expect(metadata.userAddress).toBe('GABC1234567890');
      expect(metadata.marketId).toBe('market-1');
      expect(metadata.amount).toBe(200.0);
      expect(metadata.tokenType).toBe('no');
    });

    it('should extract metadata from trade event', () => {
      const eventValue = {
        user: 'GABC1234567890',
        marketId: 'market-1',
        amount: 100.5,
        tokenType: 'yes',
        price: 0.5
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'trade_executed', eventValue);

      expect(metadata.eventType).toBe('trade');
      expect(metadata.userAddress).toBe('GABC1234567890');
      expect(metadata.marketId).toBe('market-1');
      expect(metadata.amount).toBe(100.5);
      expect(metadata.tokenType).toBe('yes');
    });

    it('should default to other event type for unknown topics', () => {
      const eventValue = {
        user: 'GABC1234567890',
        marketId: 'market-1',
        amount: 100.0
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'unknown_event', eventValue);

      expect(metadata.eventType).toBe('other');
    });

    it('should handle events with yesToken field', () => {
      const eventValue = {
        user: 'GABC1234567890',
        marketId: 'market-1',
        yesToken: 'YES123'
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'trade_executed', eventValue);

      expect(metadata.tokenType).toBe('yes');
    });

    it('should handle events with noToken field', () => {
      const eventValue = {
        user: 'GABC1234567890',
        marketId: 'market-1',
        noToken: 'NO456'
      };

      const metadata = contractEventIndexer.extractEventMetadata('PREDICTION_MARKET_TEMPLATE', 'trade_executed', eventValue);

      expect(metadata.tokenType).toBe('no');
    });
  });

  describe('getEventHandler', () => {
    it('should return correct handler for trade_executed event', () => {
      const handler = contractEventIndexer.getEventHandler('PREDICTION_MARKET_TEMPLATE', 'trade_executed');
      expect(handler).toBeDefined();
      expect(handler.name).toBe('bound handleTradeExecuted');
    });

    it('should return correct handler for investment_made event', () => {
      const handler = contractEventIndexer.getEventHandler('PREDICTION_MARKET_TEMPLATE', 'investment_made');
      expect(handler).toBeDefined();
      expect(handler.name).toBe('bound handleInvestmentMade');
    });

    it('should return correct handler for investment_withdrawn event', () => {
      const handler = contractEventIndexer.getEventHandler('PREDICTION_MARKET_TEMPLATE', 'investment_withdrawn');
      expect(handler).toBeDefined();
      expect(handler.name).toBe('bound handleInvestmentWithdrawn');
    });

    it('should return correct handler for liquidity_withdrawn event', () => {
      const handler = contractEventIndexer.getEventHandler('AMM_POOL', 'liquidity_withdrawn');
      expect(handler).toBeDefined();
      expect(handler.name).toBe('bound handleLiquidityWithdrawn');
    });

    it('should return undefined for unknown contract', () => {
      const handler = contractEventIndexer.getEventHandler('UNKNOWN_CONTRACT', 'trade_executed');
      expect(handler).toBeUndefined();
    });

    it('should return undefined for unknown topic', () => {
      const handler = contractEventIndexer.getEventHandler('PREDICTION_MARKET_TEMPLATE', 'unknown_topic');
      expect(handler).toBeUndefined();
    });
  });

  describe('handleInvestmentMade', () => {
    it('should handle investment made event', async () => {
      const eventValue = {
        investor: 'GABC1234567890',
        marketId: 'market-1',
        amount: 500.0,
        tokenType: 'yes',
        timestamp: Date.now()
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      // Should not throw error
      await expect(
        contractEventIndexer.handleInvestmentMade(eventValue, metadata)
      ).resolves.not.toThrow();
    });
  });

  describe('handleInvestmentWithdrawn', () => {
    it('should handle investment withdrawn event', async () => {
      const eventValue = {
        investor: 'GABC1234567890',
        marketId: 'market-1',
        amount: 200.0,
        tokenType: 'yes',
        timestamp: Date.now()
      };

      const metadata = {
        ledger: 12346,
        txHash: 'b2c3d4e5f6a1',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      // Should not throw error
      await expect(
        contractEventIndexer.handleInvestmentWithdrawn(eventValue, metadata)
      ).resolves.not.toThrow();
    });
  });

  describe('handleLiquidityWithdrawn', () => {
    it('should handle liquidity withdrawn event', async () => {
      const eventValue = {
        withdrawer: 'GABC1234567890',
        poolAddress: 'POOL1234567890',
        amountA: 100.0,
        amountB: 200.0,
        timestamp: Date.now()
      };

      const metadata = {
        ledger: 12347,
        txHash: 'c3d4e5f6a1b2',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      // Should not throw error
      await expect(
        contractEventIndexer.handleLiquidityWithdrawn(eventValue, metadata)
      ).resolves.not.toThrow();
    });
  });

  describe('handleMarketCreated', () => {
    it('should create market record from event', async () => {
      const eventValue = {
        marketId: 'market-1',
        creator: 'GABC1234567890',
        question: 'Will BTC reach $100k?',
        category: 'crypto',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        contractAddress: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        poolAddress: 'POOL1234567890',
        yesToken: 'YES123',
        noToken: 'NO456'
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handleMarketCreated(eventValue, metadata);

      const market = await Market.findOne({ marketId: 'market-1' });
      expect(market).toBeDefined();
      expect(market.question).toBe('Will BTC reach $100k?');
      expect(market.category).toBe('crypto');
      expect(market.creatorWalletAddress).toBe('GABC1234567890');
      expect(market.blockchainTxHash).toBe('a1b2c3d4e5f6');
    });

    it('should not create duplicate market', async () => {
      const eventValue = {
        marketId: 'market-1',
        creator: 'GABC1234567890',
        question: 'Will BTC reach $100k?',
        category: 'crypto',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        contractAddress: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        poolAddress: 'POOL1234567890',
        yesToken: 'YES123',
        noToken: 'NO456'
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handleMarketCreated(eventValue, metadata);
      await contractEventIndexer.handleMarketCreated(eventValue, metadata);

      const markets = await Market.find({ marketId: 'market-1' });
      expect(markets).toHaveLength(1);
    });
  });

  describe('handleTradeExecuted', () => {
    it('should create trade record from event', async () => {
      const eventValue = {
        marketId: 'market-1',
        user: 'GABC1234567890',
        tokenType: 'yes',
        amount: '100500000000', // 100.5 in contract precision
        price: '50000000000', // 0.5 in contract precision
        cost: '50250000000', // 50.25 in contract precision
        tradeType: 'buy'
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handleTradeExecuted(eventValue, metadata);

      const trade = await Trade.findOne({ stellarTransactionHash: 'a1b2c3d4e5f6' });
      expect(trade).toBeDefined();
      expect(trade.marketId).toBe('market-1');
      expect(trade.userWalletAddress).toBe('GABC1234567890');
      expect(trade.tradeType).toBe('buy');
      expect(trade.tokenType).toBe('yes');
      expect(trade.amount).toBeCloseTo(100.5, 2);
      expect(trade.price).toBeCloseTo(0.5, 2);
      expect(trade.totalCost).toBeCloseTo(50.25, 2);
      expect(trade.status).toBe('confirmed');
    });
  });

  describe('handlePositionUpdated', () => {
    it('should update position record from event', async () => {
      const eventValue = {
        marketId: 'market-1',
        user: 'GABC1234567890',
        yesTokens: '100500000000',
        noTokens: '50000000000',
        totalInvested: '75250000000'
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handlePositionUpdated(eventValue, metadata);

      const position = await Position.findOne({
        marketId: 'market-1',
        userWalletAddress: 'GABC1234567890'
      });
      expect(position).toBeDefined();
      expect(position.yesTokens).toBeCloseTo(100.5, 2);
      expect(position.noTokens).toBeCloseTo(50.0, 2);
      expect(position.totalInvested).toBeCloseTo(75.25, 2);
    });
  });

  describe('handleMarketResolved', () => {
    it('should update market status to resolved', async () => {
      await Market.create({
        marketId: 'market-1',
        question: 'Test question',
        category: 'crypto',
        creatorWalletAddress: 'GABC1234567890',
        expiresAt: new Date(Date.now() + 86400000),
        status: 'active',
        createdAt: new Date()
      });

      const eventValue = {
        marketId: 'market-1',
        outcome: 'yes',
        resolvedAt: Math.floor(Date.now() / 1000)
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handleMarketResolved(eventValue, metadata);

      const market = await Market.findOne({ marketId: 'market-1' });
      expect(market.status).toBe('resolved');
      expect(market.resolvedOutcome).toBe('yes');
      expect(market.resolutionTxHash).toBe('a1b2c3d4e5f6');
    });
  });

  describe('handleWinningsClaimed', () => {
    it('should update position with claimed winnings', async () => {
      await Position.create({
        marketId: 'market-1',
        userWalletAddress: 'GABC1234567890',
        yesTokens: 100.0,
        noTokens: 0,
        totalInvested: 50.0,
        lastUpdated: new Date()
      });

      const eventValue = {
        marketId: 'market-1',
        user: 'GABC1234567890',
        amount: '150000000000' // 150 in contract precision
      };

      const metadata = {
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6',
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY'
      };

      await contractEventIndexer.handleWinningsClaimed(eventValue, metadata);

      const position = await Position.findOne({
        marketId: 'market-1',
        userWalletAddress: 'GABC1234567890'
      });
      expect(position.winningsClaimed).toBeCloseTo(150.0, 2);
      expect(position.claimTxHash).toBe('a1b2c3d4e5f6');
      expect(position.claimedAt).toBeDefined();
    });
  });

  describe('processEvent', () => {
    it('should process event and store in IndexedEvent', async () => {
      const event = {
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        topic: 'trade_executed',
        value: {
          user: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes'
        },
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6'
      };

      await contractEventIndexer.processEvent(event);

      const indexedEvent = await IndexedEvent.findOne({ txHash: 'a1b2c3d4e5f6' });
      expect(indexedEvent).toBeDefined();
      expect(indexedEvent.contractId).toBe('CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY');
      expect(indexedEvent.topic).toBe('trade_executed');
      expect(indexedEvent.eventType).toBe('trade');
      expect(indexedEvent.userAddress).toBe('GABC1234567890');
      expect(indexedEvent.marketId).toBe('market-1');
    });

    it('should prevent duplicate events with same txHash, topic, and contractId', async () => {
      const event = {
        contractId: 'CB7HZPDQXQ7ZQOJ7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EYV4NQJXK7EY',
        topic: 'trade_executed',
        value: {
          user: 'GABC1234567890',
          marketId: 'market-1',
          amount: 100.5,
          tokenType: 'yes'
        },
        ledger: 12345,
        txHash: 'a1b2c3d4e5f6'
      };

      await contractEventIndexer.processEvent(event);
      await contractEventIndexer.processEvent(event);

      const events = await IndexedEvent.find({ txHash: 'a1b2c3d4e5f6' });
      expect(events).toHaveLength(1);
    });
  });

  describe('start and stop', () => {
    it('should start the indexer', () => {
      contractEventIndexer.isRunning = false;
      contractEventIndexer.start();
      expect(contractEventIndexer.isRunning).toBe(true);
      contractEventIndexer.stop();
    });

    it('should stop the indexer', () => {
      contractEventIndexer.isRunning = true;
      contractEventIndexer.stop();
      expect(contractEventIndexer.isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      contractEventIndexer.isRunning = true;
      contractEventIndexer.start();
      expect(contractEventIndexer.isRunning).toBe(true);
      contractEventIndexer.stop();
    });
  });
});
