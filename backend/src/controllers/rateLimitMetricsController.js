const { getAbuseMetrics } = require('../middleware/abuseDetection');
const { getViolations } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

async function getRateLimitMetrics(req, res) {
  try {
    const violations = getViolations();
    const abuseMetrics = getAbuseMetrics();
    res.json({ success: true, violations, abuseMetrics });
  } catch (error) {
    logger.error('[RATE-LIMIT-METRICS] Error fetching metrics', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate-limit metrics.' });
  }
}

module.exports = { getRateLimitMetrics };
