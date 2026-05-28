const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const liquidityPositionController = require('../controllers/liquidityPositionController');

router.get('/positions', authenticateToken, asyncHandler(liquidityPositionController.getUserPositions));
router.get('/positions/:marketId', authenticateToken, asyncHandler(liquidityPositionController.getMarketPosition));
router.get('/metrics', authenticateToken, asyncHandler(liquidityPositionController.getPortfolioMetrics));
router.post('/positions', authenticateToken, asyncHandler(liquidityPositionController.createPosition));
router.post('/positions/:positionId/fees', authenticateToken, asyncHandler(liquidityPositionController.recordFeeEarned));
router.post('/positions/:positionId/calculate-il', authenticateToken, asyncHandler(liquidityPositionController.calculateImpermanentLoss));

module.exports = router;
