const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  senderWalletAddress: {
    type: String,
    required: true,
    index: true
  },
  participants: [{
    type: String,
    required: true
  }],
  encryptedContent: {
    iv: { type: String, required: true },
    encryptedData: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  encryptedForStorage: {
    type: String,
    required: true
  },
  readBy: [{
    walletAddress: String,
    readAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'messages'
});

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ participants: 1 });
messageSchema.index({ senderWalletAddress: 1, createdAt: -1 });

messageSchema.statics.findByConversation = function(conversationId, limit = 50, before = null) {
  const filter = { conversationId };
  if (before) {
    filter.createdAt = { $lt: before };
  }
  return this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

messageSchema.statics.findByParticipant = function(walletAddress, limit = 50, skip = 0) {
  return this.find({ participants: walletAddress })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

messageSchema.statics.markAsRead = function(messageId, walletAddress) {
  return this.findByIdAndUpdate(
    messageId,
    { $addToSet: { readBy: { walletAddress, readAt: new Date() } } },
    { new: true }
  );
};

module.exports = mongoose.model('Message', messageSchema);
