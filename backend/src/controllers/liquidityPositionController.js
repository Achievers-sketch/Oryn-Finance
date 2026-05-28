const { LiquidityPosition, Market } = require('../models');
const logger = require('../config/logger');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

class LiquidityPositionController {
  static async getUserPositions(req, res) {
    try {
      const { status = 'active' } = req.query;
      const positions = await LiquidityPosition.findUserPositions(req.user.walletAddress, status);

      const positionsWithMarket = await Promise.all(
        positions.map(async (pos) => {
          const market = await Market.findOne({ marketId: pos.marketId }).lean();
          return {
            ...pos.toObject(),
            marketQuestion: market?.question || 'Unknown Market',
            marketCategory: market?.category || 'other',
            marketStatus: market?.status || 'unknown'
          };
        })
      );

      res.json({
        success: true,
        data: positionsWithMarket
      });
    } catch (error) {
      logger.error('getUserPositions failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch LP positions' });
    }
  }

  static async getMarketPosition(req, res) {
    try {
      const { marketId } = req.params;
      const position = await LiquidityPosition.findOne({
        marketId,
        userWalletAddress: req.user.walletAddress,
        status: 'active'
      }).lean();

      if (!position) {
        return res.json({ success: true, data: null });
      }

      const market = await Market.findOne({ marketId }).lean();

      res.json({
        success: true,
        data: {
          ...position,
          marketQuestion: market?.question,
          marketCategory: market?.category
        }
      });
    } catch (error) {
      logger.error('getMarketPosition failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch LP position' });
    }
  }

  static async getPortfolioMetrics(req, res) {
    try {
      const metrics = await LiquidityPosition.getUserPortfolioMetrics(req.user.walletAddress);
      const summary = metrics[0] || {
        totalPositions: 0,
        totalDeposited: 0,
        totalFeesEarned: 0,
        totalIL: 0
      };

      res.json({
        success: true,
        data: {
          totalPositions: summary.totalPositions,
          totalDeposited: summary.totalDeposited,
          totalFeesEarned: summary.totalFeesEarned,
          totalImpermanentLoss: summary.totalIL,
          netReturn: summary.totalFeesEarned - summary.totalIL
        }
      });
    } catch (error) {
      logger.error('getPortfolioMetrics failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch LP metrics' });
    }
  }

  static async createPosition(req, res) {
    try {
      const { marketId, depositedYesAmount, depositedNoAmount, lpTokens, shareOfPool } = req.body;

      if (!marketId || !depositedYesAmount || !depositedNoAmount) {
        throw new ValidationError('marketId, depositedYesAmount, and depositedNoAmount are required');
      }

      const existing = await LiquidityPosition.findOne({
        marketId,
        userWalletAddress: req.user.walletAddress,
        status: 'active'
      });

      if (existing) {
        existing.depositedYesAmount += depositedYesAmount;
        existing.depositedNoAmount += depositedNoAmount;
        existing.lpTokens += lpTokens || 0;
        existing.shareOfPool = shareOfPool || existing.shareOfPool;
        existing.lastUpdated = new Date();
        await existing.save();

        return res.json({
          success: true,
          data: existing,
          message: 'Liquidity position updated'
        });
      }

      const position = new LiquidityPosition({
        marketId,
        userWalletAddress: req.user.walletAddress,
        depositedYesAmount,
        depositedNoAmount,
        lpTokens: lpTokens || 0,
        shareOfPool: shareOfPool || 0
      });

      await position.save();

      logger.info('LP position created', {
        marketId,
        user: req.user.walletAddress,
        depositedYesAmount,
        depositedNoAmount
      });

      res.status(201).json({
        success: true,
        data: position,
        message: 'LP position created successfully'
      });
    } catch (error) {
      logger.error('createPosition failed:', error);
      throw error;
    }
  }

  static async recordFeeEarned(req, res) {
    try {
      const { positionId } = req.params;
      const { amount, source = 'swap' } = req.body;

      if (!amount || amount <= 0) {
        throw new ValidationError('Fee amount must be positive');
      }

      const position = await LiquidityPosition.findOne({ positionId, userWalletAddress: req.user.walletAddress });

      if (!position) {
        throw new NotFoundError('LP position not found');
      }

      position.addFeeEarned(amount, source);
      await position.save();

      res.json({
        success: true,
        data: position,
        message: 'Fee recorded successfully'
      });
    } catch (error) {
      logger.error('recordFeeEarned failed:', error);
      throw error;
    }
  }

  static async calculateImpermanentLoss(req, res) {
    try {
      const { positionId } = req.params;

      const position = await LiquidityPosition.findOne({ positionId, userWalletAddress: req.user.walletAddress });

      if (!position) {
        throw new NotFoundError('LP position not found');
      }

      const market = await Market.findOne({ marketId: position.marketId }).lean();

      if (!market) {
        throw new NotFoundError('Market not found');
      }

      const currentYesPrice = market.currentYesPrice || 0.5;
      const currentNoPrice = market.currentNoPrice || 0.5;

      const depositYesPrice = market.statistics?.priceHistory?.[0]?.yesPrice || 0.5;
      const depositNoPrice = market.statistics?.priceHistory?.[0]?.noPrice || 0.5;

      position.calculateImpermanentLoss(currentYesPrice, currentNoPrice, depositYesPrice, depositNoPrice);
      await position.save();

      res.json({
        success: true,
        data: {
          positionId: position.positionId,
          impermanentLoss: position.impermanentLoss,
          currentPrices: { yes: currentYesPrice, no: currentNoPrice },
          feesEarned: position.totalFeesEarned
        },
        message: 'Impermanent loss calculated'
      });
    } catch (error) {
      logger.error('calculateImpermanentLoss failed:', error);
      throw error;
    }
  }
}

module.exports = LiquidityPositionController;
