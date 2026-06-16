const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const reportingController = require('../controllers/reportingController');

router.get('/institutional', asyncHandler(reportingController.getInstitutionalDashboard));
router.get('/market-exposure', asyncHandler(reportingController.getMarketExposureReport));
router.get('/treasury', asyncHandler(reportingController.getTreasuryReport));
router.get('/governance-activity', asyncHandler(reportingController.getGovernanceActivityReport));

module.exports = router;
