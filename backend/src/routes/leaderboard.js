const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, authenticateToken } = require('../middleware/auth');
const leaderboardController = require('../controllers/leaderboardController');

// Get top traders by trading volume
router.get('/top-traders',
  optionalAuth,
  asyncHandler(leaderboardController.getTopTraders)
);

// Get top market creators
router.get('/top-creators',
  optionalAuth,
  asyncHandler(leaderboardController.getTopMarketCreators)
);

router.get('/reputation',
  optionalAuth,
  asyncHandler(leaderboardController.getReputationLeaderboard)
);

// Get user's rank (authenticated users only)
router.get('/user-rank',
  authenticateToken,
  asyncHandler(leaderboardController.getUserRank)
);

// Get advanced metrics: win-rate leaders, ROI leaders, most accurate trader
router.get('/advanced-metrics',
  optionalAuth,
  asyncHandler(leaderboardController.getAdvancedMetrics)
);

module.exports = router;