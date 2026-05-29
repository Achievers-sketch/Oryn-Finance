/**
 * Governance Delegation Model
 * Issue #132: Track delegated voting power
 */
const mongoose = require('mongoose');

const governanceDelegationSchema = new mongoose.Schema({
  delegator: { type: String, required: true, index: true },
  delegate: { type: String, required: true, index: true },
  votingPower: { type: Number, default: 1, min: 0 },
  active: { type: Boolean, default: true, index: true },
  delegatedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'governance_delegations' });

governanceDelegationSchema.index({ delegator: 1, active: 1 });
governanceDelegationSchema.index({ delegate: 1, active: 1 });

module.exports = mongoose.model('GovernanceDelegation', governanceDelegationSchema);
