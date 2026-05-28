const mongoose = require('mongoose');

const liquidityPositionSchema = new mongoose.Schema({
  positionId: {
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
  depositedYesAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  depositedNoAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lpTokens: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  shareOfPool: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalFeesEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  feeHistory: [{
    timestamp: Date,
    amount: Number,
    source: {
      type: String,
      enum: ['swap', 'distribution']
    }
  }],
  impermanentLoss: {
    estimatedLossPct: {
      type: Number,
      default: 0
    },
    estimatedLossUsd: {
      type: Number,
      default: 0
    },
    holdValue: {
      type: Number,
      default: 0
    },
    lpValue: {
      type: Number,
      default: 0
    },
    lastCalculated: {
      type: Date
    }
  },
  status: {
    type: String,
    enum: ['active', 'withdrawn'],
    default: 'active',
    index: true
  },
  depositedAt: {
    type: Date,
    default: Date.now
  },
  withdrawnAt: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'liquidity_positions'
});

liquidityPositionSchema.index({ userWalletAddress: 1, status: 1 });
liquidityPositionSchema.index({ marketId: 1, status: 1 });
liquidityPositionSchema.index({ userWalletAddress: 1, marketId: 1 });

liquidityPositionSchema.virtual('currentValue').get(function() {
  return (this.depositedYesAmount + this.depositedNoAmount) - this.impermanentLoss.estimatedLossUsd;
});

liquidityPositionSchema.virtual('totalReturn').get(function() {
  const totalDeposited = this.depositedYesAmount + this.depositedNoAmount;
  if (totalDeposited === 0) return 0;
  return ((this.currentValue + this.totalFeesEarned) - totalDeposited) / totalDeposited;
});

liquidityPositionSchema.methods.addFeeEarned = function(amount, source) {
  this.totalFeesEarned += amount;
  this.feeHistory.push({
    timestamp: new Date(),
    amount,
    source
  });
  this.lastUpdated = new Date();
};

liquidityPositionSchema.methods.calculateImpermanentLoss = function(currentYesPrice, currentNoPrice, depositYesPrice, depositNoPrice) {
  const yesPriceRatio = depositYesPrice > 0 ? currentYesPrice / depositYesPrice : 1;
  const noPriceRatio = depositNoPrice > 0 ? currentNoPrice / depositNoPrice : 1;

  const holdValue = (this.depositedYesAmount * yesPriceRatio) + (this.depositedNoAmount * noPriceRatio);

  const k = Math.sqrt(yesPriceRatio * noPriceRatio);
  const lpValue = (this.depositedYesAmount + this.depositedNoAmount) * k;

  const lossPct = holdValue > 0 ? ((lpValue - holdValue) / holdValue) * 100 : 0;

  this.impermanentLoss = {
    estimatedLossPct: Math.max(lossPct, 0),
    estimatedLossUsd: Math.max(holdValue - lpValue, 0),
    holdValue,
    lpValue,
    lastCalculated: new Date()
  };
  this.lastUpdated = new Date();
};

liquidityPositionSchema.statics.findUserPositions = function(walletAddress, status = 'active') {
  return this.find({
    userWalletAddress: walletAddress.toLowerCase(),
    status
  }).sort({ lastUpdated: -1 });
};

liquidityPositionSchema.statics.findMarketPositions = function(marketId) {
  return this.find({ marketId, status: 'active' }).sort({ lpTokens: -1 });
};

liquidityPositionSchema.statics.getUserPortfolioMetrics = function(walletAddress) {
  return this.aggregate([
    { $match: { userWalletAddress: walletAddress.toLowerCase(), status: 'active' } },
    {
      $group: {
        _id: null,
        totalPositions: { $sum: 1 },
        totalDeposited: { $sum: { $add: ['$depositedYesAmount', '$depositedNoAmount'] } },
        totalFeesEarned: { $sum: '$totalFeesEarned' },
        totalIL: { $sum: '$impermanentLoss.estimatedLossUsd' }
      }
    }
  ]);
};

liquidityPositionSchema.pre('save', function(next) {
  if (!this.positionId) {
    this.positionId = `lp_${this.userWalletAddress}_${this.marketId}_${Date.now()}`;
  }
  if (this.userWalletAddress) {
    this.userWalletAddress = this.userWalletAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('LiquidityPosition', liquidityPositionSchema);
