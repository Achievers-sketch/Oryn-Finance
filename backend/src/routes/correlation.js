/**
 * Cross-Market Correlation Routes
 * Issue #135: Correlation heatmap and related markets
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/correlationController');

router.get('/heatmap', asyncHandler(ctrl.getHeatmap));
router.get('/related/:marketId', asyncHandler(ctrl.getRelated));

module.exports = router;
