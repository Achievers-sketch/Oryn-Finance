/**
 * Contract Version Management Routes
 * Issue #150: Track deployed versions, compare releases, support migration planning
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');
const contractVersionController = require('../controllers/contractVersionController');

// GET /api/contracts/versions/audit - Audit all contracts against a minimum version
router.get('/audit', asyncHandler(contractVersionController.auditVersions));

// GET /api/contracts/versions/compare - Compare two version strings
router.get('/compare', asyncHandler(contractVersionController.compareVersions));

// GET /api/contracts/versions - Get all contract versions
router.get('/', asyncHandler(contractVersionController.getAllVersions));

// GET /api/contracts/versions/:contractName - Get version for a specific contract
router.get('/:contractName', asyncHandler(contractVersionController.getVersion));

// GET /api/contracts/versions/:contractName/history - Get version history
router.get('/:contractName/history', asyncHandler(contractVersionController.getVersionHistory));

// GET /api/contracts/versions/:contractName/migration - Get migration plan
router.get('/:contractName/migration', asyncHandler(contractVersionController.getMigrationPlan));

// POST /api/contracts/versions/:contractName/upgrade - Record an upgrade (admin only)
router.post('/:contractName/upgrade', requireAdmin, asyncHandler(contractVersionController.recordUpgrade));

module.exports = router;
