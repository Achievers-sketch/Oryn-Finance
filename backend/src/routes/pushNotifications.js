const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const pushService = require('../services/pushNotificationService');
const logger = require('../config/logger');

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const key = pushService.getPublicKey();
  if (!key) {
    return res.status(503).json({
      success: false,
      message: 'Push notifications are not configured on this server.',
    });
  }
  res.json({ success: true, data: { publicKey: key } });
});

// POST /api/push/subscribe
router.post(
  '/subscribe',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
    }

    pushService.saveSubscription(req.user.walletAddress, subscription);

    logger.info('[PUSH] New subscription registered', { walletAddress: req.user.walletAddress });

    res.json({ success: true, message: 'Push notifications enabled.' });
  })
);

// DELETE /api/push/subscribe
router.delete(
  '/subscribe',
  authenticateToken,
  asyncHandler(async (req, res) => {
    pushService.removeSubscription(req.user.walletAddress);
    res.json({ success: true, message: 'Push notifications disabled.' });
  })
);

module.exports = router;
