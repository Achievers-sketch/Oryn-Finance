/**
 * User Market Alert Model
 * Issue #138: Custom Market Alerts
 */
const mongoose = require('mongoose');

const userAlertSchema = new mongoose.Schema({
  userWalletAddress: { type: String, required: true, index: true },
  marketId: { type: String, required: true, index: true },
  alertType: {
    type: String,
    enum: ['price_movement', 'liquidity_change', 'market_resolution'],
    required: true,
  },
  threshold: { type: Number, default: null }, // e.g. 5 for 5% price move
  active: { type: Boolean, default: true, index: true },
  lastTriggeredAt: { type: Date, default: null },
}, { timestamps: true, collection: 'user_alerts' });

userAlertSchema.index({ userWalletAddress: 1, marketId: 1, alertType: 1 }, { unique: true });

module.exports = mongoose.model('UserAlert', userAlertSchema);
