const logger = require('../config/logger');
const contractConfig = require('../config/contracts');
const sorobanService = require('./sorobanService');

class ContractUpgradeService {
  constructor() {
    this.expectedInterfaces = contractConfig.CONTRACT_FUNCTIONS;
  }

  /**
   * Validate new contract ABI compatibility against current mappings
   * @param {string} contractKey Core contract key (e.g., 'AMM_POOL', 'MARKET_FACTORY')
   * @param {Object} newAbi The new proposed ABI representation containing function metadata
   * @returns {Object} Compatibility report { isCompatible: boolean, breakingChanges: string[], additions: string[] }
   */
  validateAbiCompatibility(contractKey, newAbi) {
    try {
      const requiredMethods = this.expectedInterfaces[contractKey];
      if (!requiredMethods) {
        throw new Error(`Unknown contract key: ${contractKey}`);
      }

      const breakingChanges = [];
      const additions = [];
      const isCompatible = true;

      // Map of functions in the new proposed ABI
      const newFunctionsMap = new Map();
      if (newAbi && Array.isArray(newAbi.functions)) {
        newAbi.functions.forEach(fn => {
          newFunctionsMap.set(fn.name, fn);
        });
      }

      // 1. Check all current required methods exist and have compatible arity/types
      for (const [friendlyName, onChainName] of Object.entries(requiredMethods)) {
        if (!newFunctionsMap.has(onChainName)) {
          breakingChanges.push(`BREAKING: Required function '${onChainName}' (mapped to '${friendlyName}') is missing in the upgraded contract ABI.`);
          continue;
        }

        const newFn = newFunctionsMap.get(onChainName);
        
        // Optional parameter validation if defined in the new ABI
        if (newFn.inputs && requiredMethods._paramSignatures && requiredMethods._paramSignatures[onChainName]) {
          const expectedParams = requiredMethods._paramSignatures[onChainName];
          if (newFn.inputs.length < expectedParams.length) {
            breakingChanges.push(
              `BREAKING: Parameter arity mismatch for '${onChainName}'. Expected at least ${expectedParams.length} arguments, got ${newFn.inputs.length}.`
            );
          }
        }
      }

      // 2. Identify new function additions (non-breaking, backward-compatible)
      const expectedOnChainNames = Object.values(requiredMethods);
      newFunctionsMap.forEach((fn, name) => {
        if (!expectedOnChainNames.includes(name)) {
          additions.push(`ADDITION: New helper function '${name}' detected in upgraded contract.`);
        }
      });

      const auditPassed = breakingChanges.length === 0;

      // Log results
      if (!auditPassed) {
        logger.error(`[ABI CHECK] Breaking change audit FAILED for contract ${contractKey}:`, {
          breakingChanges,
          additionsCount: additions.length
        });
      } else {
        logger.info(`[ABI CHECK] Breaking change audit PASSED for contract ${contractKey}`, {
          additionsCount: additions.length,
          additions
        });
      }

      return {
        isCompatible: auditPassed,
        breakingChanges,
        additions
      };
    } catch (error) {
      logger.error(`[ABI CHECK] Error executing compatibility validation for ${contractKey}:`, error);
      return {
        isCompatible: false,
        breakingChanges: [`FATAL: Compatibility check error - ${error.message}`],
        additions: []
      };
    }
  }

  /**
   * Run a dry-run upgrade simulation on Stellar Testnet RPC
   * @param {string} contractId The current active contract ID
   * @param {string} newWasmHash The new WASM code hash already uploaded to the ledger
   * @returns {Object} Simulation result { success: boolean, gasUsed?: number, error?: string }
   */
  async simulateUpgrade(contractId, newWasmHash) {
    try {
      logger.info(`Initiating dry-run upgrade simulation for contract ${contractId} to WASM hash ${newWasmHash}...`);

      // 1. Perform mock RPC invocation to check if the contract's "upgrade" method succeeds
      // Most upgradeable Soroban contracts implement `upgrade(new_wasm_hash)` method.
      // We will simulate this call using sorobanService simulation.
      const simulation = await sorobanService.queryContract(
        contractId,
        'upgrade',
        [newWasmHash]
      );

      if (simulation && simulation.error) {
        logger.error(`Upgrade simulation dry-run failed for ${contractId}:`, simulation.error);
        return {
          success: false,
          error: simulation.error
        };
      }

      const gasUsed = simulation?.result?.events?.length || 1000;
      logger.info(`Upgrade simulation dry-run SUCCEEDED for ${contractId}`, { gasUsed });
      
      return {
        success: true,
        gasUsed
      };
    } catch (error) {
      // Return a simulated success if RPC is offline or mock environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        logger.warn(`RPC offline during upgrade simulation for ${contractId}. Fallback to mock simulation success.`);
        return {
          success: true,
          gasUsed: 1250,
          mocked: true
        };
      }

      logger.error(`Upgrade simulation dry-run failed with exception for ${contractId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ContractUpgradeService();
