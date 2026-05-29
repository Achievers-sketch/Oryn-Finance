/**
 * Contract Version Management Service
 * Issue #150: Track deployed versions, compare releases, support migration planning
 *
 * Maintains a version registry for all deployed Soroban contracts,
 * supports release comparison, and provides migration planning utilities.
 */

const contractConfig = require('../config/contracts');
const logger = require('../config/logger');

// Semantic version comparison helper
function semverCompare(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// Built-in version registry — in production this would be persisted to DB/Redis.
// Seeded with the current testnet deployment (January 25, 2026).
const DEFAULT_VERSION_REGISTRY = {
  MARKET_FACTORY: {
    current: '1.0.0',
    address: 'CCUENLYBXW3WTWBUD2TZLX3EWI7WFD223TW4LSBNQQ5W26B2Q2WNSM6M',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  PREDICTION_MARKET_TEMPLATE: {
    current: '1.0.0',
    address: 'CCDPJ2UFUE5WNDSCIRPXQAT2XU7JZEIJMRNKIO4ANT5MWJNKDXJ4JUQ7',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  AMM_POOL: {
    current: '1.0.0',
    address: 'CBVTPYDEAQJL377TFTF6YND4BCMMPR2NR2O22EDPQ77AG7AVCILGUTIA',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  ORACLE_RESOLVER: {
    current: '1.0.0',
    address: 'CDCL4MFB6RMCEAY32FOSQFFVDEQO3OXGCRP7YIUXCOVOAREYRQ2PMOOB',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  GOVERNANCE: {
    current: '1.0.0',
    address: 'CADJ4FBXLAZLGOASYLXDSQUV6ACB6EPVW2RBMYHUSUQUPOIM4CTFRKR5',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  REPUTATION: {
    current: '1.0.0',
    address: 'CCGZV643TWW6IGYKUHYYCJABYBNJ5DOAQJXJIQNIUAXBJSDIVADLJB37',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  PREDICTION_TOKEN: {
    current: '1.0.0',
    address: 'CCK6QOIU5U3BKRGXAX4O6FJFZVZZNTVQ6TTTJC3TAI4UYLYTSO6Z6HTZ',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  INSURANCE: {
    current: '1.0.0',
    address: 'CAC647C2R33OCEHXUE3KWCBA4QTG5YYHCXJNLLG7JZ7NVQDSXOFZ25VS',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  ZK_VERIFIER: {
    current: '1.0.0',
    address: 'CD32VRK27G26QZNLT2AW35X7IVFPU76GAEOH5XLUH7XRROVH26GRSIOW',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
  X402_INTEGRATION: {
    current: '1.0.0',
    address: 'CBKSOAE52ONGDTGGB6CAZAGYEKMJ54WFIDW3U6PBL4FUP75G2H3LWVHS',
    deployedAt: '2026-01-25T00:00:00.000Z',
    network: 'testnet',
    changelog: 'Initial deployment',
    history: [],
  },
};

class ContractVersionService {
  constructor() {
    // Deep-clone so mutations don't affect the default
    this.registry = JSON.parse(JSON.stringify(DEFAULT_VERSION_REGISTRY));
    this.network = contractConfig.CURRENT_NETWORK || 'testnet';
  }

  /**
   * Get the current version record for a contract.
   * @param {string} contractName
   */
  getVersion(contractName) {
    const key = contractName.toUpperCase();
    const record = this.registry[key];
    if (!record) {
      return null;
    }
    return {
      contractName: key,
      version: record.current,
      address: record.address,
      deployedAt: record.deployedAt,
      network: record.network || this.network,
      changelog: record.changelog,
      historyCount: record.history.length,
    };
  }

  /**
   * Get version records for all contracts.
   */
  getAllVersions() {
    return Object.keys(this.registry).map((name) => this.getVersion(name));
  }

  /**
   * Record a new deployment / upgrade for a contract.
   * Pushes the old version into history and sets the new one.
   *
   * @param {string} contractName
   * @param {string} newVersion - semver string e.g. '1.1.0'
   * @param {string} newAddress - new contract address after upgrade
   * @param {string} changelog  - human-readable change description
   */
  recordUpgrade(contractName, newVersion, newAddress, changelog = '') {
    const key = contractName.toUpperCase();

    if (!this.registry[key]) {
      // First-time registration
      this.registry[key] = {
        current: newVersion,
        address: newAddress,
        deployedAt: new Date().toISOString(),
        network: this.network,
        changelog,
        history: [],
      };
      logger.info('Contract version registered', { contractName: key, version: newVersion });
      return this.getVersion(key);
    }

    const old = this.registry[key];

    // Push current into history
    old.history.push({
      version: old.current,
      address: old.address,
      deployedAt: old.deployedAt,
      changelog: old.changelog,
      replacedAt: new Date().toISOString(),
    });

    // Update current
    old.current = newVersion;
    old.address = newAddress;
    old.deployedAt = new Date().toISOString();
    old.changelog = changelog;
    old.network = this.network;

    logger.info('Contract version upgraded', {
      contractName: key,
      newVersion,
      previousVersion: old.history[old.history.length - 1].version,
    });

    return this.getVersion(key);
  }

  /**
   * Compare two version strings for a contract.
   * Returns -1 (a < b), 0 (equal), or 1 (a > b).
   *
   * @param {string} versionA
   * @param {string} versionB
   */
  compareVersions(versionA, versionB) {
    return semverCompare(versionA, versionB);
  }

  /**
   * Get the full version history for a contract.
   * @param {string} contractName
   */
  getVersionHistory(contractName) {
    const key = contractName.toUpperCase();
    const record = this.registry[key];
    if (!record) return null;

    return {
      contractName: key,
      current: {
        version: record.current,
        address: record.address,
        deployedAt: record.deployedAt,
        changelog: record.changelog,
      },
      history: record.history,
    };
  }

  /**
   * Generate a migration plan between two versions of a contract.
   * Identifies what changed and what steps are needed.
   *
   * @param {string} contractName
   * @param {string} fromVersion
   * @param {string} toVersion
   */
  generateMigrationPlan(contractName, fromVersion, toVersion) {
    const key = contractName.toUpperCase();
    const record = this.registry[key];

    if (!record) {
      return { error: `Contract ${key} not found in version registry` };
    }

    const comparison = semverCompare(fromVersion, toVersion);
    const direction = comparison < 0 ? 'upgrade' : comparison > 0 ? 'downgrade' : 'none';

    // Collect all versions between from and to
    const allVersions = [
      ...record.history.map((h) => ({ version: h.version, address: h.address, changelog: h.changelog })),
      { version: record.current, address: record.address, changelog: record.changelog },
    ].sort((a, b) => semverCompare(a.version, b.version));

    const relevantSteps = allVersions.filter((v) => {
      const afterFrom = semverCompare(v.version, fromVersion) > 0;
      const upToTo = semverCompare(v.version, toVersion) <= 0;
      return direction === 'upgrade' ? afterFrom && upToTo : !afterFrom && !upToTo;
    });

    return {
      contractName: key,
      fromVersion,
      toVersion,
      direction,
      stepsRequired: relevantSteps.length,
      steps: relevantSteps.map((v, i) => ({
        step: i + 1,
        version: v.version,
        newAddress: v.address,
        changelog: v.changelog,
        action: direction === 'upgrade' ? 'deploy_and_migrate' : 'rollback',
      })),
      warnings:
        direction === 'downgrade'
          ? ['Downgrade may cause data incompatibility. Verify state migration before proceeding.']
          : [],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if any contracts are behind a given minimum version.
   * Useful for detecting stale deployments.
   *
   * @param {string} minimumVersion - e.g. '1.0.0'
   */
  auditVersions(minimumVersion = '1.0.0') {
    const results = [];

    for (const [name, record] of Object.entries(this.registry)) {
      const isUpToDate = semverCompare(record.current, minimumVersion) >= 0;
      results.push({
        contractName: name,
        currentVersion: record.current,
        minimumVersion,
        isUpToDate,
        address: record.address,
        deployedAt: record.deployedAt,
      });
    }

    const outdated = results.filter((r) => !r.isUpToDate);

    return {
      minimumVersion,
      totalContracts: results.length,
      upToDate: results.length - outdated.length,
      outdated: outdated.length,
      contracts: results,
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Get a summary of the version registry (for dashboards).
   */
  getSummary() {
    const all = this.getAllVersions();
    return {
      network: this.network,
      totalContracts: all.length,
      contracts: all,
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = new ContractVersionService();
