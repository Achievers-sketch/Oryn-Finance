const { TreasuryTransaction, Market } = require('../models');
const logger = require('../config/logger');
const { NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');

class TreasuryController {
  static async getTreasuryOverview(req, res) {
    try {
      const [balanceByAsset, totalInflows, totalOutflows, recentTransactions] = await Promise.all([
        TreasuryTransaction.getTreasuryBalance(),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: { $in: ['fee_inflow', 'investment_return'] } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: { $in: ['distribution_outflow', 'withdrawal', 'emergency_withdraw', 'investment'] } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        TreasuryTransaction.find({ status: 'completed' })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
      ]);

      const inflowStats = totalInflows[0] || { total: 0, count: 0 };
      const outflowStats = totalOutflows[0] || { total: 0, count: 0 };

      const balanceMap = {};
      for (const b of balanceByAsset) {
        balanceMap[b._id] = (b.totalInflow || 0) - (b.totalOutflow || 0);
      }

      res.json({
        success: true,
        data: {
          balance: balanceMap,
          totalInflows: inflowStats.total,
          inflowCount: inflowStats.count,
          totalOutflows: outflowStats.total,
          outflowCount: outflowStats.count,
          netBalance: inflowStats.total - outflowStats.total,
          recentTransactions
        }
      });
    } catch (error) {
      logger.error('getTreasuryOverview failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch treasury overview' });
    }
  }

  static async getFeeInflows(req, res) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [transactions, total] = await Promise.all([
        TreasuryTransaction.find({ type: 'fee_inflow', status: 'completed' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        TreasuryTransaction.countDocuments({ type: 'fee_inflow', status: 'completed' })
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('getFeeInflows failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch fee inflows' });
    }
  }

  static async getOutflows(req, res) {
    try {
      const { limit = 50, page = 1, type } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const filter = {
        type: type || { $in: ['distribution_outflow', 'withdrawal', 'emergency_withdraw'] },
        status: 'completed'
      };

      const [transactions, total] = await Promise.all([
        TreasuryTransaction.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        TreasuryTransaction.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('getOutflows failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch outflows' });
    }
  }

  static async recordFeeInflow(req, res) {
    try {
      const { asset = 'USDC', amount, source = 'trading_fees', purpose, fromAddress } = req.body;

      if (!amount || amount <= 0) {
        throw new ValidationError('Amount must be positive');
      }

      const transaction = new TreasuryTransaction({
        type: 'fee_inflow',
        asset,
        amount,
        source,
        purpose: purpose || `Fee collection from ${source}`,
        fromAddress: fromAddress || req.user.walletAddress,
        executedBy: req.user.walletAddress,
        status: 'completed'
      });

      await transaction.save();

      logger.info('Treasury fee inflow recorded', {
        amount,
        asset,
        source,
        by: req.user.walletAddress
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Fee inflow recorded successfully'
      });
    } catch (error) {
      logger.error('recordFeeInflow failed:', error);
      throw error;
    }
  }

  static async recordDistribution(req, res) {
    try {
      const { asset = 'USDC', amount, purpose, toAddress } = req.body;

      if (!amount || amount <= 0) {
        throw new ValidationError('Amount must be positive');
      }

      const transaction = new TreasuryTransaction({
        type: 'distribution_outflow',
        asset,
        amount,
        source: 'governance',
        purpose: purpose || 'Fee distribution',
        toAddress: toAddress || req.user.walletAddress,
        executedBy: req.user.walletAddress,
        status: 'completed'
      });

      await transaction.save();

      logger.info('Treasury distribution recorded', {
        amount,
        asset,
        to: toAddress,
        by: req.user.walletAddress
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Distribution recorded successfully'
      });
    } catch (error) {
      logger.error('recordDistribution failed:', error);
      throw error;
    }
  }

  static async recordGovernanceAction(req, res) {
    try {
      const { action, proposalId, details } = req.body;

      if (!action) {
        throw new ValidationError('Action description is required');
      }

      const transaction = new TreasuryTransaction({
        type: 'governance_action',
        asset: 'USDC',
        amount: 0,
        source: 'governance',
        purpose: `Governance action: ${action}`,
        governanceProposalId: proposalId,
        executedBy: req.user.walletAddress,
        metadata: { action, details },
        status: 'completed'
      });

      await transaction.save();

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Governance action recorded'
      });
    } catch (error) {
      logger.error('recordGovernanceAction failed:', error);
      throw error;
    }
  }

  static async getGovernanceActions(req, res) {
    try {
      const { limit = 20 } = req.query;
      const actions = await TreasuryTransaction.getGovernanceActions(parseInt(limit));

      res.json({
        success: true,
        data: { actions }
      });
    } catch (error) {
      logger.error('getGovernanceActions failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch governance actions' });
    }
  }

  static async getTreasurySummary(req, res) {
    try {
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000);
      const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const [currentBalance, inflows24h, inflows7d, outflows24h, outflows7d, topSources] = await Promise.all([
        TreasuryTransaction.getTreasuryBalance(),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: 'fee_inflow', createdAt: { $gte: last24h } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: 'fee_inflow', createdAt: { $gte: last7d } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: { $in: ['distribution_outflow', 'withdrawal'] }, createdAt: { $gte: last24h } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: { $in: ['distribution_outflow', 'withdrawal'] }, createdAt: { $gte: last7d } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TreasuryTransaction.aggregate([
          { $match: { status: 'completed', type: 'fee_inflow' } },
          { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 5 }
        ])
      ]);

      const balanceMap = {};
      for (const b of currentBalance) {
        balanceMap[b._id] = (b.totalInflow || 0) - (b.totalOutflow || 0);
      }

      res.json({
        success: true,
        data: {
          balance: balanceMap,
          inflows: {
            last24h: inflows24h[0]?.total || 0,
            last7d: inflows7d[0]?.total || 0
          },
          outflows: {
            last24h: outflows24h[0]?.total || 0,
            last7d: outflows7d[0]?.total || 0
          },
          topSources
        }
      });
    } catch (error) {
      logger.error('getTreasurySummary failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch treasury summary' });
    }
  }
}

module.exports = TreasuryController;
