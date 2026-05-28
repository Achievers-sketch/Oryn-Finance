const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.post('/send',
  authenticateToken,
  asyncHandler(messageController.sendMessage)
);

router.get('/conversations',
  authenticateToken,
  asyncHandler(messageController.getUserConversations)
);

router.get('/conversations/:conversationId',
  authenticateToken,
  asyncHandler(messageController.getConversationMessages)
);

router.put('/:messageId/read',
  authenticateToken,
  asyncHandler(messageController.markAsRead)
);

module.exports = router;
