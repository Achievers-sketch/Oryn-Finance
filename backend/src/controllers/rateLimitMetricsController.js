const { getAbuseMetrics } = require('../middleware/abuseDetection');
const { getViolations } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

async function getRateLimitMetrics(req, res) {
  try {
    const violations = getViolations();
    const abuseMetrics = getAbuseMetrics();
    const violationsByLimiter = violations.reduce((acc, v) => {
      acc[v.limiter] = (acc[v.limiter] || 0) + 1;
      return acc;
    }, {});
    const recentViolations = violations.filter((v) => Date.now() - v.timestamp < 60 * 60 * 1000);
    res.json({
      success: true,
      summary: {
        totalViolations: violations.length,
        recentViolations: recentViolations.length,
        violationsByLimiter,
        ...abuseMetrics,
      },
      violations: recentViolations.slice(-100).reverse(),
    });
  } catch (error) {
    logger.error('[RATE-LIMIT-METRICS] Error fetching metrics', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate-limit metrics.' });
  }
}

module.exports = { getRateLimitMetrics };
