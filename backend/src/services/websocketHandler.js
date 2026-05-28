const logger = require('../config/logger');
const redisAdapter = require('./redisAdapter');

const UPDATE_THROTTLE_MS = 100;
const MAX_PAYLOAD_SIZE = 1024;
const BATCH_SIZE = 50;

// Room that clients join to receive cross-market dashboard updates
const GLOBAL_SUBSCRIBERS_ROOM = 'global_subscribers';

class WebSocketHandler {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.pendingUpdates = new Map();
    this.marketRooms = new Map();
    this.lastUpdateTime = new Map();
    this.lastSequence = 0;
    // Per-market batch timeouts to avoid a single timeout racing across markets
    this.batchTimeouts = new Map();
    this.priceCache = new Map();
    this.heartbeatInterval = null;
    // Delta compression: track last emitted data per market
    this.lastEmittedData = new Map();
    // Performance benchmarking
    this.compressionStats = {
      totalBytesBefore: 0,
      totalBytesAfter: 0,
      compressedMessages: 0,
      deltaSavings: 0,
      batchesSaved: 0
    };
  }

  initialize(io) {
    this.io = io;

    // Initialize Redis adapter for scaling
    this.initializeRedisScaling();

    io.on('connection', (socket) => {
      logger.websocket('Client connected', { socketId: socket.id });

      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data);
      });

      socket.on('subscribe_market', (data) => {
        this.handleMarketSubscription(socket, data);
      });

      socket.on('unsubscribe_market', (data) => {
        this.handleMarketUnsubscription(socket, data);
      });

      // Let clients opt in to cross-market dashboard updates
      socket.on('subscribe_global', () => {
        socket.join(GLOBAL_SUBSCRIBERS_ROOM);
        socket.emit('subscribed_global', { message: 'Subscribed to global market updates' });
      });

      socket.on('unsubscribe_global', () => {
        socket.leave(GLOBAL_SUBSCRIBERS_ROOM);
      });

      socket.on('ping', () => {
        socket.emit('pong', { ts: Date.now() });
      });

      socket.on('sync_prices', async (data) => {
        try {
          const { marketIds } = data;
          const syncData = {};
          for (const marketId of marketIds) {
            const cachedPrice = this.priceCache.get(marketId);
            if (cachedPrice) {
              syncData[marketId] = cachedPrice;
            }
          }
          socket.emit('prices_synced', {
            ts: Date.now(),
            serverTime: Date.now(),
            prices: syncData
          });
        } catch (error) {
          logger.error('Error syncing prices:', error);
          socket.emit('sync_error', { message: 'Failed to sync prices' });
        }
      });

      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      socket.on('typing', (data) => {
        socket.to(`market_${data.marketId}`).emit('user_typing', {
          user: socket.userData?.walletAddress,
          isTyping: data.isTyping
        });
      });
    });

    this.startHeartbeat();

    logger.websocket('WebSocket server initialized');
  }

  async initializeRedisScaling() {
    try {
      await redisAdapter.initialize();
      
      // Subscribe to cross-instance events
      await redisAdapter.subscribe('market_updates', (data) => {
        this.handleCrossInstanceMarketUpdate(data);
      });
      
      await redisAdapter.subscribe('user_notifications', (data) => {
        this.handleCrossInstanceUserNotification(data);
      });
      
      await redisAdapter.subscribe('announcements', (data) => {
        this.handleCrossInstanceAnnouncement(data);
      });

      logger.websocket('Redis scaling initialized');
    } catch (error) {
      logger.warn('Redis scaling disabled:', error.message);
    }
  }

  handleCrossInstanceMarketUpdate(data) {
    if (!this.io) return;
    
    const roomName = `market_${data.marketId}`;
    this.io.to(roomName).emit('market_update', data.payload);
    
    if (data.globalUpdate) {
      this.io.to(GLOBAL_SUBSCRIBERS_ROOM).emit('global_market_update', data.globalPayload);
    }
  }

  handleCrossInstanceUserNotification(data) {
    if (!this.io) return;
    
    const userSockets = Array.from(this.connectedUsers.entries())
      .filter(([_, userData]) => userData.walletAddress === data.walletAddress)
      .map(([socketId]) => socketId);

    userSockets.forEach(socketId => {
      this.io.to(socketId).emit('notification', data.notification);
    });
  }

  handleCrossInstanceAnnouncement(data) {
    if (!this.io) return;
    this.io.emit('announcement', data.announcement);
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.io) return;
      // Send heartbeat only to each socket individually so each client
      // receives its own connection health ping rather than a broadcast
      // that carries aggregate server state to every client.
      this.io.sockets.sockets.forEach((socket) => {
        socket.emit('heartbeat', { ts: Date.now() });
      });
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  updatePriceCache(marketId, priceData) {
    this.priceCache.set(marketId, {
      ...priceData,
      ts: Date.now(),
      serverTime: Date.now()
    });

    if (this.priceCache.size > 100) {
      const oldestKey = this.priceCache.keys().next().value;
      this.priceCache.delete(oldestKey);
    }
  }

  handleAuthentication(socket, data) {
    try {
      const { walletAddress } = data;

      socket.userData = {
        walletAddress: walletAddress?.toLowerCase(),
        authenticatedAt: new Date()
      };

      this.connectedUsers.set(socket.id, socket.userData);

      socket.emit('authenticated', {
        success: true,
        walletAddress: socket.userData.walletAddress,
        ts: Date.now()
      });

      logger.websocket('Client authenticated', {
        socketId: socket.id,
        walletAddress: socket.userData.walletAddress
      });
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      socket.emit('authentication_error', {
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  handleMarketSubscription(socket, data) {
    const { marketId } = data;

    if (!marketId) {
      socket.emit('subscription_error', { message: 'Market ID required' });
      return;
    }

    const roomName = `market_${marketId}`;
    socket.join(roomName);

    if (!this.marketRooms.has(marketId)) {
      this.marketRooms.set(marketId, new Set());
    }
    this.marketRooms.get(marketId).add(socket.id);

    socket.emit('subscribed', {
      marketId,
      message: `Subscribed to market ${marketId}`
    });

    logger.websocket('Client subscribed to market', {
      socketId: socket.id,
      marketId,
      user: socket.userData?.walletAddress
    });
  }

  handleMarketUnsubscription(socket, data) {
    const { marketId } = data;

    if (!marketId) {
      socket.emit('subscription_error', { message: 'Market ID required' });
      return;
    }

    const roomName = `market_${marketId}`;
    socket.leave(roomName);

    if (this.marketRooms.has(marketId)) {
      this.marketRooms.get(marketId).delete(socket.id);
      if (this.marketRooms.get(marketId).size === 0) {
        this.marketRooms.delete(marketId);
        this.pendingUpdates.delete(marketId);
        this.lastUpdateTime.delete(marketId);
        this._clearBatchTimeout(marketId);
      }
    }

    socket.emit('unsubscribed', {
      marketId,
      message: `Unsubscribed from market ${marketId}`
    });

    logger.websocket('Client unsubscribed from market', {
      socketId: socket.id,
      marketId,
      user: socket.userData?.walletAddress
    });
  }

  handleDisconnection(socket) {
    for (const [marketId, sockets] of this.marketRooms.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.marketRooms.delete(marketId);
        this.pendingUpdates.delete(marketId);
        this.lastUpdateTime.delete(marketId);
        this.lastEmittedData.delete(marketId);
        this._clearBatchTimeout(marketId);
      }
      }
    }

    const userData = this.connectedUsers.get(socket.id);
    this.connectedUsers.delete(socket.id);

    logger.websocket('Client disconnected', {
      socketId: socket.id,
      user: userData?.walletAddress
    });
  }

  _clearBatchTimeout(marketId) {
    const t = this.batchTimeouts.get(marketId);
    if (t) {
      clearTimeout(t);
      this.batchTimeouts.delete(marketId);
    }
  }

  broadcastMarketUpdate(marketId, updateData) {
    if (!this.io) return;

    const roomName = `market_${marketId}`;
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(marketId) || 0;

    const isCriticalUpdate = updateData.type === 'trade_executed' || updateData.type === 'market_resolved';

    if (!isCriticalUpdate && now - lastUpdate < UPDATE_THROTTLE_MS) {
      if (!this.pendingUpdates.has(marketId)) {
        this.pendingUpdates.set(marketId, []);
      }
      const pending = this.pendingUpdates.get(marketId);
      const compressed = this.compressPayload(updateData, null);

      const existingIndex = pending.findIndex(update => update.type === updateData.type);
      if (existingIndex >= 0) {
        pending[existingIndex] = compressed.data || updateData;
      } else if (pending.length < BATCH_SIZE) {
        pending.push(compressed.data || updateData);
      }

      // Use a per-market timeout so multiple markets don't overwrite each other
      if (!this.batchTimeouts.has(marketId)) {
        const t = setTimeout(() => {
          this.flushPendingUpdates(marketId);
        }, UPDATE_THROTTLE_MS);
        this.batchTimeouts.set(marketId, t);
      }
      return;
    }

    this.lastUpdateTime.set(marketId, now);

    const sequenceNumber = (this.lastSequence || 0) + 1;
    this.lastSequence = sequenceNumber;

    const compressed = this.compressPayload(updateData, marketId);

    // Skip emission if delta computed no changes
    if (compressed.delta && compressed.data === null) {
      this.compressionStats.batchesSaved++;
      return;
    }

    const payload = {
      marketId,
      ts: now,
      sq: sequenceNumber,
      d: compressed.data,
      st: now
    };

    const rawSize = JSON.stringify({ ...payload, d: compressed.full }).length;
    const compressedSize = JSON.stringify(payload).length;

    this.io.to(roomName).emit('market_update', payload);

    // Publish to Redis for cross-instance sync
    redisAdapter.publish('market_updates', {
      marketId,
      payload,
      globalUpdate: true,
      globalPayload: {
        marketId,
        type: updateData.type,
        ts: now,
        sq: sequenceNumber
      }
    });

    // Only send the lightweight summary to clients who explicitly opted in to global updates
    this.io.to(GLOBAL_SUBSCRIBERS_ROOM).emit('global_market_update', {
      marketId,
      type: updateData.type,
      ts: now,
      sq: sequenceNumber
    });

    this._recordCompressionStats(rawSize, compressedSize);

    logger.websocket('Market update broadcast', {
      marketId,
      roomName,
      updateType: updateData.type,
      sequence: sequenceNumber,
      subscribersCount: this.getMarketSubscribers(marketId).length,
      savedPct: rawSize > 0 ? Math.round((1 - compressedSize / rawSize) * 100) : 0
    });
  }

  flushPendingUpdates(marketId) {
    this._clearBatchTimeout(marketId);

    if (!this.pendingUpdates.has(marketId)) return;

    const pending = this.pendingUpdates.get(marketId);
    if (pending.length === 0) return;

    // Deduplicate: remove duplicate update objects within the batch
    const seen = new Set();
    const deduped = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      const key = JSON.stringify(pending[i]);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.unshift(pending[i]);
      }
    }

    const roomName = `market_${marketId}`;
    const now = Date.now();
    const sequenceNumber = (this.lastSequence || 0) + 1;
    this.lastSequence = sequenceNumber;

    const batchPayload = {
      marketId,
      ts: now,
      sq: sequenceNumber,
      t: 'bu',
      d: deduped,
      st: now
    };

    const rawSize = JSON.stringify({
      marketId,
      timestamp: new Date().toISOString(),
      sequence: sequenceNumber,
      type: 'batch_update',
      data: pending,
      serverTime: now
    }).length;
    const compressedSize = JSON.stringify(batchPayload).length;

    this.io.to(roomName).emit('market_update', batchPayload);

    this.pendingUpdates.set(marketId, []);
    this.lastUpdateTime.set(marketId, now);

    if (pending.length > deduped.length) {
      this.compressionStats.batchesSaved++;
    }
    this._recordCompressionStats(rawSize, compressedSize);

    logger.websocket('Batch update flushed', {
      marketId,
      updatesCount: pending.length,
      dedupedCount: deduped.length,
      sequence: sequenceNumber,
      savedPct: rawSize > 0 ? Math.round((1 - compressedSize / rawSize) * 100) : 0
    });
  }

  compressPayload(updateData, marketId) {
    const stripped = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      // Round floating-point numbers to reduce byte representation
      if (typeof value === 'number' && !Number.isInteger(value) && key !== 'timestamp' && key !== 'sequence') {
        stripped[key] = Math.round(value * 1e8) / 1e8;
      } else {
        stripped[key] = value;
      }
    }

    // Compute delta against last emitted data for this market
    if (marketId && this.lastEmittedData.has(marketId)) {
      const prev = this.lastEmittedData.get(marketId);
      const delta = {};
      let hasChanges = false;

      for (const [key, value] of Object.entries(stripped)) {
        const prevVal = prev[key];
        if (JSON.stringify(value) !== JSON.stringify(prevVal)) {
          delta[key] = value;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        this.lastEmittedData.set(marketId, { ...prev, ...delta });
        return { compressed: true, delta: true, data: delta, full: stripped };
      }
      // No changes from previous emission
      return { compressed: true, delta: true, data: null, full: stripped };
    }

    if (marketId) {
      this.lastEmittedData.set(marketId, { ...stripped });
    }
    return { compressed: true, delta: false, data: stripped, full: stripped };
  }

  _recordCompressionStats(before, after) {
    this.compressionStats.totalBytesBefore += before;
    this.compressionStats.totalBytesAfter += after;
    this.compressionStats.compressedMessages++;
    this.compressionStats.deltaSavings += Math.max(0, before - after);
  }

  broadcastTrade(marketId, tradeData) {
    if (!this.io) return;

    const roomName = `market_${marketId}`;
    const now = Date.now();

    const stripped = {};
    for (const [key, value] of Object.entries(tradeData)) {
      if (value === null || value === undefined || value === '') continue;
      stripped[key] = value;
    }

    this.io.to(roomName).emit('new_trade', {
      marketId,
      ts: now,
      ...stripped
    });

    logger.websocket('Trade broadcast', {
      marketId,
      tradeId: tradeData.tradeId,
      amount: tradeData.amount
    });
  }

  sendUserNotification(walletAddress, notification) {
    if (!this.io) return;

    const userSockets = Array.from(this.connectedUsers.entries())
      .filter(([_, userData]) => userData.walletAddress === walletAddress.toLowerCase())
      .map(([socketId]) => socketId);

    const stripped = {};
    for (const [key, value] of Object.entries(notification)) {
      if (value === null || value === undefined || value === '') continue;
      stripped[key] = value;
    }

    userSockets.forEach(socketId => {
      this.io.to(socketId).emit('notification', {
        ts: Date.now(),
        ...stripped
      });
    });

    // Publish to Redis for cross-instance sync
    redisAdapter.publish('user_notifications', {
      walletAddress: walletAddress.toLowerCase(),
      notification: {
        ts: Date.now(),
        ...stripped
      }
    });

    logger.websocket('User notification sent', {
      walletAddress,
      socketsCount: userSockets.length,
      type: notification.type
    });
  }

  broadcastAnnouncement(announcement) {
    if (!this.io) return;

    this.io.emit('announcement', {
      ts: Date.now(),
      ...announcement
    });

    // Publish to Redis for cross-instance sync
    redisAdapter.publish('announcements', {
      announcement: {
        ts: Date.now(),
        ...announcement
      }
    });

    logger.websocket('Platform announcement broadcast', {
      type: announcement.type,
      message: announcement.message
    });
  }

  broadcastLeaderboardUpdate(leaderboardData) {
    if (!this.io) return;

    this.io.emit('leaderboard_update', {
      ts: Date.now(),
      ...leaderboardData
    });

    logger.websocket('Leaderboard update broadcast');
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  getMarketSubscribers(marketId) {
    if (!this.io) return [];

    const roomName = `market_${marketId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);

    return room ? Array.from(room) : [];
  }

  getWebSocketStats() {
    const compressionRatio = this.compressionStats.totalBytesBefore > 0
      ? ((1 - this.compressionStats.totalBytesAfter / this.compressionStats.totalBytesBefore) * 100).toFixed(1)
      : 0;

    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.io?.sockets.adapter.rooms.size || 0,
      authenticatedUsers: Array.from(this.connectedUsers.values())
        .filter(userData => userData.walletAddress).length,
      compression: {
        totalBytesBefore: this.compressionStats.totalBytesBefore,
        totalBytesAfter: this.compressionStats.totalBytesAfter,
        bytesSaved: this.compressionStats.deltaSavings,
        messagesCompressed: this.compressionStats.compressedMessages,
        batchesDeduped: this.compressionStats.batchesSaved,
        compressionRatio: `${compressionRatio}%`
      }
    };
  }
}

module.exports = new WebSocketHandler();
