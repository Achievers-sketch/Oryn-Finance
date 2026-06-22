const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

module.exports = {};
