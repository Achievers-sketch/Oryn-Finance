const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const RiskAnalyticsController = require('../controllers/riskAnalyticsController');

router.get('/exposure', asyncHandler(RiskAnalyticsController.getRiskExposure));
router.get('/diversification', asyncHandler(RiskAnalyticsController.getDiversificationMetrics));
router.get('/volatility', asyncHandler(RiskAnalyticsController.getVolatilityIndicators));

module.exports = router;
