const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const SentimentController = require('../controllers/sentimentController');

router.get('/aggregated', asyncHandler(SentimentController.getAggregatedSentiment));
router.get('/history', asyncHandler(SentimentController.getSentimentHistory));
router.get('/market/:marketId', asyncHandler(SentimentController.getMarketSentiment));

module.exports = router;
