const Trade = require('../models/Trade');
const logger = require('../config/logger');

const TIMEFRAME_OFFSETS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '1y':  365 * 24 * 60 * 60 * 1000,
};

function parseTimeframe(tf) {
  return new Date(Date.now() - (TIMEFRAME_OFFSETS[tf] || TIMEFRAME_OFFSETS['30d']));
}
