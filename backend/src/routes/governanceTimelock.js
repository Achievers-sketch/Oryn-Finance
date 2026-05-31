const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const GovernanceTimelockController = require('../controllers/governanceTimelockController');

router.get('/', asyncHandler(GovernanceTimelockController.getTimelockActions));
router.get('/:id', asyncHandler(GovernanceTimelockController.getTimelockAction));

module.exports = router;
