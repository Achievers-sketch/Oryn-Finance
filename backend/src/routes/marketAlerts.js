/**
 * Custom Market Alerts Routes
 * Issue #138: CRUD for user-defined market alerts
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/marketAlertsController');

router.get('/', authenticateToken, asyncHandler(ctrl.listAlerts));
router.post('/', authenticateToken, asyncHandler(ctrl.createAlert));
router.put('/:alertId', authenticateToken, asyncHandler(ctrl.updateAlert));
router.delete('/:alertId', authenticateToken, asyncHandler(ctrl.deleteAlert));

module.exports = router;
