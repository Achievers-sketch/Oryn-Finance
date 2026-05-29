/**
 * Explorer Deep-Linking Controller
 * Issue #83: Expose explorer links via REST API
 */

const explorerLinksService = require('../services/explorerLinks');
const logger = require('../config/logger');

class ExplorerController {
  /**
   * GET /api/explorer/contracts
   * Returns deep-links for all deployed contracts.
   */
  static async getAllContractLinks(req, res) {
    try {
      const links = explorerLinksService.getAllContractLinks();

      logger.info('Explorer contract links requested', {
        network: explorerLinksService.network,
        contractCount: Object.keys(links).length,
      });

      return res.json({
        success: true,
        data: {
          network: explorerLinksService.network,
          explorerBases: explorerLinksService.getExplorerBases(),
          contracts: links,
        },
      });
    } catch (error) {
      logger.error('Failed to get contract explorer links:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve contract explorer links',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/explorer/contracts/:contractName
   * Returns the deep-link for a specific contract by name.
   */
  static async getContractLink(req, res) {
    try {
      const { contractName } = req.params;
      const link = explorerLinksService.getContractLinkByName(contractName);

      return res.json({
        success: true,
        data: link,
      });
    } catch (error) {
      logger.error(`Failed to get explorer link for contract ${req.params.contractName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve contract explorer link',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/explorer/transactions/:txHash
   * Returns deep-links for a transaction hash (Stellar Expert + Horizon API).
   */
  static async getTransactionLinks(req, res) {
    try {
      const { txHash } = req.params;

      if (!txHash || txHash.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Valid transaction hash is required',
        });
      }

      const expertLink = explorerLinksService.buildTransactionLink(txHash);
      const horizonLink = explorerLinksService.buildHorizonTransactionLink(txHash);

      return res.json({
        success: true,
        data: {
          txHash,
          network: explorerLinksService.network,
          links: {
            stellarExpert: expertLink,
            horizonApi: horizonLink,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get transaction explorer links:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve transaction explorer links',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/explorer/accounts/:accountAddress
   * Returns a deep-link for a Stellar account address.
   */
  static async getAccountLink(req, res) {
    try {
      const { accountAddress } = req.params;

      if (!accountAddress) {
        return res.status(400).json({
          success: false,
          message: 'Account address is required',
        });
      }

      const link = explorerLinksService.buildAccountLink(accountAddress);

      return res.json({
        success: true,
        data: {
          accountAddress,
          network: explorerLinksService.network,
          ...link,
        },
      });
    } catch (error) {
      logger.error('Failed to get account explorer link:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve account explorer link',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/explorer/ledgers/:ledgerSequence
   * Returns a deep-link for a specific ledger.
   */
  static async getLedgerLink(req, res) {
    try {
      const ledgerSequence = parseInt(req.params.ledgerSequence, 10);

      if (!ledgerSequence || isNaN(ledgerSequence) || ledgerSequence <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid ledger sequence number is required',
        });
      }

      const link = explorerLinksService.buildLedgerLink(ledgerSequence);

      return res.json({
        success: true,
        data: {
          ledgerSequence,
          network: explorerLinksService.network,
          ...link,
        },
      });
    } catch (error) {
      logger.error('Failed to get ledger explorer link:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve ledger explorer link',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/explorer/bases
   * Returns the explorer base URLs for the current network.
   */
  static async getExplorerBases(req, res) {
    try {
      const bases = explorerLinksService.getExplorerBases();
      return res.json({
        success: true,
        data: bases,
      });
    } catch (error) {
      logger.error('Failed to get explorer bases:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve explorer base URLs',
        error: error.message,
      });
    }
  }
}

module.exports = ExplorerController;
