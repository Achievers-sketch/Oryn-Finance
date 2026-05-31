const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const oracleHealthController = require('../controllers/oracleHealthController');
const oracleConsensusController = require('../controllers/oracleConsensusController');

// GET /api/oracle/health
router.get('/health', asyncHandler(oracleHealthController.getOracleHealth));

// GET /api/oracle/consensus (#164)
router.get('/consensus', asyncHandler(oracleConsensusController.getConsensus));

module.exports = router;
