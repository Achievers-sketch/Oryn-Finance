/**
 * Explorer Deep-Linking Routes
 * Issue #83: Add Explorer Deep-Linking for Smart Contracts
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const explorerController = require('../controllers/explorerController');

// GET /api/explorer/bases - Get explorer base URLs for current network
router.get('/bases', asyncHandler(explorerController.getExplorerBases));

// GET /api/explorer/contracts - Get deep-links for all deployed contracts
router.get('/contracts', asyncHandler(explorerController.getAllContractLinks));

// GET /api/explorer/contracts/:contractName - Get deep-link for a specific contract
router.get('/contracts/:contractName', asyncHandler(explorerController.getContractLink));

// GET /api/explorer/transactions/:txHash - Get deep-links for a transaction
router.get('/transactions/:txHash', asyncHandler(explorerController.getTransactionLinks));

// GET /api/explorer/accounts/:accountAddress - Get deep-link for an account
router.get('/accounts/:accountAddress', asyncHandler(explorerController.getAccountLink));

// GET /api/explorer/ledgers/:ledgerSequence - Get deep-link for a ledger
router.get('/ledgers/:ledgerSequence', asyncHandler(explorerController.getLedgerLink));

module.exports = router;
