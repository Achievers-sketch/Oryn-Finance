const mongoose = require('mongoose');

const treasuryTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['fee_inflow', 'distribution_outflow', 'withdrawal', 'investment', 'emergency_withdraw', 'governance_action'],
    required: true,
    index: true
  },
  asset: {
    type: String,
    required: true,
    default: 'USDC'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fromAddress: {
    type: String
  },
  toAddress: {
    type: String
  },
  source: {
    type: String,
    enum: ['trading_fees', 'liquidity_fees', 'governance', 'admin', 'investment_return', 'other'],
    default: 'other'
  },
  purpose: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },
  governanceProposalId: {
    type: String
  },
  stellarTransactionHash: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  executedBy: {
    type: String
  },
  executedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'treasury_transactions'
});

treasuryTransactionSchema.index({ type: 1, createdAt: -1 });
treasuryTransactionSchema.index({ status: 1, createdAt: -1 });
treasuryTransactionSchema.index({ asset: 1, type: 1 });

treasuryTransactionSchema.statics.getTreasuryBalance = function() {
  return this.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$asset',
        totalInflow: {
          $sum: {
            $cond: [
              { $in: ['$type', ['fee_inflow', 'investment_return']] },
              '$amount',
              0
            ]
          }
        },
        totalOutflow: {
          $sum: {
            $cond: [
              { $in: ['$type', ['distribution_outflow', 'withdrawal', 'emergency_withdraw', 'investment']] },
              '$amount',
              0
            ]
          }
        }
      }
    }
  ]);
};

treasuryTransactionSchema.statics.getFeeInflows = function(limit = 50) {
  return this.find({ type: 'fee_inflow', status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

treasuryTransactionSchema.statics.getOutflows = function(limit = 50) {
  return this.find({
    type: { $in: ['distribution_outflow', 'withdrawal', 'emergency_withdraw'] },
    status: 'completed'
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

treasuryTransactionSchema.statics.getGovernanceActions = function(limit = 20) {
  return this.find({ type: 'governance_action', status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

treasuryTransactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `treasury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('TreasuryTransaction', treasuryTransactionSchema);
