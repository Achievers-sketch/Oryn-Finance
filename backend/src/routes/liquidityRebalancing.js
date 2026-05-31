const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const LiquidityRebalancingController = require('../controllers/liquidityRebalancingController');

router.get('/rebalancing', asyncHandler(LiquidityRebalancingController.getSuggestions));

module.exports = router;
