const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { param, query } = require('express-validator');
const marketDepthController = require('../controllers/marketDepthController');

// Validation middleware
const validateMarketId = [
  param('marketId').notEmpty().withMessage('Market ID is required')
];

const validateTokenType = [
  query('tokenType').optional().isIn(['yes', 'no']).withMessage('Token type must be yes or no')
];

const validateZones = [
  query('zones').optional().isInt({ min: 5, max: 50 }).withMessage('Zones must be between 5 and 50')
];

// Get market depth data
router.get('/:marketId/depth',
  validateMarketId,
  validateTokenType,
  asyncHandler(marketDepthController.getMarketDepth)
);

// Get liquidity zones
router.get('/:marketId/liquidity-zones',
  validateMarketId,
  validateTokenType,
  validateZones,
  asyncHandler(marketDepthController.getLiquidityZones)
);

// Get real-time order book updates (Server-Sent Events)
router.get('/:marketId/orderbook-stream',
  validateMarketId,
  asyncHandler(marketDepthController.getOrderBookUpdates)
);

module.exports = router;