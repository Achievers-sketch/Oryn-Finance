const { Market } = require('../models');
const logger = require('../config/logger');
const { NotFoundError } = require('../middleware/errorHandler');

const VOLATILITY_BADGE_THRESHOLDS = {
  low: { max: 20 },
  moderate: { max: 50 },
  high: { max: 75 },
  extreme: { max: 100 }
};

function calculateBadge(score) {
  if (score <= VOLATILITY_BADGE_THRESHOLDS.low.max) return 'low';
  if (score <= VOLATILITY_BADGE_THRESHOLDS.moderate.max) return 'moderate';
  if (score <= VOLATILITY_BADGE_THRESHOLDS.high.max) return 'high';
  return 'extreme';
}

class VolatilityController {
  static async getMarketVolatility(req, res) {
    const { id } = req.params;
    const market = await Market.findOne({ marketId: id }).lean();

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    const volatility = market.volatility || { score: 0, badge: 'low', lastCalculated: null };
    const history = market.volatilityHistory || [];

    res.json({
      success: true,
      data: {
        marketId: id,
        volatility,
        history: history.slice(-100),
        badge: volatility.badge,
        badgeLabel: getBadgeLabel(volatility.badge),
        trend: calculateTrend(history)
      }
    });
  }

  static async getVolatileMarkets(req, res) {
    const { limit = 10, badge, sortBy = 'volatility.score', sortOrder = 'desc' } = req.query;

    const filter = { status: 'active' };
    if (badge) {
      filter['volatility.badge'] = badge;
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const markets = await Market.find(filter)
      .select('marketId question category region currentYesPrice currentNoPrice totalVolume volatility volatilityHistory')
      .sort({ [sortBy]: sortDirection })
      .limit(parseInt(limit))
      .lean();

    const result = markets.map(m => ({
      marketId: m.marketId,
      question: m.question,
      category: m.category,
      region: m.region,
      yesPrice: m.currentYesPrice,
      noPrice: m.currentNoPrice,
      volume: m.totalVolume,
      volatility: m.volatility || { score: 0, badge: 'low' },
      recentHistory: (m.volatilityHistory || []).slice(-10)
    }));

    res.json({
      success: true,
      data: {
        markets: result,
        count: result.length
      }
    });
  }

  static async calculateVolatility(req, res) {
    const { id } = req.params;
    const market = await Market.findOne({ marketId: id });

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    const priceHistory = market.statistics?.priceHistory || [];

    if (priceHistory.length < 5) {
      market.volatility = {
        score: 0,
        historicalFluctuation: 0,
        badge: 'low',
        lastCalculated: new Date()
      };
      await market.save();

      return res.json({
        success: true,
        data: {
          marketId: id,
          volatility: market.volatility,
          message: 'Insufficient price data for meaningful volatility calculation'
        }
      });
    }

    const prices = priceHistory.map(p => p.yesPrice);
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const volatilityScore = Math.min(Math.round(stdDev * 1000), 100);
    const historicalFluctuation = prices.length > 1
      ? Math.max(...prices) - Math.min(...prices)
      : 0;

    const badge = calculateBadge(volatilityScore);

    market.volatility = {
      score: volatilityScore,
      historicalFluctuation,
      badge,
      lastCalculated: new Date()
    };

    if (!market.volatilityHistory) {
      market.volatilityHistory = [];
    }
    market.volatilityHistory.push({
      timestamp: new Date(),
      score: volatilityScore,
      yesPrice: market.currentYesPrice,
      noPrice: market.currentNoPrice
    });

    if (market.volatilityHistory.length > 1000) {
      market.volatilityHistory = market.volatilityHistory.slice(-1000);
    }

    await market.save();

    logger.info('Volatility calculated for market', {
      marketId: id,
      score: volatilityScore,
      badge,
      dataPoints: priceHistory.length
    });

    res.json({
      success: true,
      data: {
        marketId: id,
        volatility: market.volatility,
        stats: {
          dataPoints: priceHistory.length,
          meanReturn,
          stdDev,
          priceRange: historicalFluctuation
        }
      }
    });
  }

  static async getMarketVolatilityHistory(req, res) {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const market = await Market.findOne({ marketId: id }).lean();

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    const history = (market.volatilityHistory || []).slice(-parseInt(limit));

    res.json({
      success: true,
      data: {
        marketId: id,
        history,
        currentBadge: market.volatility?.badge || 'low'
      }
    });
  }
}

function getBadgeLabel(badge) {
  const labels = {
    low: 'Low Volatility',
    moderate: 'Moderate Volatility',
    high: 'High Volatility',
    extreme: 'Extreme Volatility'
  };
  return labels[badge] || 'Unknown';
}

function calculateTrend(history) {
  if (!history || history.length < 3) return 'stable';
  const recent = history.slice(-5);
  const first = recent[0]?.score || 0;
  const last = recent[recent.length - 1]?.score || 0;

  if (last > first + 10) return 'increasing';
  if (last < first - 10) return 'decreasing';
  return 'stable';
}

module.exports = VolatilityController;
