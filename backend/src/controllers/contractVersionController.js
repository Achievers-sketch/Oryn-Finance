/**
 * Contract Version Management Controller
 * Issue #150: Track deployed versions, compare releases, support migration planning
 */

const contractVersionService = require('../services/contractVersionService');
const logger = require('../config/logger');

class ContractVersionController {
  /**
   * GET /api/contracts/versions
   * Returns version info for all deployed contracts.
   */
  static async getAllVersions(req, res) {
    try {
      const summary = contractVersionService.getSummary();
      return res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Failed to get contract versions:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/versions/:contractName
   * Returns version info for a specific contract.
   */
  static async getVersion(req, res) {
    try {
      const { contractName } = req.params;
      const version = contractVersionService.getVersion(contractName);

      if (!version) {
        return res.status(404).json({
          success: false,
          message: `Contract '${contractName}' not found in version registry`,
        });
      }

      return res.json({ success: true, data: version });
    } catch (error) {
      logger.error('Failed to get contract version:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/versions/:contractName/history
   * Returns the full version history for a contract.
   */
  static async getVersionHistory(req, res) {
    try {
      const { contractName } = req.params;
      const history = contractVersionService.getVersionHistory(contractName);

      if (!history) {
        return res.status(404).json({
          success: false,
          message: `Contract '${contractName}' not found in version registry`,
        });
      }

      return res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Failed to get contract version history:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/contracts/versions/:contractName/upgrade
   * Record a new deployment/upgrade for a contract (admin only).
   * Body: { version, address, changelog }
   */
  static async recordUpgrade(req, res) {
    try {
      const { contractName } = req.params;
      const { version, address, changelog } = req.body;

      if (!version || !address) {
        return res.status(400).json({
          success: false,
          message: 'version and address are required',
        });
      }

      const updated = contractVersionService.recordUpgrade(contractName, version, address, changelog || '');

      logger.info('Contract upgrade recorded', {
        contractName,
        version,
        address,
        recordedBy: req.user?.walletAddress || 'system',
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to record contract upgrade:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/versions/:contractName/migration
   * Generate a migration plan between two versions.
   * Query: ?from=1.0.0&to=1.2.0
   */
  static async getMigrationPlan(req, res) {
    try {
      const { contractName } = req.params;
      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({
          success: false,
          message: 'Query params "from" and "to" version strings are required',
        });
      }

      const plan = contractVersionService.generateMigrationPlan(contractName, from, to);

      if (plan.error) {
        return res.status(404).json({ success: false, message: plan.error });
      }

      return res.json({ success: true, data: plan });
    } catch (error) {
      logger.error('Failed to generate migration plan:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/versions/audit
   * Audit all contracts against a minimum version.
   * Query: ?minimum=1.0.0
   */
  static async auditVersions(req, res) {
    try {
      const { minimum = '1.0.0' } = req.query;
      const audit = contractVersionService.auditVersions(minimum);
      return res.json({ success: true, data: audit });
    } catch (error) {
      logger.error('Failed to audit contract versions:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/versions/compare
   * Compare two version strings.
   * Query: ?a=1.0.0&b=1.1.0
   */
  static async compareVersions(req, res) {
    try {
      const { a, b } = req.query;

      if (!a || !b) {
        return res.status(400).json({
          success: false,
          message: 'Query params "a" and "b" version strings are required',
        });
      }

      const result = contractVersionService.compareVersions(a, b);
      const relation = result < 0 ? 'older' : result > 0 ? 'newer' : 'equal';

      return res.json({
        success: true,
        data: {
          versionA: a,
          versionB: b,
          comparison: result,
          relation: `${a} is ${relation} than ${b}`,
        },
      });
    } catch (error) {
      logger.error('Failed to compare versions:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ContractVersionController;
