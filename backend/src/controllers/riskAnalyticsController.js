const { Position, Trade, Market } = require('../models');
const logger = require('../config/logger');

class RiskAnalyticsController {
  // GET /api/risk/exposure?walletAddress=
  static async getRiskExposure(req, res) {
    const { walletAddress } = req.query;
    if (!walletAddress) return res.status(400).json({ success: false, message: 'walletAddress is required' });

    const positions = await Position.find({
      userWalletAddress: walletAddress.toLowerCase(),
      status: 'active',
    }).lean();

    const totalExposure = positions.reduce((s, p) => s + p.totalCostBasis, 0);
    const yesExposure = positions.filter(p => p.tokenType === 'yes').reduce((s, p) => s + p.totalCostBasis, 0);
    const noExposure = positions.filter(p => p.tokenType === 'no').reduce((s, p) => s + p.totalCostBasis, 0);
    const totalPnL = positions.reduce((s, p) => s + p.unrealizedPnL + p.realizedPnL, 0);

    const avgMaxDrawdown = positions.length
      ? positions.reduce((s, p) => s + (p.riskMetrics?.maxDrawdown || 0), 0) / positions.length
      : 0;
    const avgVolatility = positions.length
      ? positions.reduce((s, p) => s + (p.riskMetrics?.volatility || 0), 0) / positions.length
      : 0;
    const avgSharpe = positions.length
      ? positions.reduce((s, p) => s + (p.riskMetrics?.sharpeRatio || 0), 0) / positions.length
      : 0;

    const riskLevel = totalExposure > 1000 ? 'high' : totalExposure > 100 ? 'medium' : 'low';

    return res.json({
      success: true,
      data: {
        totalExposure: Number(totalExposure.toFixed(4)),
        yesExposure: Number(yesExposure.toFixed(4)),
        noExposure: Number(noExposure.toFixed(4)),
        totalPnL: Number(totalPnL.toFixed(4)),
        positionCount: positions.length,
        avgMaxDrawdown: Number(avgMaxDrawdown.toFixed(4)),
        avgVolatility: Number(avgVolatility.toFixed(4)),
        avgSharpeRatio: Number(avgSharpe.toFixed(4)),
        riskLevel,
      },
    });
  }

  // GET /api/risk/diversification?walletAddress=
  static async getDiversificationMetrics(req, res) {
    const { walletAddress } = req.query;
    if (!walletAddress) return res.status(400).json({ success: false, message: 'walletAddress is required' });

    const positions = await Position.find({
      userWalletAddress: walletAddress.toLowerCase(),
      status: 'active',
    }).lean();

    const marketIds = [...new Set(positions.map(p => p.marketId))];
    const markets = await Market.find({ marketId: { $in: marketIds } }, { marketId: 1, category: 1 }).lean();

    const categoryMap = {};
    markets.forEach(m => { categoryMap[m.marketId] = m.category || 'unknown'; });

    const byCategory = {};
    let totalValue = 0;
    positions.forEach(p => {
      const cat = categoryMap[p.marketId] || 'unknown';
      byCategory[cat] = (byCategory[cat] || 0) + p.totalCostBasis;
      totalValue += p.totalCostBasis;
    });

    const distribution = Object.entries(byCategory).map(([category, value]) => ({
      category,
      value: Number(value.toFixed(4)),
      weight: totalValue > 0 ? Number((value / totalValue).toFixed(4)) : 0,
    }));

    // Herfindahl–Hirschman Index: 1 = fully concentrated, 0 = perfectly spread
    const hhi = distribution.reduce((s, d) => s + d.weight ** 2, 0);
    const diversificationScore = Math.round((1 - hhi) * 100);

    return res.json({
      success: true,
      data: {
        distribution,
        uniqueMarkets: marketIds.length,
        uniqueCategories: Object.keys(byCategory).length,
        diversificationScore,
        concentrationLevel: hhi > 0.25 ? 'concentrated' : hhi > 0.1 ? 'moderate' : 'diversified',
        hhi: Number(hhi.toFixed(4)),
      },
    });
  }

  // GET /api/risk/volatility?walletAddress=
  static async getVolatilityIndicators(req, res) {
    const { walletAddress } = req.query;
    if (!walletAddress) return res.status(400).json({ success: false, message: 'walletAddress is required' });

    const trades = await Trade.find({
      userWalletAddress: walletAddress.toLowerCase(),
      status: 'confirmed',
    })
      .sort({ timestamp: -1 })
      .limit(60)
      .lean();

    if (trades.length < 2) {
      return res.json({ success: true, data: { volatility: 0, sharpe: 0, meanReturn: 0, sampleSize: trades.length } });
    }

    const prices = trades.map(t => t.price).reverse();
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / (prices[i - 1] || 1));
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const sharpe = volatility > 0 ? mean / volatility : 0;

    // 14-period rolling volatility
    const recent = returns.slice(-14);
    const recentMean = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const recentVar = recent.reduce((s, r) => s + (r - recentMean) ** 2, 0) / Math.max(1, recent.length);
    const rollingVolatility = Math.sqrt(recentVar);

    return res.json({
      success: true,
      data: {
        volatility: Number(volatility.toFixed(4)),
        rollingVolatility: Number(rollingVolatility.toFixed(4)),
        sharpe: Number(sharpe.toFixed(4)),
        meanReturn: Number(mean.toFixed(4)),
        sampleSize: returns.length,
      },
    });
  }
}

module.exports = RiskAnalyticsController;
