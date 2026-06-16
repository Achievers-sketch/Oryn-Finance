jest.mock('../../src/config/logger', () => ({
  websocket: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const websocketHandler = require('../../src/services/websocketHandler');

describe('WebSocketHandler', () => {
  let io;
  let socket;
  let roomEmitter;
  let directEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    websocketHandler.io = null;
    websocketHandler.connectedUsers = new Map();
    websocketHandler.pendingUpdates = new Map();
    websocketHandler.marketRooms = new Map();
    websocketHandler.lastUpdateTime = new Map();

    roomEmitter = { emit: jest.fn() };
    directEmitter = { emit: jest.fn() };

    io = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn((room) => room === 'socket123' ? directEmitter : roomEmitter),
      sockets: {
        adapter: {
          rooms: new Map([['market_btc', new Set(['socket123'])]])
        }
      }
    };

    socket = {
      id: 'socket123',
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() }))
    };
  });

  it('registers connection handlers during initialization', () => {
    websocketHandler.initialize(io);

    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(websocketHandler.io).toBe(io);
  });

  it('authenticates a socket and tracks the connected user', () => {
    websocketHandler.handleAuthentication(socket, { walletAddress: 'GUSER' });

    expect(websocketHandler.connectedUsers.get('socket123')).toEqual(expect.objectContaining({
      walletAddress: 'guser'
    }));
    expect(socket.emit).toHaveBeenCalledWith('authenticated', expect.objectContaining({ success: true }));
  });

  it('subscribes and unsubscribes sockets from market rooms', () => {
    websocketHandler.handleMarketSubscription(socket, { marketId: 'btc' });
    expect(socket.join).toHaveBeenCalledWith('market_btc');
    expect(websocketHandler.marketRooms.get('btc').has('socket123')).toBe(true);

    websocketHandler.handleMarketUnsubscription(socket, { marketId: 'btc' });
    expect(socket.leave).toHaveBeenCalledWith('market_btc');
    expect(websocketHandler.marketRooms.has('btc')).toBe(false);
  });

  it('broadcasts market updates to the market room', () => {
    websocketHandler.io = io;

    websocketHandler.broadcastMarketUpdate('btc', { type: 'price', price: 0.61 });

    expect(io.to).toHaveBeenCalledWith('market_btc');
    expect(roomEmitter.emit).toHaveBeenCalledWith('market_update', expect.objectContaining({
      marketId: 'btc',
      d: expect.objectContaining({ type: 'price', price: 0.61 })
    }));
  });

  it('queues market updates when throttled', () => {
    websocketHandler.io = io;
    websocketHandler.lastUpdateTime.set('btc', Date.now());

    websocketHandler.broadcastMarketUpdate('btc', { type: 'price', price: 0.62 });

    expect(websocketHandler.pendingUpdates.get('btc')).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'price', price: 0.62 })])
    );
  });

  it('broadcasts trades and direct user notifications', () => {
    websocketHandler.io = io;
    websocketHandler.connectedUsers.set('socket123', { walletAddress: 'guser' });

    websocketHandler.broadcastTrade('btc', { tradeId: 'trade-1', amount: 10 });
    websocketHandler.sendUserNotification('GUSER', { type: 'settlement' });

    expect(roomEmitter.emit).toHaveBeenCalledWith('new_trade', expect.objectContaining({ tradeId: 'trade-1' }));
    expect(directEmitter.emit).toHaveBeenCalledWith('notification', expect.objectContaining({ type: 'settlement' }));
  });

  it('reports socket statistics and subscribers', () => {
    websocketHandler.io = io;
    websocketHandler.connectedUsers.set('socket123', { walletAddress: 'guser' });

    expect(websocketHandler.getConnectedUsersCount()).toBe(1);
    expect(websocketHandler.getMarketSubscribers('btc')).toEqual(['socket123']);
    const stats = websocketHandler.getWebSocketStats();
    expect(stats.connectedUsers).toBe(1);
    expect(stats.totalRooms).toBe(1);
    expect(stats.authenticatedUsers).toBe(1);
    expect(stats.compression).toBeDefined();
  });

  it('cleans up user membership on disconnect', () => {
    websocketHandler.connectedUsers.set('socket123', { walletAddress: 'guser' });
    websocketHandler.marketRooms.set('btc', new Set(['socket123']));

    websocketHandler.handleDisconnection(socket);

    expect(websocketHandler.connectedUsers.has('socket123')).toBe(false);
    expect(websocketHandler.marketRooms.has('btc')).toBe(false);
  });

  describe('compression', () => {
    beforeEach(() => {
      websocketHandler.lastEmittedData = new Map();
      websocketHandler.compressionStats = {
        totalBytesBefore: 0,
        totalBytesAfter: 0,
        compressedMessages: 0,
        deltaSavings: 0,
        batchesSaved: 0
      };
    });

    it('strips null, undefined, and empty values from payloads', () => {
      const result = websocketHandler.compressPayload({
        type: 'price',
        price: 0.61,
        volume: null,
        note: undefined,
        comment: ''
      }, null);

      expect(result.data).toEqual({ type: 'price', price: 0.61 });
      expect(result.data.volume).toBeUndefined();
      expect(result.data.note).toBeUndefined();
      expect(result.data.comment).toBeUndefined();
    });

    it('computes delta against last emitted data', () => {
      websocketHandler.lastEmittedData.set('btc', { type: 'price', price: 0.61, volume: 1000 });

      const result = websocketHandler.compressPayload(
        { type: 'price', price: 0.62, volume: 1000 },
        'btc'
      );

      expect(result.delta).toBe(true);
      expect(result.data).toEqual({ price: 0.62 });
      expect(result.data.volume).toBeUndefined();
    });

    it('returns null data when no fields changed', () => {
      websocketHandler.lastEmittedData.set('btc', { type: 'price', price: 0.61 });

      const result = websocketHandler.compressPayload(
        { type: 'price', price: 0.61 },
        'btc'
      );

      expect(result.delta).toBe(true);
      expect(result.data).toBeNull();
    });

    it('skips emission when delta has no changes', () => {
      websocketHandler.io = io;
      websocketHandler.lastEmittedData.set('btc', { type: 'price', price: 0.61 });

      websocketHandler.broadcastMarketUpdate('btc', { type: 'price', price: 0.61 });

      expect(roomEmitter.emit).not.toHaveBeenCalled();
    });

    it('flushes batch with deduplication of identical payloads', (done) => {
      websocketHandler.io = io;
      websocketHandler.lastUpdateTime.set('btc', Date.now());

      // Different types to avoid type-based throttle dedup
      websocketHandler.broadcastMarketUpdate('btc', { type: 'price', price: 0.61 });
      websocketHandler.broadcastMarketUpdate('btc', { type: 'volume', volume: 5000 });
      // Manually add a duplicate to simulate duplicate in batch
      websocketHandler.pendingUpdates.get('btc').push(
        websocketHandler.pendingUpdates.get('btc')[1]
      );

      setTimeout(() => {
        const calls = roomEmitter.emit.mock.calls.filter(
          call => call[0] === 'market_update' && call[1]?.t === 'bu'
        );
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const batchPayload = calls[0][1];
        // Deduplication should have removed the duplicate
        expect(batchPayload.d.length).toBe(2);
        done();
      }, 150);
    });

    it('tracks compression statistics', () => {
      websocketHandler.io = io;

      websocketHandler.broadcastMarketUpdate('btc', { type: 'price', price: 0.61, volume: 5000 });

      expect(websocketHandler.compressionStats.compressedMessages).toBeGreaterThanOrEqual(1);
      expect(websocketHandler.compressionStats.totalBytesBefore).toBeGreaterThan(0);

      const stats = websocketHandler.getWebSocketStats();
      expect(stats.compression).toBeDefined();
      expect(stats.compression.compressionRatio).toBeDefined();
      expect(typeof stats.compression.bytesSaved).toBe('number');
    });
  });
});
