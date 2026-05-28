const logger = require('../config/logger');

// In-memory store — replace with a DB model for persistence
const TX_STORE = {};
let recoveryCount = {};

const VALID_STATUSES = ['pending', 'confirming', 'executed', 'failed', 'reverted'];

class CrossChainController {
  // POST /api/cross-chain/track — register or update a transaction
  static async trackTransaction(req, res) {
    const { txId, status, bridgeChain, amount, walletAddress } = req.body;

    if (!txId) {
      return res.status(400).json({ success: false, message: 'txId is required' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    TX_STORE[txId] = {
      txId,
      status: status || 'pending',
      bridgeChain: bridgeChain || 'stellar',
      amount: amount || 0,
      walletAddress: walletAddress || '',
      recoveryAttempts: recoveryCount[txId] || 0,
      createdAt: TX_STORE[txId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logger.info(`Cross-chain tx tracked: ${txId} → ${TX_STORE[txId].status}`);
    return res.json({ success: true, data: TX_STORE[txId] });
  }

  // GET /api/cross-chain/tx/:txId
  static async getTransaction(req, res) {
    const tx = TX_STORE[req.params.txId];
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: tx });
  }

  // GET /api/cross-chain/list
  static async listTransactions(req, res) {
    const { walletAddress, status } = req.query;
    let txs = Object.values(TX_STORE);
    if (walletAddress) txs = txs.filter(t => t.walletAddress === walletAddress);
    if (status) txs = txs.filter(t => t.status === status);
    txs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return res.json({ success: true, data: txs, count: txs.length });
  }

  // GET /api/cross-chain/failures
  static async detectFailures(req, res) {
    const failed = Object.values(TX_STORE).filter(t => t.status === 'failed' || t.status === 'reverted');
    return res.json({ success: true, data: failed, count: failed.length });
  }

  // POST /api/cross-chain/tx/:txId/recover — attempt recovery of a failed tx
  static async recoverTransaction(req, res) {
    const { txId } = req.params;
    const tx = TX_STORE[txId];

    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (tx.status !== 'failed' && tx.status !== 'reverted') {
      return res.status(400).json({ success: false, message: 'Only failed or reverted transactions can be recovered' });
    }

    recoveryCount[txId] = (recoveryCount[txId] || 0) + 1;
    TX_STORE[txId] = {
      ...tx,
      status: 'pending',
      recoveryAttempts: recoveryCount[txId],
      updatedAt: new Date().toISOString(),
    };

    logger.info(`Recovery attempt #${recoveryCount[txId]} for tx ${txId}`);
    return res.json({ success: true, data: TX_STORE[txId], message: `Recovery attempt #${recoveryCount[txId]} initiated` });
  }

  // GET /api/cross-chain/stats
  static async getStats(req, res) {
    const txs = Object.values(TX_STORE);
    const stats = VALID_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    txs.forEach(t => { if (stats[t.status] !== undefined) stats[t.status]++; });
    return res.json({ success: true, data: { total: txs.length, byStatus: stats } });
  }
}

module.exports = CrossChainController;
