const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketId: {
    type: String,
    required: true,
    index: true,
    ref: 'Market'
  },
  userWalletAddress: {
    type: String,
    required: true,
    index: true
  },
  alertType: {
    type: String,
    enum: ['volume_spike', 'wash_trading', 'order_spam', 'extreme_slippage', 'rapid_price_impact'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['open', 'in_review', 'resolved', 'dismissed'],
    default: 'open',
    index: true
  },
  resolvedBy: {
    type: String
  },
  resolutionNotes: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'alerts'
});

// Indexes for better sorting and querying
alertSchema.index({ status: 1, severity: -1, timestamp: -1 });
alertSchema.index({ marketId: 1, timestamp: -1 });
alertSchema.index({ userWalletAddress: 1, timestamp: -1 });

alertSchema.pre('save', function(next) {
  if (!this.alertId) {
    this.alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  if (this.userWalletAddress) {
    this.userWalletAddress = this.userWalletAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Alert', alertSchema);
