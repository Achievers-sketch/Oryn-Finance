const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const CrossChainController = require('../controllers/crossChainController');

router.post('/track', asyncHandler(CrossChainController.trackTransaction));
router.get('/list', asyncHandler(CrossChainController.listTransactions));
router.get('/failures', asyncHandler(CrossChainController.detectFailures));
router.get('/stats', asyncHandler(CrossChainController.getStats));
router.get('/tx/:txId', asyncHandler(CrossChainController.getTransaction));
router.post('/tx/:txId/recover', asyncHandler(CrossChainController.recoverTransaction));

module.exports = router;
