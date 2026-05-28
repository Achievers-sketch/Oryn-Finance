const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const InsuranceController = require('../controllers/insuranceController');

router.post('/claims', asyncHandler(InsuranceController.submitClaim));
router.get('/claims', asyncHandler(InsuranceController.listClaims));
router.get('/claims/stats', asyncHandler(InsuranceController.getStats));
router.get('/claims/:claimId', asyncHandler(InsuranceController.getClaim));
router.put('/claims/:claimId/review', asyncHandler(InsuranceController.reviewClaim));
router.post('/claims/:claimId/payout', asyncHandler(InsuranceController.processPayout));

module.exports = router;
