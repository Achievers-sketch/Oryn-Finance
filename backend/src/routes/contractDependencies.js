/**
 * Smart Contract Dependency Mapping Routes
 * Issue #124: Visualize contract dependencies, show integration flow, detect conflicts
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const contractDependencyController = require('../controllers/contractDependencyController');

// GET /api/contracts/dependencies/flow - Integration flow in topological order
router.get('/flow', asyncHandler(contractDependencyController.getIntegrationFlow));

// GET /api/contracts/dependencies/conflicts - Detect dependency conflicts
router.get('/conflicts', asyncHandler(contractDependencyController.detectConflicts));

// GET /api/contracts/dependencies/categories - Contracts grouped by category
router.get('/categories', asyncHandler(contractDependencyController.getByCategory));

// GET /api/contracts/dependencies - Full dependency graph
router.get('/', asyncHandler(contractDependencyController.getFullGraph));

// GET /api/contracts/dependencies/:contractName - Dependencies of a specific contract
router.get('/:contractName', asyncHandler(contractDependencyController.getDependencies));

// GET /api/contracts/dependencies/:contractName/dependents - Reverse dependencies
router.get('/:contractName/dependents', asyncHandler(contractDependencyController.getDependents));

module.exports = router;
