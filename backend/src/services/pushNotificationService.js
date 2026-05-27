const webpush = require('web-push');
const logger = require('../config/logger');

// In-memory subscription store keyed by walletAddress
const subscriptions = new Map();

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@oryn.finance';

  if (!publicKey || !privateKey) {
    logger.warn('[PUSH] VAPID keys not configured — push notifications disabled');
    return null;
  }

  return { publicKey, privateKey, subject };
}

function isConfigured() {
  return !!getVapidKeys();
}

function initVapid() {
  const keys = getVapidKeys();
  if (!keys) return;
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  logger.info('[PUSH] VAPID keys loaded — push notifications enabled');
}

function saveSubscription(walletAddress, subscription) {
  subscriptions.set(walletAddress.toLowerCase(), subscription);
  logger.info('[PUSH] Subscription saved', { walletAddress });
}

function removeSubscription(walletAddress) {
  subscriptions.delete(walletAddress.toLowerCase());
  logger.info('[PUSH] Subscription removed', { walletAddress });
}

async function sendToWallet(walletAddress, payload) {
  if (!isConfigured()) return;
  const subscription = subscriptions.get(walletAddress.toLowerCase());
  if (!subscription) return;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      subscriptions.delete(walletAddress.toLowerCase());
      logger.info('[PUSH] Stale subscription removed', { walletAddress });
    } else {
      logger.error('[PUSH] Failed to send push notification', { walletAddress, error: error.message });
    }
  }
}

async function notifyTradeExecuted(walletAddress, { marketTitle, action, amount }) {
  await sendToWallet(walletAddress, {
    title: 'Trade Executed',
    body: `Your ${action} of ${amount} on "${marketTitle}" was confirmed.`,
    tag: 'trade-executed',
  });
}

async function notifyMarketResolved(walletAddress, { marketTitle, outcome }) {
  await sendToWallet(walletAddress, {
    title: 'Market Resolved',
    body: `"${marketTitle}" has been resolved: ${outcome}`,
    tag: 'market-resolved',
  });
}

module.exports = {
  initVapid,
  isConfigured,
  saveSubscription,
  removeSubscription,
  sendToWallet,
  notifyTradeExecuted,
  notifyMarketResolved,
  getPublicKey: () => getVapidKeys()?.publicKey || null,
};
