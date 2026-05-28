const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const volatilityController = require('../controllers/volatilityController');

router.get('/markets', asyncHandler(volatilityController.getVolatileMarkets));
router.get('/market/:id', asyncHandler(volatilityController.getMarketVolatility));
router.get('/market/:id/history', asyncHandler(volatilityController.getMarketVolatilityHistory));
router.post('/market/:id/calculate', authenticateToken, asyncHandler(volatilityController.calculateVolatility));

module.exports = router;
