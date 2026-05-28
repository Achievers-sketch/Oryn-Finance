const { Market, Trade } = require('../models');
const logger = require('../config/logger');
const { NotFoundError } = require('../middleware/errorHandler');

class MarketDepthController {
  // Get market depth data for visualization
  static async getMarketDepth(req, res) {
    const { marketId } = req.params;
    const { tokenType = 'yes' } = req.query;

    try {
      const market = await Market.findOne({ marketId });
      if (!market) {
        throw new NotFoundError('Market not found');
      }

      // Generate mock order book data based on current market state
      const currentPrice = tokenType === 'yes' ? market.currentYesPrice : market.currentNoPrice;
      const spread = 0.01 + Math.random() * 0.02; // 1-3% spread
      
      const buyOrders = [];
      const sellOrders = [];
      
      let buyTotal = 0;
      let sellTotal = 0;
      
      // Generate buy orders (below current price)
      for (let i = 0; i < 20; i++) {
        const price = Math.max(0.01, currentPrice - (i + 1) * 0.01);
        const baseAmount = market.liquidity ? market.liquidity / 50 : 100;
        const amount = baseAmount * (0.5 + Math.random()) * (1 + i * 0.1);
        
        buyTotal += amount;
        buyOrders.push({
          price: parseFloat(price.toFixed(4)),
          amount: parseFloat(amount.toFixed(2)),
          total: parseFloat(buyTotal.toFixed(2)),
          side: 'buy'
        });
      }
      
      // Generate sell orders (above current price)
      for (let i = 0; i < 20; i++) {
        const price = Math.min(0.99, currentPrice + spread + i * 0.01);
        const baseAmount = market.liquidity ? market.liquidity / 50 : 100;
        const amount = baseAmount * (0.5 + Math.random()) * (1 + i * 0.1);
        
        sellTotal += amount;
        sellOrders.push({
          price: parseFloat(price.toFixed(4)),
          amount: parseFloat(amount.toFixed(2)),
          total: parseFloat(sellTotal.toFixed(2)),
          side: 'sell'
        });
      }

      const depthData = {
        marketId,
        tokenType,
        currentPrice: parseFloat(currentPrice.toFixed(4)),
        spread: parseFloat(spread.toFixed(4)),
        buyOrders: buyOrders.reverse(), // Highest buy prices first
        sellOrders,
        totalBuyLiquidity: parseFloat(buyTotal.toFixed(2)),
        totalSellLiquidity: parseFloat(sellTotal.toFixed(2)),
        lastUpdate: Date.now(),
        marketStats: {
          volume24h: market.totalVolume || 0,
          liquidity: market.liquidity || 0,
          priceChange24h: Math.random() * 0.1 - 0.05, // -5% to +5%
          trades24h: Math.floor(Math.random() * 100) + 10
        }
      };

      res.json({
        success: true,
        data: depthData
      });

    } catch (error) {
      logger.error('Error fetching market depth:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch market depth data'
      });
    }
  }

  // Get aggregated liquidity zones
  static async getLiquidityZones(req, res) {
    const { marketId } = req.params;
    const { tokenType = 'yes', zones = 10 } = req.query;

    try {
      const market = await Market.findOne({ marketId });
      if (!market) {
        throw new NotFoundError('Market not found');
      }

      const currentPrice = tokenType === 'yes' ? market.currentYesPrice : market.currentNoPrice;
      const priceRange = 0.2; // ±20% from current price
      const zoneSize = (priceRange * 2) / parseInt(zones);
      
      const liquidityZones = [];
      
      for (let i = 0; i < parseInt(zones); i++) {
        const minPrice = Math.max(0.01, currentPrice - priceRange + (i * zoneSize));
        const maxPrice = Math.min(0.99, minPrice + zoneSize);
        const midPrice = (minPrice + maxPrice) / 2;
        
        // Simulate liquidity distribution (more liquidity near current price)
        const distanceFromCurrent = Math.abs(midPrice - currentPrice);
        const liquidityMultiplier = Math.exp(-distanceFromCurrent * 10);
        const baseLiquidity = market.liquidity ? market.liquidity / 20 : 50;
        const liquidity = baseLiquidity * liquidityMultiplier * (0.5 + Math.random());
        
        liquidityZones.push({
          minPrice: parseFloat(minPrice.toFixed(4)),
          maxPrice: parseFloat(maxPrice.toFixed(4)),
          midPrice: parseFloat(midPrice.toFixed(4)),
          liquidity: parseFloat(liquidity.toFixed(2)),
          side: midPrice < currentPrice ? 'buy' : 'sell'
        });
      }

      res.json({
        success: true,
        data: {
          marketId,
          tokenType,
          currentPrice: parseFloat(currentPrice.toFixed(4)),
          zones: liquidityZones,
          totalLiquidity: liquidityZones.reduce((sum, zone) => sum + zone.liquidity, 0),
          lastUpdate: Date.now()
        }
      });

    } catch (error) {
      logger.error('Error fetching liquidity zones:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch liquidity zones'
      });
    }
  }

  // Get real-time order book updates
  static async getOrderBookUpdates(req, res) {
    const { marketId } = req.params;
    
    try {
      // Set up Server-Sent Events for real-time updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const sendUpdate = () => {
        const updateData = {
          timestamp: Date.now(),
          marketId,
          type: 'orderbook_update',
          data: {
            // Send incremental updates here
            lastTradePrice: 0.45 + Math.random() * 0.1,
            spread: 0.01 + Math.random() * 0.02,
            topBid: 0.44 + Math.random() * 0.05,
            topAsk: 0.46 + Math.random() * 0.05
          }
        };
        
        res.write(`data: ${JSON.stringify(updateData)}\n\n`);
      };

      // Send initial data
      sendUpdate();
      
      // Send updates every 2 seconds
      const interval = setInterval(sendUpdate, 2000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(interval);
        res.end();
      });

    } catch (error) {
      logger.error('Error setting up order book stream:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to setup order book stream'
      });
    }
  }
}

module.exports = MarketDepthController;