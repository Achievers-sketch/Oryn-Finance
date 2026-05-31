const { Market, Trade } = require('../models');
const logger = require('../config/logger');

function imbalanceLevel(ratio) {
  if (ratio >= 0.8 || ratio <= 0.2) return 'critical';
  if (ratio >= 0.7 || ratio <= 0.3) return 'high';
  if (ratio >= 0.6 || ratio <= 0.4) return 'moderate';
  return 'balanced';
}

function suggestAction(yesVol, noVol, totalVol) {
  if (totalVol === 0) return { action: 'monitor', description: 'No trading activity yet.' };
  const ratio = yesVol / totalVol;
  if (ratio >= 0.7) return { action: 'add_no_liquidity', description: 'NO side is under-represented. Add NO liquidity to balance the pool.' };
  if (ratio <= 0.3) return { action: 'add_yes_liquidity', description: 'YES side is under-represented. Add YES liquidity to balance the pool.' };
  return { action: 'maintain', description: 'Pool is reasonably balanced. Maintain current allocation.' };
}

function estimateImpact(yesVol, noVol, targetRatio = 0.5) {
  const total = yesVol + noVol;
  if (total === 0) return { requiredYes: 0, requiredNo: 0, estimatedSlippageReduction: 0 };
  const currentRatio = yesVol / total;
  const imbalance = Math.abs(currentRatio - targetRatio);
  const requiredAdd = imbalance * total;
  return {
    requiredYes: currentRatio < targetRatio ? Number(requiredAdd.toFixed(2)) : 0,
    requiredNo: currentRatio > targetRatio ? Number(requiredAdd.toFixed(2)) : 0,
    estimatedSlippageReduction: Number((imbalance * 100 * 0.4).toFixed(1)),
  };
}

class LiquidityRebalancingController {
  // GET /api/liquidity/rebalancing
  static async getSuggestions(req, res) {
    const markets = await Market.find({ status: 'active' }, { marketId: 1, question: 1, category: 1, liquidity: 1 })
      .limit(50)
      .lean();

    const suggestions = await Promise.all(
      markets.map(async market => {
        const [yesAgg, noAgg] = await Promise.all([
          Trade.aggregate([
            { $match: { marketId: market.marketId, tokenType: 'yes', status: 'confirmed' } },
            { $group: { _id: null, volume: { $sum: '$totalCost' } } },
          ]),
          Trade.aggregate([
            { $match: { marketId: market.marketId, tokenType: 'no', status: 'confirmed' } },
            { $group: { _id: null, volume: { $sum: '$totalCost' } } },
          ]),
        ]);

        const yesVol = yesAgg[0]?.volume || 0;
        const noVol = noAgg[0]?.volume || 0;
        const totalVol = yesVol + noVol;
        const ratio = totalVol > 0 ? yesVol / totalVol : 0.5;
        const level = imbalanceLevel(ratio);
        const suggestion = suggestAction(yesVol, noVol, totalVol);
        const impact = estimateImpact(yesVol, noVol);

        return {
          marketId: market.marketId,
          question: market.question,
          category: market.category || 'unknown',
          yesVolume: yesVol,
          noVolume: noVol,
          totalVolume: totalVol,
          yesRatio: Number(ratio.toFixed(3)),
          imbalanceLevel: level,
          suggestion,
          impact,
        };
      })
    );

    // Sort: critical first, then high, moderate, balanced
    const ORDER = { critical: 0, high: 1, moderate: 2, balanced: 3 };
    suggestions.sort((a, b) => ORDER[a.imbalanceLevel] - ORDER[b.imbalanceLevel]);

    const summary = {
      total: suggestions.length,
      critical: suggestions.filter(s => s.imbalanceLevel === 'critical').length,
      high: suggestions.filter(s => s.imbalanceLevel === 'high').length,
      moderate: suggestions.filter(s => s.imbalanceLevel === 'moderate').length,
      balanced: suggestions.filter(s => s.imbalanceLevel === 'balanced').length,
    };

    logger.info('Liquidity rebalancing suggestions generated', summary);

    return res.json({ success: true, data: { summary, suggestions } });
  }
}

module.exports = LiquidityRebalancingController;
