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

function groupByDate(tf) {
  const fmt = tf === '24h' ? '%Y-%m-%dT%H:00' : '%Y-%m-%d';
  return { $dateToString: { format: fmt, date: '$timestamp' } };
}

async function fetchPerformanceSeries(walletAddress, tf) {
  const since = parseTimeframe(tf);
  const series = await Trade.aggregate([
    {
      $match: {
        userWalletAddress: walletAddress,
        status: { $in: ['confirmed', 'partially_filled'] },
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: groupByDate(tf),
        totalCost: { $sum: '$totalCost' },
        tradeCount: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalFees: { $sum: { $add: ['$fees.platformFee', '$fees.stellarFee'] } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        totalCost: { $round: ['$totalCost', 2] },
        tradeCount: 1,
        avgPrice: { $round: ['$avgPrice', 6] },
        totalFees: { $round: ['$totalFees', 2] },
        _id: 0,
      },
    },
  ]);
  return { series, timeframe: tf };
}
