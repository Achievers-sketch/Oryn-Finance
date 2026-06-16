const Market = require('../models/Market');
const Trade = require('../models/Trade');
const Position = require('../models/Position');
const IndexedEvent = require('../models/IndexedEvent');
const TreasuryTransaction = require('../models/TreasuryTransaction');
const logger = require('../config/logger');
const { ValidationError } = require('../middleware/errorHandler');

const INFLOW_TYPES = ['fee_inflow'];
const OUTFLOW_TYPES = ['distribution_outflow', 'withdrawal', 'emergency_withdraw', 'investment'];
const TREASURY_REPORT_TYPES = [...INFLOW_TYPES, ...OUTFLOW_TYPES, 'governance_action'];
const VALID_TIMEFRAMES = new Set(['24h', '7d', '30d', '90d', '1y']);

class ReportingController {
  static parseTimeframe(timeframe = '30d') {
    const now = Date.now();
    switch (timeframe) {
      case '24h':
        return new Date(now - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now - 365 * 24 * 60 * 60 * 1000);
      case '30d':
      default:
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
  }

  static getDateFormat(timeframe = '30d') {
    if (timeframe === '24h') return '%Y-%m-%d %H:00';
    if (timeframe === '1y') return '%Y-%m';
    return '%Y-%m-%d';
  }

  static parseLimit(limit, fallback = 10, max = 100) {
    const parsed = parseInt(limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
  }

  static getReportOptions(query = {}) {
    const timeframe = VALID_TIMEFRAMES.has(query.timeframe) ? query.timeframe : '30d';
    const limit = ReportingController.parseLimit(query.limit, 10, 100);
    const category = typeof query.category === 'string' && query.category.trim()
      ? query.category.trim()
      : null;

    return {
      timeframe,
      startDate: ReportingController.parseTimeframe(timeframe),
      endDate: new Date(),
      dateFormat: ReportingController.getDateFormat(timeframe),
      limit,
      category,
    };
  }

  static marketLookupStages(category = null) {
    const stages = [
      {
        $lookup: {
          from: 'markets',
          localField: 'marketId',
          foreignField: 'marketId',
          as: 'market',
        },
      },
      {
        $unwind: {
          path: '$market',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (category) {
      stages.push({ $match: { 'market.category': category } });
    }

    return stages;
  }

  static async buildMarketExposureReport(options) {
    const activePositionMatch = { status: 'active' };
    const confirmedTradeMatch = {
      status: 'confirmed',
      timestamp: { $gte: options.startDate, $lte: options.endDate },
    };

    const [
      summaryRows,
      byCategory,
      topMarkets,
      recentTradingExposure,
      marketStatusDistribution,
    ] = await Promise.all([
      Position.aggregate([
        { $match: activePositionMatch },
        ...ReportingController.marketLookupStages(options.category),
        {
          $group: {
            _id: null,
            activePositions: { $sum: 1 },
            uniqueWallets: { $addToSet: '$userWalletAddress' },
            totalShares: { $sum: { $ifNull: ['$totalShares', 0] } },
            totalCostBasis: { $sum: { $ifNull: ['$totalCostBasis', 0] } },
            realizedPnL: { $sum: { $ifNull: ['$realizedPnL', 0] } },
            unrealizedPnL: { $sum: { $ifNull: ['$unrealizedPnL', 0] } },
            yesShares: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'yes'] }, { $ifNull: ['$totalShares', 0] }, 0],
              },
            },
            noShares: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'no'] }, { $ifNull: ['$totalShares', 0] }, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            activePositions: 1,
            uniqueWallets: { $size: '$uniqueWallets' },
            totalShares: 1,
            totalCostBasis: 1,
            realizedPnL: 1,
            unrealizedPnL: 1,
            yesShares: 1,
            noShares: 1,
          },
        },
      ]),
      Position.aggregate([
        { $match: activePositionMatch },
        ...ReportingController.marketLookupStages(options.category),
        {
          $group: {
            _id: { $ifNull: ['$market.category', 'uncategorized'] },
            activePositions: { $sum: 1 },
            uniqueWallets: { $addToSet: '$userWalletAddress' },
            totalShares: { $sum: { $ifNull: ['$totalShares', 0] } },
            totalCostBasis: { $sum: { $ifNull: ['$totalCostBasis', 0] } },
            unrealizedPnL: { $sum: { $ifNull: ['$unrealizedPnL', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            activePositions: 1,
            uniqueWallets: { $size: '$uniqueWallets' },
            totalShares: 1,
            totalCostBasis: 1,
            unrealizedPnL: 1,
          },
        },
        { $sort: { totalCostBasis: -1 } },
      ]),
      Position.aggregate([
        { $match: activePositionMatch },
        ...ReportingController.marketLookupStages(options.category),
        {
          $group: {
            _id: '$marketId',
            question: { $first: '$market.question' },
            category: { $first: '$market.category' },
            status: { $first: '$market.status' },
            currentYesPrice: { $first: '$market.currentYesPrice' },
            currentNoPrice: { $first: '$market.currentNoPrice' },
            activePositions: { $sum: 1 },
            holders: { $addToSet: '$userWalletAddress' },
            yesShares: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'yes'] }, { $ifNull: ['$totalShares', 0] }, 0],
              },
            },
            noShares: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'no'] }, { $ifNull: ['$totalShares', 0] }, 0],
              },
            },
            totalShares: { $sum: { $ifNull: ['$totalShares', 0] } },
            totalCostBasis: { $sum: { $ifNull: ['$totalCostBasis', 0] } },
            unrealizedPnL: { $sum: { $ifNull: ['$unrealizedPnL', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            marketId: '$_id',
            question: { $ifNull: ['$question', 'Unknown market'] },
            category: { $ifNull: ['$category', 'uncategorized'] },
            status: { $ifNull: ['$status', 'unknown'] },
            currentYesPrice: { $ifNull: ['$currentYesPrice', 0] },
            currentNoPrice: { $ifNull: ['$currentNoPrice', 0] },
            activePositions: 1,
            holders: { $size: '$holders' },
            yesShares: 1,
            noShares: 1,
            totalShares: 1,
            totalCostBasis: 1,
            unrealizedPnL: 1,
          },
        },
        { $sort: { totalCostBasis: -1 } },
        { $limit: options.limit },
      ]),
      Trade.aggregate([
        { $match: confirmedTradeMatch },
        ...ReportingController.marketLookupStages(options.category),
        {
          $group: {
            _id: { $ifNull: ['$market.category', 'uncategorized'] },
            totalVolume: { $sum: { $ifNull: ['$totalCost', 0] } },
            tradeCount: { $sum: 1 },
            uniqueTraders: { $addToSet: '$userWalletAddress' },
            yesVolume: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'yes'] }, { $ifNull: ['$totalCost', 0] }, 0],
              },
            },
            noVolume: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'no'] }, { $ifNull: ['$totalCost', 0] }, 0],
              },
            },
            averagePrice: { $avg: '$price' },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            totalVolume: 1,
            tradeCount: 1,
            uniqueTraders: { $size: '$uniqueTraders' },
            yesVolume: 1,
            noVolume: 1,
            averagePrice: 1,
          },
        },
        { $sort: { totalVolume: -1 } },
      ]),
      Market.aggregate([
        {
          $match: {
            ...(options.category ? { category: options.category } : {}),
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: { $ifNull: ['$totalVolume', 0] } },
            totalLiquidity: { $sum: { $ifNull: ['$initialLiquidity', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            status: { $ifNull: ['$_id', 'unknown'] },
            count: 1,
            totalVolume: 1,
            totalLiquidity: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    const summary = summaryRows[0] || {
      activePositions: 0,
      uniqueWallets: 0,
      totalShares: 0,
      totalCostBasis: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      yesShares: 0,
      noShares: 0,
    };

    const largestExposure = topMarkets[0]?.totalCostBasis || 0;
    const concentrationRatio = summary.totalCostBasis > 0
      ? largestExposure / summary.totalCostBasis
      : 0;

    return {
      summary: {
        ...summary,
        netDirectionalShares: summary.yesShares - summary.noShares,
        concentrationRatio,
      },
      byCategory,
      topMarkets,
      recentTradingExposure,
      marketStatusDistribution,
    };
  }

  static async buildTreasuryReport(options) {
    const timeframeMatch = {
      status: 'completed',
      type: { $in: TREASURY_REPORT_TYPES },
      createdAt: { $gte: options.startDate, $lte: options.endDate },
    };

    const [
      balances,
      flowSummaryRows,
      flowSeries,
      sourceMix,
      assetFlows,
      recentTransactions,
    ] = await Promise.all([
      TreasuryTransaction.getTreasuryBalance(),
      TreasuryTransaction.aggregate([
        { $match: timeframeMatch },
        {
          $group: {
            _id: null,
            totalInflows: {
              $sum: {
                $cond: [{ $in: ['$type', INFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
            totalOutflows: {
              $sum: {
                $cond: [{ $in: ['$type', OUTFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
            governanceActions: {
              $sum: { $cond: [{ $eq: ['$type', 'governance_action'] }, 1, 0] },
            },
            transactionCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalInflows: 1,
            totalOutflows: 1,
            netFlow: { $subtract: ['$totalInflows', '$totalOutflows'] },
            governanceActions: 1,
            transactionCount: 1,
          },
        },
      ]),
      TreasuryTransaction.aggregate([
        { $match: timeframeMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: options.dateFormat,
                date: '$createdAt',
              },
            },
            inflows: {
              $sum: {
                $cond: [{ $in: ['$type', INFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
            outflows: {
              $sum: {
                $cond: [{ $in: ['$type', OUTFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
            actions: {
              $sum: { $cond: [{ $eq: ['$type', 'governance_action'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            period: '$_id',
            inflows: 1,
            outflows: 1,
            netFlow: { $subtract: ['$inflows', '$outflows'] },
            actions: 1,
          },
        },
        { $sort: { period: 1 } },
      ]),
      TreasuryTransaction.aggregate([
        {
          $match: {
            status: 'completed',
            type: 'fee_inflow',
            createdAt: { $gte: options.startDate, $lte: options.endDate },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$source', 'other'] },
            total: { $sum: { $ifNull: ['$amount', 0] } },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            source: '$_id',
            total: 1,
            count: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),
      TreasuryTransaction.aggregate([
        { $match: timeframeMatch },
        {
          $group: {
            _id: '$asset',
            inflows: {
              $sum: {
                $cond: [{ $in: ['$type', INFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
            outflows: {
              $sum: {
                $cond: [{ $in: ['$type', OUTFLOW_TYPES] }, { $ifNull: ['$amount', 0] }, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            asset: { $ifNull: ['$_id', 'USDC'] },
            inflows: 1,
            outflows: 1,
            netFlow: { $subtract: ['$inflows', '$outflows'] },
          },
        },
        { $sort: { netFlow: -1 } },
      ]),
      TreasuryTransaction.find({
        status: 'completed',
        type: { $in: TREASURY_REPORT_TYPES },
      })
        .sort({ createdAt: -1 })
        .limit(options.limit)
        .lean(),
    ]);

    const balanceByAsset = {};
    for (const balance of balances) {
      const asset = balance._id || 'USDC';
      balanceByAsset[asset] = (balance.totalInflow || 0) - (balance.totalOutflow || 0);
    }

    const flowSummary = flowSummaryRows[0] || {
      totalInflows: 0,
      totalOutflows: 0,
      netFlow: 0,
      governanceActions: 0,
      transactionCount: 0,
    };

    return {
      summary: {
        ...flowSummary,
        balanceByAsset,
        totalBalance: Object.values(balanceByAsset).reduce((sum, value) => sum + value, 0),
      },
      flowSeries,
      sourceMix,
      assetFlows,
      recentTransactions,
    };
  }

  static async buildGovernanceActivityReport(options) {
    const actionMatch = {
      status: 'completed',
      type: 'governance_action',
      createdAt: { $gte: options.startDate, $lte: options.endDate },
    };
    const eventMatch = {
      createdAt: { $gte: options.startDate, $lte: options.endDate },
      $or: [
        { contractName: { $regex: 'governance', $options: 'i' } },
        { topic: { $regex: 'governance|proposal|vote|timelock', $options: 'i' } },
      ],
    };

    const [
      summaryRows,
      actionsByType,
      proposalActivity,
      topExecutors,
      eventTopics,
      eventSeries,
      recentActions,
    ] = await Promise.all([
      TreasuryTransaction.aggregate([
        { $match: actionMatch },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            proposalsAffected: { $addToSet: '$governanceProposalId' },
            executors: { $addToSet: '$executedBy' },
          },
        },
        {
          $project: {
            _id: 0,
            totalActions: 1,
            proposalsAffected: {
              $size: {
                $filter: {
                  input: '$proposalsAffected',
                  as: 'proposal',
                  cond: { $ne: ['$$proposal', null] },
                },
              },
            },
            uniqueExecutors: {
              $size: {
                $filter: {
                  input: '$executors',
                  as: 'executor',
                  cond: { $ne: ['$$executor', null] },
                },
              },
            },
          },
        },
      ]),
      TreasuryTransaction.aggregate([
        { $match: actionMatch },
        {
          $group: {
            _id: { $ifNull: ['$metadata.action', 'unspecified'] },
            count: { $sum: 1 },
            proposals: { $addToSet: '$governanceProposalId' },
          },
        },
        {
          $project: {
            _id: 0,
            action: '$_id',
            count: 1,
            proposals: { $size: '$proposals' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      TreasuryTransaction.aggregate([
        { $match: actionMatch },
        {
          $group: {
            _id: { $ifNull: ['$governanceProposalId', 'unlinked'] },
            actions: { $sum: 1 },
            lastActionAt: { $max: '$createdAt' },
            totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            proposalId: '$_id',
            actions: 1,
            lastActionAt: 1,
            totalAmount: 1,
          },
        },
        { $sort: { lastActionAt: -1 } },
        { $limit: options.limit },
      ]),
      TreasuryTransaction.aggregate([
        { $match: actionMatch },
        {
          $group: {
            _id: { $ifNull: ['$executedBy', 'unknown'] },
            actions: { $sum: 1 },
            lastActionAt: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            executor: '$_id',
            actions: 1,
            lastActionAt: 1,
          },
        },
        { $sort: { actions: -1, lastActionAt: -1 } },
        { $limit: options.limit },
      ]),
      IndexedEvent.aggregate([
        { $match: eventMatch },
        {
          $group: {
            _id: '$topic',
            count: { $sum: 1 },
            latestLedger: { $max: '$ledger' },
          },
        },
        {
          $project: {
            _id: 0,
            topic: { $ifNull: ['$_id', 'unknown'] },
            count: 1,
            latestLedger: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      IndexedEvent.aggregate([
        { $match: eventMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: options.dateFormat,
                date: '$createdAt',
              },
            },
            events: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            period: '$_id',
            events: 1,
          },
        },
        { $sort: { period: 1 } },
      ]),
      TreasuryTransaction.find(actionMatch)
        .sort({ createdAt: -1 })
        .limit(options.limit)
        .lean(),
    ]);

    const eventCount = eventTopics.reduce((sum, topic) => sum + (topic.count || 0), 0);
    const summary = summaryRows[0] || {
      totalActions: 0,
      proposalsAffected: 0,
      uniqueExecutors: 0,
    };

    return {
      summary: {
        ...summary,
        indexedGovernanceEvents: eventCount,
      },
      actionsByType,
      proposalActivity,
      topExecutors,
      eventTopics,
      eventSeries,
      recentActions,
    };
  }

  static buildMetadata(options) {
    return {
      generatedAt: new Date().toISOString(),
      timeframe: options.timeframe,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      filters: {
        category: options.category || 'all',
        limit: options.limit,
      },
    };
  }

  static async getMarketExposureReport(req, res) {
    try {
      const options = ReportingController.getReportOptions(req.query);
      const report = await ReportingController.buildMarketExposureReport(options);
      res.json({
        success: true,
        data: {
          metadata: ReportingController.buildMetadata(options),
          marketExposure: report,
        },
      });
    } catch (error) {
      logger.error('Market exposure report failed:', error);
      throw error;
    }
  }

  static async getTreasuryReport(req, res) {
    try {
      const options = ReportingController.getReportOptions(req.query);
      const report = await ReportingController.buildTreasuryReport(options);
      res.json({
        success: true,
        data: {
          metadata: ReportingController.buildMetadata(options),
          treasury: report,
        },
      });
    } catch (error) {
      logger.error('Treasury report failed:', error);
      throw error;
    }
  }

  static async getGovernanceActivityReport(req, res) {
    try {
      const options = ReportingController.getReportOptions(req.query);
      const report = await ReportingController.buildGovernanceActivityReport(options);
      res.json({
        success: true,
        data: {
          metadata: ReportingController.buildMetadata(options),
          governanceActivity: report,
        },
      });
    } catch (error) {
      logger.error('Governance activity report failed:', error);
      throw error;
    }
  }

  static async getInstitutionalDashboard(req, res) {
    try {
      const options = ReportingController.getReportOptions(req.query);

      if (req.query.category && typeof req.query.category !== 'string') {
        throw new ValidationError('category must be a string', 'category');
      }

      const [marketExposure, treasury, governanceActivity] = await Promise.all([
        ReportingController.buildMarketExposureReport(options),
        ReportingController.buildTreasuryReport(options),
        ReportingController.buildGovernanceActivityReport(options),
      ]);

      res.json({
        success: true,
        data: {
          metadata: ReportingController.buildMetadata(options),
          marketExposure,
          treasury,
          governanceActivity,
        },
      });
    } catch (error) {
      logger.error('Institutional reporting dashboard failed:', error);
      throw error;
    }
  }
}

module.exports = ReportingController;
