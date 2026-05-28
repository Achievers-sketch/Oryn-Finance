const logger = require('../config/logger');

const CLAIMS = {};
let claimSeq = 1;

const INCIDENT_TYPES = ['oracle_failure', 'market_manipulation', 'smart_contract_bug', 'liquidity_drain', 'other'];
const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'paid'];

class InsuranceController {
  // POST /api/insurance/claims
  static async submitClaim(req, res) {
    const { walletAddress, policyId, incidentType, description, requestedAmount } = req.body;

    if (!walletAddress || !policyId || !incidentType || !requestedAmount) {
      return res.status(400).json({ success: false, message: 'walletAddress, policyId, incidentType, requestedAmount are required' });
    }
    if (!INCIDENT_TYPES.includes(incidentType)) {
      return res.status(400).json({ success: false, message: `incidentType must be one of: ${INCIDENT_TYPES.join(', ')}` });
    }

    const claimId = `claim_${Date.now()}_${claimSeq++}`;
    CLAIMS[claimId] = {
      claimId,
      walletAddress: walletAddress.toLowerCase(),
      policyId,
      incidentType,
      description: description || '',
      requestedAmount: Number(requestedAmount),
      status: 'submitted',
      payoutAmount: null,
      payoutTxHash: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      paidAt: null,
    };

    logger.info(`Insurance claim ${claimId} submitted by ${walletAddress}`);
    return res.status(201).json({ success: true, data: CLAIMS[claimId] });
  }

  // GET /api/insurance/claims/:claimId
  static async getClaim(req, res) {
    const claim = CLAIMS[req.params.claimId];
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    return res.json({ success: true, data: claim });
  }

  // GET /api/insurance/claims
  static async listClaims(req, res) {
    const { walletAddress, status } = req.query;
    let claims = Object.values(CLAIMS);
    if (walletAddress) claims = claims.filter(c => c.walletAddress === walletAddress.toLowerCase());
    if (status) claims = claims.filter(c => c.status === status);
    claims.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return res.json({ success: true, data: claims, count: claims.length });
  }

  // PUT /api/insurance/claims/:claimId/review — approve or reject
  static async reviewClaim(req, res) {
    const { claimId } = req.params;
    const { decision, payoutAmount, reviewNote } = req.body;
    const claim = CLAIMS[claimId];

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be 'approved' or 'rejected'" });
    }
    if (claim.status !== 'submitted' && claim.status !== 'under_review') {
      return res.status(400).json({ success: false, message: 'Claim is not in a reviewable state' });
    }

    CLAIMS[claimId] = {
      ...claim,
      status: decision,
      payoutAmount: decision === 'approved' ? Number(payoutAmount || claim.requestedAmount) : null,
      reviewNote: reviewNote || '',
      reviewedAt: new Date().toISOString(),
    };

    logger.info(`Insurance claim ${claimId} ${decision}`);
    return res.json({ success: true, data: CLAIMS[claimId] });
  }

  // POST /api/insurance/claims/:claimId/payout — process approved payout
  static async processPayout(req, res) {
    const { claimId } = req.params;
    const claim = CLAIMS[claimId];

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Claim must be approved before processing payout' });
    }

    const txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
    CLAIMS[claimId] = {
      ...claim,
      status: 'paid',
      payoutTxHash: txHash,
      paidAt: new Date().toISOString(),
    };

    logger.info(`Payout processed for claim ${claimId}: ${txHash}`);
    return res.json({ success: true, data: CLAIMS[claimId], message: 'Payout processed successfully' });
  }

  // GET /api/insurance/claims/stats
  static async getStats(req, res) {
    const claims = Object.values(CLAIMS);
    const byStatus = CLAIM_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    let totalPaid = 0;
    claims.forEach(c => {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
      if (c.status === 'paid' && c.payoutAmount) totalPaid += c.payoutAmount;
    });
    return res.json({ success: true, data: { total: claims.length, byStatus, totalPaidOut: totalPaid } });
  }
}

module.exports = InsuranceController;
