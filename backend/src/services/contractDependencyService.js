/**
 * Smart Contract Dependency Mapping Service
 * Issue #124: Visualize contract dependencies, show integration flow, detect conflicts
 *
 * Maintains a static dependency graph for all Oryn Finance Soroban contracts
 * and provides utilities to traverse, visualize, and validate the graph.
 */

const contractConfig = require('../config/contracts');
const logger = require('../config/logger');

/**
 * Dependency graph definition.
 * Each entry lists which contracts a given contract CALLS / DEPENDS ON.
 *
 * Format:
 *   CONTRACT_NAME: {
 *     dependsOn: ['OTHER_CONTRACT', ...],
 *     description: 'What this contract does',
 *     category: 'core' | 'governance' | 'risk' | 'advanced',
 *     integrationNotes: 'How it integrates',
 *   }
 */
const DEPENDENCY_GRAPH = {
  MARKET_FACTORY: {
    dependsOn: ['ACCESS_CONTROL', 'PREDICTION_TOKEN'],
    description: 'Creates and manages prediction market instances',
    category: 'core',
    integrationNotes: 'Entry point for market creation; delegates access checks to ACCESS_CONTROL and mints tokens via PREDICTION_TOKEN',
  },
  PREDICTION_MARKET_TEMPLATE: {
    dependsOn: ['AMM_POOL', 'ORACLE_RESOLVER', 'PREDICTION_TOKEN', 'INSURANCE', 'REPUTATION'],
    description: 'Core market logic: buying, selling, claiming, and resolution',
    category: 'core',
    integrationNotes: 'Deployed per-market by MARKET_FACTORY; uses AMM_POOL for pricing, ORACLE_RESOLVER for resolution, INSURANCE for risk coverage',
  },
  AMM_POOL: {
    dependsOn: ['PREDICTION_TOKEN'],
    description: 'Automated market maker providing liquidity and price discovery',
    category: 'core',
    integrationNotes: 'Holds YES/NO token reserves; called by PREDICTION_MARKET_TEMPLATE for swaps',
  },
  ORACLE_RESOLVER: {
    dependsOn: ['ACCESS_CONTROL', 'REPUTATION'],
    description: 'Aggregates external data sources to resolve market outcomes',
    category: 'core',
    integrationNotes: 'Requires oracle operator role from ACCESS_CONTROL; updates REPUTATION on resolution',
  },
  ACCESS_CONTROL: {
    dependsOn: [],
    description: 'Role-based access control for all privileged operations',
    category: 'core',
    integrationNotes: 'Foundation contract with no dependencies; all other contracts call it for permission checks',
  },
  GOVERNANCE: {
    dependsOn: ['ACCESS_CONTROL', 'PREDICTION_TOKEN', 'REPUTATION'],
    description: 'On-chain governance: proposals, voting, and execution',
    category: 'governance',
    integrationNotes: 'Uses PREDICTION_TOKEN for vote weight; REPUTATION for voter credibility; ACCESS_CONTROL for admin actions',
  },
  REPUTATION: {
    dependsOn: ['ACCESS_CONTROL'],
    description: 'Tracks and updates user reputation scores',
    category: 'governance',
    integrationNotes: 'Updated by ORACLE_RESOLVER and PREDICTION_MARKET_TEMPLATE; read by GOVERNANCE for vote weighting',
  },
  PREDICTION_TOKEN: {
    dependsOn: ['ACCESS_CONTROL'],
    description: 'Fungible token contract for YES/NO market tokens and platform token',
    category: 'core',
    integrationNotes: 'Minted/burned by MARKET_FACTORY and AMM_POOL; requires minter role from ACCESS_CONTROL',
  },
  INSURANCE: {
    dependsOn: ['ACCESS_CONTROL', 'PREDICTION_TOKEN'],
    description: 'Insurance pool providing risk protection for market participants',
    category: 'risk',
    integrationNotes: 'Called by PREDICTION_MARKET_TEMPLATE to assess and pay out claims',
  },
  ZK_VERIFIER: {
    dependsOn: ['ACCESS_CONTROL'],
    description: 'Zero-knowledge proof verification for private predictions',
    category: 'advanced',
    integrationNotes: 'Used by X402_INTEGRATION for private order verification',
  },
  X402_INTEGRATION: {
    dependsOn: ['ZK_VERIFIER', 'PREDICTION_MARKET_TEMPLATE', 'ACCESS_CONTROL'],
    description: 'Cross-chain protocol integration for private and batched orders',
    category: 'advanced',
    integrationNotes: 'Wraps PREDICTION_MARKET_TEMPLATE with ZK privacy layer; requires ZK_VERIFIER for proof validation',
  },
  TREASURY: {
    dependsOn: ['ACCESS_CONTROL', 'PREDICTION_TOKEN'],
    description: 'Platform treasury for fee collection and fund allocation',
    category: 'governance',
    integrationNotes: 'Receives fees from PREDICTION_MARKET_TEMPLATE; controlled by GOVERNANCE proposals',
  },
};

class ContractDependencyService {
  constructor() {
    this.graph = DEPENDENCY_GRAPH;
    this.network = contractConfig.CURRENT_NETWORK || 'testnet';
  }

  /**
   * Get the full dependency graph with contract addresses attached.
   */
  getFullGraph() {
    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;
    const nodes = [];
    const edges = [];

    for (const [name, meta] of Object.entries(this.graph)) {
      nodes.push({
        id: name,
        label: name,
        description: meta.description,
        category: meta.category,
        address: deployedContracts[name] || null,
        isDeployed: Boolean(deployedContracts[name]),
        integrationNotes: meta.integrationNotes,
        dependencyCount: meta.dependsOn.length,
      });

      for (const dep of meta.dependsOn) {
        edges.push({
          from: name,
          to: dep,
          type: 'depends_on',
        });
      }
    }

    return {
      network: this.network,
      nodes,
      edges,
      totalContracts: nodes.length,
      totalDependencies: edges.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get direct dependencies of a contract (what it calls).
   * @param {string} contractName
   */
  getDependencies(contractName) {
    const key = contractName.toUpperCase();
    const meta = this.graph[key];
    if (!meta) return null;

    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;

    return {
      contractName: key,
      description: meta.description,
      category: meta.category,
      address: deployedContracts[key] || null,
      dependsOn: meta.dependsOn.map((dep) => ({
        contractName: dep,
        address: deployedContracts[dep] || null,
        isDeployed: Boolean(deployedContracts[dep]),
        description: this.graph[dep]?.description || 'Unknown',
      })),
      integrationNotes: meta.integrationNotes,
    };
  }

  /**
   * Get reverse dependencies — which contracts depend ON a given contract.
   * @param {string} contractName
   */
  getDependents(contractName) {
    const key = contractName.toUpperCase();
    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;

    const dependents = [];
    for (const [name, meta] of Object.entries(this.graph)) {
      if (meta.dependsOn.includes(key)) {
        dependents.push({
          contractName: name,
          address: deployedContracts[name] || null,
          isDeployed: Boolean(deployedContracts[name]),
          description: meta.description,
        });
      }
    }

    return {
      contractName: key,
      address: deployedContracts[key] || null,
      dependents,
      dependentCount: dependents.length,
    };
  }

  /**
   * Get the integration flow — ordered list of contracts from root to leaves.
   * Uses topological sort (Kahn's algorithm).
   */
  getIntegrationFlow() {
    const inDegree = {};
    const adjacency = {};

    // Initialize
    for (const name of Object.keys(this.graph)) {
      inDegree[name] = 0;
      adjacency[name] = [];
    }

    // Build adjacency (dependency direction: A depends on B → edge A→B)
    for (const [name, meta] of Object.entries(this.graph)) {
      for (const dep of meta.dependsOn) {
        if (this.graph[dep]) {
          inDegree[name] = (inDegree[name] || 0) + 1;
          adjacency[dep].push(name);
        }
      }
    }

    // Kahn's topological sort
    const queue = Object.keys(inDegree).filter((n) => inDegree[n] === 0);
    const sorted = [];

    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);
      for (const dependent of adjacency[node]) {
        inDegree[dependent] -= 1;
        if (inDegree[dependent] === 0) {
          queue.push(dependent);
        }
      }
    }

    const hasCycle = sorted.length !== Object.keys(this.graph).length;
    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;

    return {
      flow: sorted.map((name, index) => ({
        order: index + 1,
        contractName: name,
        category: this.graph[name]?.category || 'unknown',
        description: this.graph[name]?.description || '',
        address: deployedContracts[name] || null,
        isDeployed: Boolean(deployedContracts[name]),
      })),
      hasCycle,
      cycleWarning: hasCycle ? 'Circular dependency detected in contract graph' : null,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Detect dependency conflicts:
   * - Circular dependencies
   * - Missing (undeployed) dependencies
   * - Contracts depending on themselves
   */
  detectConflicts() {
    const conflicts = [];
    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;

    for (const [name, meta] of Object.entries(this.graph)) {
      // Self-dependency
      if (meta.dependsOn.includes(name)) {
        conflicts.push({
          type: 'SELF_DEPENDENCY',
          severity: 'critical',
          contract: name,
          message: `${name} depends on itself`,
        });
      }

      // Missing dependencies (not in graph or not deployed)
      for (const dep of meta.dependsOn) {
        if (!this.graph[dep]) {
          conflicts.push({
            type: 'UNKNOWN_DEPENDENCY',
            severity: 'warning',
            contract: name,
            dependency: dep,
            message: `${name} depends on unknown contract ${dep}`,
          });
        } else if (!deployedContracts[dep]) {
          conflicts.push({
            type: 'UNDEPLOYED_DEPENDENCY',
            severity: 'warning',
            contract: name,
            dependency: dep,
            message: `${name} depends on ${dep} which is not yet deployed`,
          });
        }
      }
    }

    // Circular dependency detection via DFS
    const visited = new Set();
    const stack = new Set();

    const dfs = (node, path) => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        conflicts.push({
          type: 'CIRCULAR_DEPENDENCY',
          severity: 'critical',
          cycle,
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
        });
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      for (const dep of (this.graph[node]?.dependsOn || [])) {
        dfs(dep, [...path, node]);
      }

      stack.delete(node);
    };

    for (const name of Object.keys(this.graph)) {
      dfs(name, []);
    }

    const critical = conflicts.filter((c) => c.severity === 'critical');
    const warnings = conflicts.filter((c) => c.severity === 'warning');

    return {
      hasConflicts: conflicts.length > 0,
      criticalCount: critical.length,
      warningCount: warnings.length,
      conflicts,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get contracts grouped by category.
   */
  getByCategory() {
    const categories = {};
    const deployedContracts = contractConfig.DEPLOYED_CONTRACTS;

    for (const [name, meta] of Object.entries(this.graph)) {
      const cat = meta.category || 'other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        contractName: name,
        description: meta.description,
        address: deployedContracts[name] || null,
        isDeployed: Boolean(deployedContracts[name]),
        dependsOn: meta.dependsOn,
      });
    }

    return {
      categories,
      categoryCount: Object.keys(categories).length,
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = new ContractDependencyService();
