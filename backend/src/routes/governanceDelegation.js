/**
 * Governance Delegation Routes
 * Issue #132: Delegate/revoke voting rights, dashboard
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/governanceDelegationController');

router.get('/dashboard', authenticateToken, asyncHandler(ctrl.getDashboard));
router.get('/', authenticateToken, asyncHandler(ctrl.getMyDelegation));
router.post('/', authenticateToken, asyncHandler(ctrl.delegate));
router.delete('/', authenticateToken, asyncHandler(ctrl.revoke));

module.exports = router;
