const { getAbuseMetrics } = require('../middleware/abuseDetection');
const { getViolations } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

async function getRateLimitMetrics(req, res) {
  res.json({ success: true });
}

module.exports = { getRateLimitMetrics };
