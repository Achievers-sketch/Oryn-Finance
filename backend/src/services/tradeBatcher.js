const logger = require('../config/logger');
const { Trade, Market } = require('../models');
const sorobanService = require('./sorobanService');
const stellarService = require('./stellarService');
const websocketHandler = require('./websocketHandler');

class TradeBatcher {
  constructor() {
    this.pendingTrades = new Map(); // marketId -> trades[]
    this.batchTimeouts = new Map(); // marketId -> timeout
    this.batchInterval = 5000; // 5 seconds
    this.maxBatchSize = 10;
    this.isProcessing = new Set(); // marketIds being processed
  }

  addTrade(trade) {
    const { marketId } = trade;
    
    if (!this.pendingTrades.has(marketId)) {
      this.pendingTrades.set(marketId, []);
    }
    
    const trades = this.pendingTrades.get(marketId);
    trades.push(trade);
    
    // Process immediately if batch is full
    if (trades.length >= this.maxBatchSize) {
      this.processBatch(marketId);
      return;
    }
    
    // Set timeout for batch processing
    if (!this.batchTimeouts.has(marketId)) {
      const timeout = setTimeout(() => {
        this.processBatch(marketId);
      }, this.batchInterval);
      
      this.batchTimeouts.set(marketId, timeout);
    }
  }

  async processBatch(marketId) {
    if (this.isProcessing.has(marketId)) {
      return; // Already processing this market
    }
    
    this.isProcessing.add(marketId);
    
    try {
      // Clear timeout
      const timeout = this.batchTimeouts.get(marketId);
      if (timeout) {
        clearTimeout(timeout);
        this.batchTimeouts.delete(marketId);
      }
      
      const trades = this.pendingTrades.get(marketId) || [];
      if (trades.length === 0) {
        return;
      }
      
      // Clear pending trades for this market
      this.pendingTrades.set(marketId, []);
      
      logger.info(`Processing batch of ${trades.length} trades for market ${marketId}`);
      
      // Group trades by type for optimization
      const groupedTrades = this.groupTradesByType(trades);
      
      // Execute batched trades
      const results = await this.executeBatchedTrades(marketId, groupedTrades);
      
      // Update trade statuses and notify users
      await this.updateTradeResults(trades, results);
      
      logger.info(`Completed batch processing for market ${marketId}`);
      
    } catch (error) {
      logger.error(`Batch processing failed for market ${marketId}:`, error);
      
      // Mark all trades as failed
      const trades = this.pendingTrades.get(marketId) || [];
      await this.markTradesAsFailed(trades, error.message);
      
    } finally {
      this.isProcessing.delete(marketId);
    }
  }

  groupTradesByType(trades) {
    const groups = {
      buyYes: [],
      buyNo: [],
      sellYes: [],
      sellNo: []
    };
    
    trades.forEach(trade => {
      const key = `${trade.tradeType}${trade.tokenType.charAt(0).toUpperCase() + trade.tokenType.slice(1)}`;
      if (groups[key]) {
        groups[key].push(trade);
      }
    });
    
    return groups;
  }

  async executeBatchedTrades(marketId, groupedTrades) {
    const market = await Market.findOne({ marketId });
    if (!market) {
      throw new Error('Market not found');
    }
    
    const results = [];
    
    // Process each group sequentially to maintain price consistency
    for (const [tradeType, trades] of Object.entries(groupedTrades)) {
      if (trades.length === 0) continue;
      
      try {
        const batchResult = await this.executeBatchForType(market, tradeType, trades);
        results.push(...batchResult);
      } catch (error) {
        logger.error(`Failed to execute batch for ${tradeType}:`, error);
        // Mark these trades as failed
        trades.forEach(trade => {
          results.push({
            tradeId: trade.tradeId,
            success: false,
            error: error.message
          });
        });
      }
    }
    
    return results;
  }

  async executeBatchForType(market, tradeType, trades) {
    const totalAmount = trades.reduce((sum, trade) => sum + trade.amount, 0);
    const avgPrice = trades.reduce((sum, trade) => sum + trade.price, 0) / trades.length;
    
    logger.info(`Executing ${tradeType} batch: ${trades.length} trades, total amount: ${totalAmount}`);
    
    try {
      let stellarResult;
      
      if (market.metadata?.contractAddress) {
        // Use Soroban contract for batched execution
        stellarResult = await sorobanService.executeBatchedTrades(
          stellarService.adminKeypair,
          market.metadata.contractAddress,
          trades.map(trade => ({
            tokenType: trade.tokenType,
            tradeType: trade.tradeType,
            amount: trade.amount,
            maxSlippage: trade.maxSlippage || 0.05
          }))
        );
      } else {
        // Fallback to individual execution for non-contract markets
        stellarResult = await this.executeTradesIndividually(market, trades);
      }
      
      // Calculate gas savings
      const individualGasCost = trades.length * 0.00001; // Estimated individual cost
      const batchGasCost = 0.00001; // Single batch cost
      const gasSavings = individualGasCost - batchGasCost;
      
      logger.info(`Batch execution completed. Gas savings: ${gasSavings} XLM`);
      
      // Update market prices based on batch execution
      await this.updateMarketPricesFromBatch(market, tradeType, totalAmount, avgPrice);
      
      return trades.map((trade, index) => ({
        tradeId: trade.tradeId,
        success: true,
        transactionHash: stellarResult.hash || stellarResult.transactionHash,
        executedPrice: avgPrice,
        gasSavings: gasSavings / trades.length,
        batchIndex: index
      }));
      
    } catch (error) {
      logger.error(`Batch execution failed for ${tradeType}:`, error);
      throw error;
    }
  }

  async executeTradesIndividually(market, trades) {
    const results = [];
    
    for (const trade of trades) {
      try {
        const asset = trade.tokenType === 'yes'
          ? new stellarService.Asset(market.yesTokenAssetCode, market.yesTokenIssuer)
          : new stellarService.Asset(market.noTokenAssetCode, market.noTokenIssuer);

        const result = await stellarService.placeOrder(
          stellarService.adminKeypair,
          trade.tradeType === 'buy' ? stellarService.Asset.native() : asset,
          trade.tradeType === 'buy' ? asset : stellarService.Asset.native(),
          trade.amount,
          trade.price
        );
        
        results.push(result);
      } catch (error) {
        logger.error(`Individual trade execution failed:`, error);
        throw error;
      }
    }
    
    return { hash: results[0]?.hash, results };
  }

  async updateMarketPricesFromBatch(market, tradeType, totalAmount, avgPrice) {
    const [type, token] = tradeType.match(/^(buy|sell)(.+)$/).slice(1);
    const tokenType = token.toLowerCase();
    
    // Calculate price impact based on batch size
    const priceImpact = Math.min(0.1, totalAmount / (market.totalVolume || 1000) * 0.3);
    
    let newYesPrice = market.currentYesPrice;
    let newNoPrice = market.currentNoPrice;
    
    if (tokenType === 'yes') {
      if (type === 'buy') {
        newYesPrice = Math.min(0.99, market.currentYesPrice + priceImpact);
      } else {
        newYesPrice = Math.max(0.01, market.currentYesPrice - priceImpact);
      }
    } else {
      if (type === 'buy') {
        newNoPrice = Math.min(0.99, market.currentNoPrice + priceImpact);
      } else {
        newNoPrice = Math.max(0.01, market.currentNoPrice - priceImpact);
      }
    }
    
    // Ensure prices sum to 1
    newNoPrice = 1.0 - newYesPrice;
    
    market.updatePrices(newYesPrice, newNoPrice);
    market.addTrade(totalAmount * avgPrice);
    
    await market.save();
    
    // Broadcast price update
    websocketHandler.broadcastMarketUpdate(market.marketId, {
      type: 'batch_trade_executed',
      newYesPrice,
      newNoPrice,
      batchSize: totalAmount,
      tradeType
    });
  }

  async updateTradeResults(trades, results) {
    const resultMap = new Map(results.map(r => [r.tradeId, r]));
    
    for (const trade of trades) {
      const result = resultMap.get(trade.tradeId);
      
      if (result && result.success) {
        await Trade.updateOne(
          { tradeId: trade.tradeId },
          {
            status: 'confirmed',
            stellarTransactionHash: result.transactionHash,
            'metadata.batchExecuted': true,
            'metadata.gasSavings': result.gasSavings,
            'metadata.batchIndex': result.batchIndex
          }
        );
        
        // Notify user of successful execution
        websocketHandler.sendUserNotification(trade.userWalletAddress, {
          type: 'trade_executed',
          tradeId: trade.tradeId,
          message: 'Trade executed successfully in batch',
          gasSavings: result.gasSavings
        });
        
      } else {
        await this.markTradeAsFailed(trade, result?.error || 'Unknown error');
      }
    }
  }

  async markTradesAsFailed(trades, errorMessage) {
    for (const trade of trades) {
      await this.markTradeAsFailed(trade, errorMessage);
    }
  }

  async markTradeAsFailed(trade, errorMessage) {
    await Trade.updateOne(
      { tradeId: trade.tradeId },
      {
        status: 'failed',
        'metadata.failureReason': errorMessage,
        'metadata.batchExecuted': false
      }
    );
    
    // Notify user of failed execution
    websocketHandler.sendUserNotification(trade.userWalletAddress, {
      type: 'trade_failed',
      tradeId: trade.tradeId,
      message: `Trade execution failed: ${errorMessage}`
    });
  }

  // Get batch statistics
  getBatchStats() {
    const totalPending = Array.from(this.pendingTrades.values())
      .reduce((sum, trades) => sum + trades.length, 0);
    
    return {
      pendingBatches: this.pendingTrades.size,
      totalPendingTrades: totalPending,
      activeProcessing: this.isProcessing.size,
      scheduledTimeouts: this.batchTimeouts.size
    };
  }

  // Force process all pending batches (for shutdown)
  async processAllPending() {
    const marketIds = Array.from(this.pendingTrades.keys());
    
    await Promise.all(
      marketIds.map(marketId => this.processBatch(marketId))
    );
  }
}

module.exports = new TradeBatcher();