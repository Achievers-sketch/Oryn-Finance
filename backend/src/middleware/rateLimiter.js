const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const violations = [];
const MAX_VIOLATIONS = 1000;

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

function onRateLimitExceeded(req, res, options, limiterName) {
  const ip = getClientIP(req);
  const entry = {
    ip,
    limiter: limiterName,
    path: req.path,
    method: req.method,
    userId: req.user?.id || null,
    timestamp: Date.now(),
  };
  violations.push(entry);
  if (violations.length > MAX_VIOLATIONS) violations.shift();
  logger.warn(`[RATE-LIMIT] ${limiterName} exceeded`, entry);
  res.status(options.statusCode).json({
    success: false,
    message: 'Rate limit exceeded. Please slow down.',
    retryAfter: Math.ceil(options.windowMs / 1000),
  });
}

function skipHealthChecks(req) {
  return req.path === '/health' || req.path === '/api/health';
}

function userOrIpKey(req) {
  return req.user?.walletAddress || req.user?.id || getClientIP(req);
}

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipHealthChecks,
  handler: (req, res, next, options) => onRateLimitExceeded(req, res, options, 'global'),
});

module.exports = {};
