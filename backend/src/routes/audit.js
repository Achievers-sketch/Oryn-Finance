const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const auditController = require('../controllers/auditController');

// All audit endpoints are admin-only — the trail contains sensitive
// security/compliance data (Issue #194).

// Aggregate statistics for the audit dashboard.
router.get('/stats', authenticateToken, requireAdmin, asyncHandler(auditController.getStats));

// Export filtered logs as JSON or CSV.
router.get('/export', authenticateToken, requireAdmin, asyncHandler(auditController.exportLogs));

// Paginated, filterable log listing (log viewer data source).
router.get('/', authenticateToken, requireAdmin, asyncHandler(auditController.getLogs));

module.exports = router;
