/**
 * Cross-Market Correlation Controller
 * Issue #135: Calculate correlations, display related markets, correlation heatmap
 */
const logger = require('../config/logger');

/**
 * Pearson correlation between two equal-length arrays.
 * Returns NaN if arrays are too short or have zero variance.
 */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}

/**
 * Build a synthetic price series from a market object.
 * Uses yesPrice history if available, otherwise generates from current probability.
 */
function buildSeries(market) {
  if (Array.isArray(market.priceHistory) && market.priceHistory.length >= 2) {
    return market.priceHistory.map((p) => (typeof p === 'number' ? p : p.price ?? 0.5));
  }
  // Fallback: flat series at current probability
  const p = market.yesPrice ?? market.probability ?? 0.5;
  return Array.from({ length: 10 }, () => p);
}

class CorrelationController {
  /**
   * GET /api/correlation/heatmap?ids=id1,id2,...
   * Returns NxN correlation matrix for the requested market IDs.
   */
  static async getHeatmap(req, res) {
    try {
      const { ids } = req.query;
      if (!ids) return res.status(400).json({ success: false, message: 'ids query param required' });

      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (idList.length < 2) {
        return res.status(400).json({ success: false, message: 'At least 2 market IDs required' });
      }

      // Fetch markets from DB if available, otherwise use mock data
      let markets;
      try {
        const { Market } = require('../models');
        markets = await Market.find({ marketId: { $in: idList } }).lean();
      } catch {
        // Non-DB mode: generate synthetic markets
        markets = idList.map((id) => ({ marketId: id, question: id, yesPrice: Math.random() }));
      }

      const series = markets.map(buildSeries);
      const maxLen = Math.max(...series.map((s) => s.length));
      // Pad shorter series to same length
      const padded = series.map((s) => {
        const last = s[s.length - 1] ?? 0.5;
        return s.length < maxLen ? [...s, ...Array(maxLen - s.length).fill(last)] : s;
      });

      const matrix = markets.map((_, i) =>
        markets.map((_, j) => {
          if (i === j) return 1;
          const r = pearson(padded[i], padded[j]);
          return isNaN(r) ? 0 : parseFloat(r.toFixed(4));
        })
      );

      const labels = markets.map((m) => ({ id: m.marketId, question: m.question }));
      return res.json({ success: true, data: { labels, matrix } });
    } catch (error) {
      logger.error('getHeatmap error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/correlation/related/:marketId?limit=5
   * Returns markets most correlated with the given market.
   */
  static async getRelated(req, res) {
    try {
      const { marketId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 5, 20);

      let allMarkets;
      try {
        const { Market } = require('../models');
        allMarkets = await Market.find({ status: 'active' }).lean();
      } catch {
        return res.json({ success: true, data: [] });
      }

      const target = allMarkets.find((m) => m.marketId === marketId);
      if (!target) return res.status(404).json({ success: false, message: 'Market not found' });

      const targetSeries = buildSeries(target);
      const others = allMarkets.filter((m) => m.marketId !== marketId);

      const scored = others.map((m) => {
        const s = buildSeries(m);
        const maxLen = Math.max(targetSeries.length, s.length);
        const pad = (arr) => {
          const last = arr[arr.length - 1] ?? 0.5;
          return arr.length < maxLen ? [...arr, ...Array(maxLen - arr.length).fill(last)] : arr;
        };
        const r = pearson(pad(targetSeries), pad(s));
        return { market: m, correlation: isNaN(r) ? 0 : parseFloat(r.toFixed(4)) };
      });

      scored.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
      const top = scored.slice(0, limit).map(({ market, correlation }) => ({
        marketId: market.marketId,
        question: market.question,
        category: market.category,
        correlation,
      }));

      return res.json({ success: true, data: top });
    } catch (error) {
      logger.error('getRelated error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CorrelationController;
