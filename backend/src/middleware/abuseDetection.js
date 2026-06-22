const logger = require('../config/logger');

const WINDOW_MS = 60 * 1000;
const SUSPICIOUS_THRESHOLD = 60;
const BLOCK_THRESHOLD = 100;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

const ipWindows = new Map();
const blockedIPs = new Map();

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

function isBlocked(ip) {
  const blockedUntil = blockedIPs.get(ip);
  if (!blockedUntil) return false;
  if (Date.now() < blockedUntil) return true;
  blockedIPs.delete(ip);
  return false;
}

function recordRequest(ip) {
  const now = Date.now();
  if (!ipWindows.has(ip)) ipWindows.set(ip, []);
  const timestamps = ipWindows.get(ip).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  ipWindows.set(ip, timestamps);
  return timestamps.length;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipWindows.entries()) {
    const active = timestamps.filter((t) => now - t < WINDOW_MS);
    if (active.length === 0) ipWindows.delete(ip);
    else ipWindows.set(ip, active);
  }
  for (const [ip, until] of blockedIPs.entries()) {
    if (now >= until) blockedIPs.delete(ip);
  }
}, WINDOW_MS);

function detectAbuse(req, res, next) {
  const ip = getClientIP(req);

  if (isBlocked(ip)) {
    const until = blockedIPs.get(ip);
    const retryAfter = Math.ceil((until - Date.now()) / 1000);
    logger.warn('[ABUSE] Blocked IP attempted request', {
      ip,
      path: req.path,
      method: req.method,
      retryAfter,
    });
    return res.status(429).json({
      success: false,
      message: 'Your IP has been temporarily blocked due to suspicious activity.',
      retryAfter,
    });
  }

  const count = recordRequest(ip);

  if (count >= BLOCK_THRESHOLD) {
    blockedIPs.set(ip, Date.now() + BLOCK_DURATION_MS);
    logger.warn('[ABUSE] IP blocked after exceeding threshold', {
      ip,
      count,
      path: req.path,
      method: req.method,
      blockedForMinutes: BLOCK_DURATION_MS / 60000,
    });
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Your IP has been temporarily blocked.',
      retryAfter: BLOCK_DURATION_MS / 1000,
    });
  }

  if (count >= SUSPICIOUS_THRESHOLD) {
    logger.warn('[ABUSE] Suspicious request pattern detected', {
      ip,
      count,
      path: req.path,
      method: req.method,
    });
  }

  next();
}

function getAbuseMetrics() {
  const now = Date.now();
  const currentlyBlockedList = [];
  for (const [ip, until] of blockedIPs.entries()) {
    if (now < until) {
      currentlyBlockedList.push({
        ip,
        blockedUntil: new Date(until).toISOString(),
        remainingSecs: Math.ceil((until - now) / 1000),
      });
    }
  }
  return {
    currentlyBlocked: currentlyBlockedList.length,
    blockedIPs: currentlyBlockedList,
    topSuspicious: [],
    activeWindows: ipWindows.size,
  };
}

module.exports = { detectAbuse, getAbuseMetrics };
