const logger = require('../config/logger');

// In-memory timelock store (#165)
// Seeded with representative data; real production would index on-chain events
const now = Date.now();
const timelockActions = [
  {
    id: 'tl-001',
    title: 'Upgrade Market Resolution Contract',
    description: 'Deploy v2.1.0 of the market resolution contract with improved oracle aggregation.',
    proposalId: 'prop-001',
    status: 'pending',
    queuedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    executeAfter: new Date(now + 22 * 60 * 60 * 1000).toISOString(),
    executedAt: null,
    timelockDuration: 48 * 60 * 60 * 1000,
    executor: null,
    target: 'MarketResolutionContract',
    value: '0',
  },
  {
    id: 'tl-002',
    title: 'Update Fee Parameters',
    description: 'Reduce trading fee from 0.5% to 0.3% for active markets.',
    proposalId: 'prop-002',
    status: 'pending',
    queuedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    executeAfter: new Date(now + 47 * 60 * 60 * 1000).toISOString(),
    executedAt: null,
    timelockDuration: 48 * 60 * 60 * 1000,
    executor: null,
    target: 'FeeController',
    value: '0',
  },
  {
    id: 'tl-003',
    title: 'Add New Oracle Provider',
    description: 'Integrate Pyth Network as an additional oracle data source.',
    proposalId: 'prop-003',
    status: 'executed',
    queuedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    executeAfter: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
    executedAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    timelockDuration: 48 * 60 * 60 * 1000,
    executor: 'GXXXXEXECUTORADDRESS1',
    target: 'OracleRegistry',
    value: '0',
  },
  {
    id: 'tl-004',
    title: 'Treasury Allocation Update',
    description: 'Reallocate 15% of reserves to liquidity incentives program.',
    proposalId: 'prop-004',
    status: 'executed',
    queuedAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
    executeAfter: new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString(),
    executedAt: new Date(now - 17 * 24 * 60 * 60 * 1000).toISOString(),
    timelockDuration: 48 * 60 * 60 * 1000,
    executor: 'GXXXXEXECUTORADDRESS2',
    target: 'TreasuryManager',
    value: '15000',
  },
  {
    id: 'tl-005',
    title: 'Pause Derivatives Module',
    description: 'Emergency pause of the derivatives module pending security audit.',
    proposalId: 'prop-005',
    status: 'cancelled',
    queuedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    executeAfter: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    executedAt: null,
    timelockDuration: 48 * 60 * 60 * 1000,
    executor: null,
    target: 'DerivativesModule',
    value: '0',
  },
];

class GovernanceTimelockController {
  // GET /api/governance/timelock
  static async getTimelockActions(req, res) {
    const { status } = req.query;
    const nowMs = Date.now();

    let actions = timelockActions.map(a => {
      const msUntilExecution = new Date(a.executeAfter).getTime() - nowMs;
      return {
        ...a,
        msUntilExecution: Math.max(0, msUntilExecution),
        canExecute: a.status === 'pending' && msUntilExecution <= 0,
      };
    });

    if (status) {
      actions = actions.filter(a => a.status === status);
    }

    actions.sort((a, b) => new Date(a.executeAfter) - new Date(b.executeAfter));

    const summary = {
      total: timelockActions.length,
      pending: timelockActions.filter(a => a.status === 'pending').length,
      executed: timelockActions.filter(a => a.status === 'executed').length,
      cancelled: timelockActions.filter(a => a.status === 'cancelled').length,
      readyToExecute: actions.filter(a => a.canExecute).length,
    };

    logger.info('Governance timelock actions retrieved', summary);

    return res.json({ success: true, data: { summary, actions } });
  }

  // GET /api/governance/timelock/:id
  static async getTimelockAction(req, res) {
    const action = timelockActions.find(a => a.id === req.params.id);
    if (!action) {
      return res.status(404).json({ success: false, message: 'Timelock action not found' });
    }
    const msUntilExecution = Math.max(0, new Date(action.executeAfter).getTime() - Date.now());
    return res.json({ success: true, data: { ...action, msUntilExecution, canExecute: action.status === 'pending' && msUntilExecution === 0 } });
  }
}

module.exports = GovernanceTimelockController;
