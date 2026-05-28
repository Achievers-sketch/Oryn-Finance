const { Message, User } = require('../models');
const encryptionService = require('../services/encryptionService');
const logger = require('../config/logger');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

class MessageController {
  static async sendMessage(req, res) {
    try {
      const { recipientWalletAddress, content } = req.body;
      const senderWalletAddress = req.user.walletAddress;

      if (!recipientWalletAddress || !content) {
        throw new ValidationError('Recipient and content are required');
      }

      if (recipientWalletAddress.toLowerCase() === senderWalletAddress) {
        throw new ValidationError('Cannot send message to yourself');
      }

      const recipient = await User.findOne({ walletAddress: recipientWalletAddress.toLowerCase() });
      if (!recipient) {
        throw new NotFoundError('Recipient user not found');
      }

      const participants = [senderWalletAddress, recipientWalletAddress.toLowerCase()];
      const conversationId = encryptionService.hashConversationId(participants);

      const encryptedContent = encryptionService.encryptMessage(content, Buffer.from(conversationId, 'hex'));
      const encryptedForStorage = encryptionService.encryptForStorage(content);

      const message = new Message({
        conversationId,
        senderWalletAddress,
        participants,
        encryptedContent,
        encryptedForStorage,
        readBy: [{ walletAddress: senderWalletAddress }]
      });

      await message.save();

      logger.info('Message sent', {
        conversationId,
        sender: senderWalletAddress,
        recipient: recipientWalletAddress
      });

      res.status(201).json({
        success: true,
        data: {
          messageId: message._id,
          conversationId,
          senderWalletAddress,
          recipientWalletAddress,
          encryptedContent,
          createdAt: message.createdAt
        },
        message: 'Message sent securely'
      });
    } catch (error) {
      logger.error('Send message failed:', error);
      throw error;
    }
  }

  static async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit = 50, before } = req.query;
      const walletAddress = req.user.walletAddress;

      const messages = await Message.findByConversation(conversationId, parseInt(limit), before || null);

      const isParticipant = messages.length === 0 ||
        messages[0].participants.some(p => p.toLowerCase() === walletAddress.toLowerCase());

      if (!isParticipant) {
        throw new ValidationError('Not a participant of this conversation');
      }

      const decryptedMessages = messages.map(msg => {
        try {
          const decrypted = encryptionService.decryptFromStorage(msg.encryptedForStorage);
          return {
            ...msg,
            content: decrypted,
            encryptedContent: undefined,
            encryptedForStorage: undefined
          };
        } catch {
          return {
            ...msg,
            content: null,
            encryptedContent: undefined,
            encryptedForStorage: undefined
          };
        }
      });

      res.json({
        success: true,
        data: {
          conversationId,
          messages: decryptedMessages
        }
      });
    } catch (error) {
      logger.error('Get conversation messages failed:', error);
      throw error;
    }
  }

  static async getUserConversations(req, res) {
    try {
      const walletAddress = req.user.walletAddress;
      const { limit = 20, skip = 0 } = req.query;

      const messages = await Message.findByParticipant(walletAddress, parseInt(limit), parseInt(skip));

      const conversationMap = new Map();
      for (const msg of messages) {
        const cid = msg.conversationId;
        if (!conversationMap.has(cid)) {
          const otherParticipant = msg.participants.find(
            p => p.toLowerCase() !== walletAddress.toLowerCase()
          );
          conversationMap.set(cid, {
            conversationId: cid,
            otherParticipant,
            lastMessage: msg,
            unreadCount: 0
          });
        }
      }

      const unreadCounts = await Message.aggregate([
        { $match: { participants: walletAddress, 'readBy.walletAddress': { $ne: walletAddress } } },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } }
      ]);

      for (const uc of unreadCounts) {
        if (conversationMap.has(uc._id)) {
          conversationMap.get(uc._id).unreadCount = uc.count;
        }
      }

      res.json({
        success: true,
        data: {
          conversations: Array.from(conversationMap.values())
        }
      });
    } catch (error) {
      logger.error('Get user conversations failed:', error);
      throw error;
    }
  }

  static async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const walletAddress = req.user.walletAddress;

      const message = await Message.markAsRead(messageId, walletAddress);
      if (!message) {
        throw new NotFoundError('Message not found');
      }

      res.json({
        success: true,
        message: 'Message marked as read'
      });
    } catch (error) {
      logger.error('Mark message as read failed:', error);
      throw error;
    }
  }
}

module.exports = MessageController;
