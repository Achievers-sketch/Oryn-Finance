/**
 * Governance Delegation Controller
 * Issue #132: Delegate/revoke voting rights, track delegated power, dashboard
 */
const logger = require('../config/logger');

// In-memory store for non-DB mode; replaced by Mongoose in DB mode
const delegations = new Map(); // key: delegator address

function normAddr(addr) {
  return (addr || '').toLowerCase();
}

class GovernanceDelegationController {
  /**
   * POST /api/governance/delegate
   * Body: { delegate: string }
   */
  static async delegate(req, res) {
    try {
      const delegator = normAddr(req.user?.walletAddress);
      const delegate = normAddr(req.body?.delegate);

      if (!delegator) return res.status(401).json({ success: false, message: 'Authentication required' });
      if (!delegate) return res.status(400).json({ success: false, message: 'delegate address required' });
      if (delegator === delegate) return res.status(400).json({ success: false, message: 'Cannot delegate to yourself' });

      delegations.set(delegator, { delegator, delegate, votingPower: 1, active: true, delegatedAt: new Date() });
      logger.info('Governance delegation set', { delegator, delegate });
      return res.json({ success: true, data: delegations.get(delegator) });
    } catch (error) {
      logger.error('delegate error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/governance/delegate
   * Revoke current delegation
   */
  static async revoke(req, res) {
    try {
      const delegator = normAddr(req.user?.walletAddress);
      if (!delegator) return res.status(401).json({ success: false, message: 'Authentication required' });

      const existing = delegations.get(delegator);
      if (!existing || !existing.active) {
        return res.status(404).json({ success: false, message: 'No active delegation found' });
      }

      existing.active = false;
      existing.revokedAt = new Date();
      delegations.set(delegator, existing);
      logger.info('Governance delegation revoked', { delegator });
      return res.json({ success: true, data: existing });
    } catch (error) {
      logger.error('revoke error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/governance/delegate
   * Get current user's delegation status
   */
  static async getMyDelegation(req, res) {
    try {
      const delegator = normAddr(req.user?.walletAddress);
      if (!delegator) return res.status(401).json({ success: false, message: 'Authentication required' });

      const delegation = delegations.get(delegator) || null;
      return res.json({ success: true, data: delegation });
    } catch (error) {
      logger.error('getMyDelegation error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/governance/delegate/dashboard
   * Returns delegation stats: who delegated to me, total power
   */
  static async getDashboard(req, res) {
    try {
      const address = normAddr(req.user?.walletAddress);
      if (!address) return res.status(401).json({ success: false, message: 'Authentication required' });

      const delegatedToMe = [...delegations.values()].filter(
        (d) => d.active && d.delegate === address
      );
      const myDelegation = delegations.get(address) || null;
      const totalDelegatedPower = delegatedToMe.reduce((sum, d) => sum + (d.votingPower || 1), 0);

      return res.json({
        success: true,
        data: {
          myDelegation: myDelegation?.active ? myDelegation : null,
          delegatedToMe,
          totalDelegatedPower,
          effectiveVotingPower: myDelegation?.active ? 0 : 1 + totalDelegatedPower,
        },
      });
    } catch (error) {
      logger.error('getDashboard error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = GovernanceDelegationController;
