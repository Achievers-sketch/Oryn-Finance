const mongoose = require('mongoose');

const indexedEventSchema = new mongoose.Schema({
  contractId: {
    type: String,
    required: true,
    index: true
  },
  contractName: {
    type: String,
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true,
    index: true
  },
  txHash: {
    type: String,
    required: true,
    index: true
  },
  ledger: {
    type: Number,
    required: true,
    index: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  // Transaction history fields
  eventType: {
    type: String,
    required: true,
    index: true,
    enum: [
      'investment',
      'withdrawal',
      'trade',
      'liquidity_add',
      'liquidity_remove',
      'market_creation',
      'market_resolution',
      'winnings_claimed',
      'swap',
      'governance',
      'oracle',
      'insurance',
      'reputation',
      'other'
    ]
  },
  userAddress: {
    type: String,
    index: true,
    trim: true
  },
  marketId: {
    type: String,
    index: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },
  tokenType: {
    type: String,
    enum: ['yes', 'no', 'native', 'custom'],
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'reconciled'],
    default: 'confirmed',
    index: true
  },
  // Reconciliation fields
  reconciliationStatus: {
    type: String,
    enum: ['not_checked', 'matched', 'mismatch', 'error'],
    default: 'not_checked',
    index: true
  },
  reconciliationAttempts: {
    type: Number,
    default: 0
  },
  lastReconciledAt: {
    type: Date,
    default: null
  },
  reconciliationError: {
    type: String,
    default: null
  },
  // Additional metadata for filtering
  blockTimestamp: {
    type: Date,
    default: null
  },
  fee: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  }
}, {
  timestamps: true,
  collection: 'indexed_events'
});

// Compound indexes for efficient queries
indexedEventSchema.index({ txHash: 1, topic: 1, contractId: 1 }, { unique: true });
indexedEventSchema.index({ contractName: 1, ledger: -1 });
indexedEventSchema.index({ userAddress: 1, createdAt: -1 });
indexedEventSchema.index({ eventType: 1, createdAt: -1 });
indexedEventSchema.index({ marketId: 1, createdAt: -1 });
indexedEventSchema.index({ status: 1, reconciliationStatus: 1 });
indexedEventSchema.index({ createdAt: -1, ledger: -1 });

// Virtual for formatted amount
indexedEventSchema.virtual('formattedAmount').get(function() {
  return this.amount ? this.amount.toString() : '0';
});

module.exports = mongoose.model('IndexedEvent', indexedEventSchema);
