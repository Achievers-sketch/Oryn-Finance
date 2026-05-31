const oracleService = require('../services/oracleService');
const logger = require('../config/logger');

class OracleConsensusController {
  // GET /api/oracle/consensus
  static async getConsensus(req, res) {
    const healthMap = oracleService.getSourceHealthStatus ? oracleService.getSourceHealthStatus() : null;

    const sources = healthMap
      ? Object.entries(healthMap).map(([name, h]) => ({
          name,
          successCount: h.successCount || 0,
          failureCount: h.failureCount || 0,
          failureRate: Number((h.failureRate || 0).toFixed(3)),
          isHealthy: (h.failureRate || 0) <= 0.3,
          lastFailure: h.lastFailure || null,
          weight: (h.failureRate || 0) <= 0.1 ? 'high' : (h.failureRate || 0) <= 0.3 ? 'medium' : 'low',
          confidence: Math.max(0, Math.round((1 - (h.failureRate || 0)) * 100)),
        }))
      : [
          { name: 'coingecko', successCount: 0, failureCount: 0, failureRate: 0, isHealthy: true, lastFailure: null, weight: 'high', confidence: 100 },
          { name: 'chainlink', successCount: 0, failureCount: 0, failureRate: 0, isHealthy: true, lastFailure: null, weight: 'high', confidence: 100 },
          { name: 'news-api', successCount: 0, failureCount: 0, failureRate: 0, isHealthy: true, lastFailure: null, weight: 'medium', confidence: 80 },
          { name: 'sports-api', successCount: 0, failureCount: 0, failureRate: 0, isHealthy: true, lastFailure: null, weight: 'medium', confidence: 80 },
        ];

    const healthySources = sources.filter(s => s.isHealthy);
    const totalWeight = sources.length > 0 ? sources.reduce((s, src) => s + src.confidence, 0) / sources.length : 0;
    const consensusThreshold = 0.7; // 70% agreement required

    // Derive consensus state from health ratios
    const agreeingCount = healthySources.length;
    const consensusReached = sources.length > 0 && agreeingCount / sources.length >= consensusThreshold;

    logger.info('Oracle consensus retrieved', { sourceCount: sources.length, consensusReached });

    return res.json({
      success: true,
      data: {
        sources,
        consensus: {
          reached: consensusReached,
          agreementPct: sources.length > 0 ? Number(((agreeingCount / sources.length) * 100).toFixed(1)) : 0,
          overallConfidence: Number(totalWeight.toFixed(1)),
          threshold: consensusThreshold * 100,
          healthySources: agreeingCount,
          totalSources: sources.length,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  }
}

module.exports = OracleConsensusController;
