const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getRateLimitMetrics } = require('../controllers/rateLimitMetricsController');

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, asyncHandler(getRateLimitMetrics));

module.exports = router;
