const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const treasuryController = require('../controllers/treasuryController');

// Public routes
router.get('/overview', asyncHandler(treasuryController.getTreasuryOverview));
router.get('/summary', asyncHandler(treasuryController.getTreasurySummary));
router.get('/inflows', asyncHandler(treasuryController.getFeeInflows));
router.get('/outflows', asyncHandler(treasuryController.getOutflows));
router.get('/governance-actions', asyncHandler(treasuryController.getGovernanceActions));

// Protected routes (admin/governance)
router.post('/inflows', authenticateToken, requireAdmin, asyncHandler(treasuryController.recordFeeInflow));
router.post('/distributions', authenticateToken, requireAdmin, asyncHandler(treasuryController.recordDistribution));
router.post('/governance-actions', authenticateToken, asyncHandler(treasuryController.recordGovernanceAction));

module.exports = router;
