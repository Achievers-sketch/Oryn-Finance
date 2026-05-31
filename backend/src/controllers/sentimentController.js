const { Market, Trade } = require('../models');
const logger = require('../config/logger');

// Simple keyword-based text scoring
const POS_WORDS = ['surge', 'rally', 'gain', 'bullish', 'growth', 'record', 'high', 'win', 'success', 'rise', 'up', 'positive'];
const NEG_WORDS = ['crash', 'drop', 'bearish', 'loss', 'decline', 'low', 'fail', 'negative', 'risk', 'down', 'plunge', 'collapse'];

function scoreText(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const pos = POS_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEG_WORDS.filter(w => lower.includes(w)).length;
  const total = pos + neg;
  return total === 0 ? 0 : (pos - neg) / total;
}

function sentimentLabel(score) {
  if (score > 0.2) return 'bullish';
  if (score < -0.2) return 'bearish';
  return 'neutral';
}

// Cache aggregated result for 5 minutes
let cachedAggregated = null;
let cacheExpiry = 0;

// Rolling snapshot buffer for history tracking (#162)
const HISTORY_MAX = 288; // 24h at 5-min intervals
const sentimentSnapshots = []; // [{timestamp, overall, byCategory}]

function captureSnapshot(data) {
  sentimentSnapshots.push({ timestamp: data.generatedAt, overall: data.overall, byCategory: data.byCategory });
  if (sentimentSnapshots.length > HISTORY_MAX) sentimentSnapshots.shift();
}

class SentimentController {
  // GET /api/sentiment/market/:marketId
  static async getMarketSentiment(req, res) {
    const { marketId } = req.params;

    const market = await Market.findOne({ marketId }, { question: 1, category: 1 }).lean();

    const [yesAgg, noAgg] = await Promise.all([
      Trade.aggregate([
        { $match: { marketId, tokenType: 'yes', status: 'confirmed' } },
        { $group: { _id: null, volume: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]),
      Trade.aggregate([
        { $match: { marketId, tokenType: 'no', status: 'confirmed' } },
        { $group: { _id: null, volume: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]),
    ]);

    const yesVol = yesAgg[0]?.volume || 0;
    const noVol = noAgg[0]?.volume || 0;
    const totalVol = yesVol + noVol;
    const tradeCount = (yesAgg[0]?.count || 0) + (noAgg[0]?.count || 0);

    const volumeSentiment = totalVol > 0 ? (yesVol - noVol) / totalVol : 0;
    const textScore = market ? scoreText(market.question) : 0;
    const composite = volumeSentiment * 0.7 + textScore * 0.3;

    return res.json({
      success: true,
      data: {
        marketId,
        sentiment: Number(composite.toFixed(3)),
        score: Math.round((composite + 1) * 50),
        label: sentimentLabel(composite),
        confidence: Math.min(100, Math.round(totalVol / 10)),
        yesVolume: yesVol,
        noVolume: noVol,
        tradeCount,
      },
    });
  }

  // GET /api/sentiment/aggregated
  static async getAggregatedSentiment(req, res) {
    const now = Date.now();
    if (cachedAggregated && now < cacheExpiry) {
      return res.json({ success: true, data: cachedAggregated, cached: true });
    }

    const markets = await Market.find({ status: 'active' }, { marketId: 1, question: 1, category: 1 })
      .limit(30)
      .lean();

    const marketSentiments = await Promise.all(
      markets.map(async m => {
        const [yesAgg, noAgg] = await Promise.all([
          Trade.aggregate([
            { $match: { marketId: m.marketId, tokenType: 'yes', status: 'confirmed' } },
            { $group: { _id: null, volume: { $sum: '$totalCost' } } },
          ]),
          Trade.aggregate([
            { $match: { marketId: m.marketId, tokenType: 'no', status: 'confirmed' } },
            { $group: { _id: null, volume: { $sum: '$totalCost' } } },
          ]),
        ]);
        const y = yesAgg[0]?.volume || 0;
        const n = noAgg[0]?.volume || 0;
        const total = y + n;
        const volScore = total > 0 ? (y - n) / total : 0;
        const textScore = scoreText(m.question);
        const composite = volScore * 0.7 + textScore * 0.3;
        return {
          marketId: m.marketId,
          question: m.question,
          category: m.category || 'unknown',
          sentiment: Number(composite.toFixed(3)),
          label: sentimentLabel(composite),
          confidence: Math.min(100, Math.round(total / 10)),
        };
      })
    );

    // Aggregate by category
    const catMap = {};
    marketSentiments.forEach(ms => {
      if (!catMap[ms.category]) catMap[ms.category] = [];
      catMap[ms.category].push(ms.sentiment);
    });
    const byCategory = Object.entries(catMap).map(([category, scores]) => ({
      category,
      avgSentiment: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)),
      label: sentimentLabel(scores.reduce((a, b) => a + b, 0) / scores.length),
      marketCount: scores.length,
    }));

    const overallScore = marketSentiments.length
      ? marketSentiments.reduce((s, m) => s + m.sentiment, 0) / marketSentiments.length
      : 0;

    cachedAggregated = {
      overall: {
        score: Number(overallScore.toFixed(3)),
        index: Math.round((overallScore + 1) * 50),
        label: sentimentLabel(overallScore),
      },
      byCategory,
      markets: marketSentiments,
      generatedAt: new Date().toISOString(),
    };
    cacheExpiry = now + 5 * 60 * 1000;
    captureSnapshot(cachedAggregated);

    return res.json({ success: true, data: cachedAggregated });
  }

  // GET /api/sentiment/history — rolling snapshot history (#162)
  static async getSentimentHistory(req, res) {
    const limit = Math.min(parseInt(req.query.limit) || 48, HISTORY_MAX);
    const snapshots = sentimentSnapshots.slice(-limit);

    // If no real snapshots yet, build synthetic ones from current data
    if (snapshots.length === 0 && cachedAggregated) {
      snapshots.push({ timestamp: cachedAggregated.generatedAt, overall: cachedAggregated.overall, byCategory: cachedAggregated.byCategory });
    }

    return res.json({
      success: true,
      data: {
        snapshots,
        count: snapshots.length,
      },
    });
  }
}

module.exports = SentimentController;
