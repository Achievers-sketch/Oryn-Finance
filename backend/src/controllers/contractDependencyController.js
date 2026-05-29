/**
 * Smart Contract Dependency Mapping Controller
 * Issue #124: Visualize contract dependencies, show integration flow, detect conflicts
 */

const contractDependencyService = require('../services/contractDependencyService');
const logger = require('../config/logger');

class ContractDependencyController {
  /**
   * GET /api/contracts/dependencies
   * Returns the full dependency graph (nodes + edges).
   */
  static async getFullGraph(req, res) {
    try {
      const graph = contractDependencyService.getFullGraph();
      return res.json({ success: true, data: graph });
    } catch (error) {
      logger.error('Failed to get contract dependency graph:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/dependencies/flow
   * Returns the integration flow in topological order.
   */
  static async getIntegrationFlow(req, res) {
    try {
      const flow = contractDependencyService.getIntegrationFlow();
      return res.json({ success: true, data: flow });
    } catch (error) {
      logger.error('Failed to get integration flow:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/dependencies/conflicts
   * Detect dependency conflicts (circular deps, missing deps).
   */
  static async detectConflicts(req, res) {
    try {
      const result = contractDependencyService.detectConflicts();
      const statusCode = result.criticalCount > 0 ? 200 : 200; // always 200, flag in body
      return res.status(statusCode).json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to detect dependency conflicts:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/dependencies/categories
   * Returns contracts grouped by category.
   */
  static async getByCategory(req, res) {
    try {
      const result = contractDependencyService.getByCategory();
      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to get contracts by category:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/dependencies/:contractName
   * Returns direct dependencies of a specific contract.
   */
  static async getDependencies(req, res) {
    try {
      const { contractName } = req.params;
      const result = contractDependencyService.getDependencies(contractName);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `Contract '${contractName}' not found in dependency graph`,
        });
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to get contract dependencies:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/contracts/dependencies/:contractName/dependents
   * Returns contracts that depend ON a given contract (reverse deps).
   */
  static async getDependents(req, res) {
    try {
      const { contractName } = req.params;
      const result = contractDependencyService.getDependents(contractName);
      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to get contract dependents:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ContractDependencyController;
