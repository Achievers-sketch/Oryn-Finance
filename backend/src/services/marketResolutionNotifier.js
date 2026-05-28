const logger = require("../config/logger");
const pushNotificationService = require("./pushNotificationService");
const User = require("../models/User");
const Trade = require("../models/Trade");
const Market = require("../models/Market");

/**
 * Market Resolution Notification Service
 * Handles notifications for market resolution events
 */
class MarketResolutionNotifier {
  /**
   * Notify all affected traders when a market is resolved
   * @param {string} marketId - The resolved market ID
   * @param {string} outcome - The resolution outcome ('yes' or 'no')
   * @param {Object} resolutionData - Additional resolution data
   */
  async notifyMarketResolution(marketId, outcome, resolutionData = {}) {
    try {
      logger.info(
        `[RESOLUTION_NOTIFIER] Starting notifications for market ${marketId}`,
      );

      const market = await Market.findById(marketId);
      if (!market) {
        logger.error(`[RESOLUTION_NOTIFIER] Market ${marketId} not found`);
        return;
      }

      const affectedTrades = await Trade.find({
        marketId,
        status: { $in: ["executed", "confirmed"] },
      }).distinct("walletAddress");

      logger.info(
        `[RESOLUTION_NOTIFIER] Found ${affectedTrades.length} affected traders`,
      );

      const notificationPromises = affectedTrades.map(async (walletAddress) => {
        try {
          const user = await User.findOne({ walletAddress });
          if (!user) return;

          if (!user.preferences.marketResolutionAlerts) {
            logger.debug(
              `[RESOLUTION_NOTIFIER] User ${walletAddress} has disabled resolution alerts`,
            );
            return;
          }

          const userTrades = await Trade.find({
            marketId,
            walletAddress,
            status: { $in: ["executed", "confirmed"] },
          });

          const payoutSummary = this.calculatePayoutSummary(
            userTrades,
            outcome,
          );

          await this.sendNotification(walletAddress, {
            marketTitle: market.title,
            outcome,
            payoutSummary,
            resolutionData,
          });
        } catch (error) {
          logger.error(
            `[RESOLUTION_NOTIFIER] Failed to notify ${walletAddress}:`,
            error.message,
          );
        }
      });

      await Promise.allSettled(notificationPromises);
      logger.info(
        `[RESOLUTION_NOTIFIER] Completed notifications for market ${marketId}`,
      );
    } catch (error) {
      logger.error(
        "[RESOLUTION_NOTIFIER] Error in notifyMarketResolution:",
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate payout summary for a user's trades
   * @param {Array} trades - User's trades for the market
   * @param {string} outcome - The resolution outcome
   * @returns {Object} Payout summary
   */
  calculatePayoutSummary(trades, outcome) {
    let totalInvested = 0;
    let totalPayout = 0;
    let winningShares = 0;
    let losingShares = 0;

    trades.forEach((trade) => {
      totalInvested += trade.amount || 0;

      if (trade.side === outcome) {
        winningShares += trade.shares || 0;
        totalPayout += trade.shares || 0;
      } else {
        losingShares += trade.shares || 0;
      }
    });

    const netProfit = totalPayout - totalInvested;
    const roi =
      totalInvested > 0 ? ((netProfit / totalInvested) * 100).toFixed(2) : 0;

    return {
      totalInvested,
      totalPayout,
      netProfit,
      roi,
      winningShares,
      losingShares,
      isWinner: netProfit > 0,
    };
  }

  /**
   * Send notification to a user
   * @param {string} walletAddress - User's wallet address
   * @param {Object} data - Notification data
   */
  async sendNotification(walletAddress, data) {
    const { marketTitle, outcome, payoutSummary, resolutionData } = data;

    const outcomeText = outcome === "yes" ? "YES" : "NO";
    const profitText =
      payoutSummary.netProfit >= 0
        ? `+${payoutSummary.netProfit.toFixed(2)}`
        : payoutSummary.netProfit.toFixed(2);

    const body = payoutSummary.isWinner
      ? `You won ${profitText} tokens (${payoutSummary.roi}% ROI)`
      : `Market resolved against your position. Loss: ${profitText} tokens`;

    await pushNotificationService.sendToWallet(walletAddress, {
      title: `Market Resolved: ${outcomeText}`,
      body: `"${marketTitle}" - ${body}`,
      tag: "market-resolved",
      data: {
        marketTitle,
        outcome,
        ...payoutSummary,
        resolvedAt: resolutionData.resolvedAt || new Date().toISOString(),
      },
    });

    logger.info(
      `[RESOLUTION_NOTIFIER] Notified ${walletAddress} - Profit: ${profitText}`,
    );
  }

  /**
   * Send reminder notifications for unclaimed payouts
   * @param {string} marketId - Market ID
   */
  async sendUnclaimedPayoutReminders(marketId) {
    try {
      const market = await Market.findById(marketId);
      if (!market || !market.resolved) return;

      const unclaimedTrades = await Trade.find({
        marketId,
        status: "executed",
        claimed: false,
        side: market.outcome,
      });

      logger.info(
        `[RESOLUTION_NOTIFIER] Found ${unclaimedTrades.length} unclaimed payouts`,
      );

      for (const trade of unclaimedTrades) {
        const user = await User.findOne({ walletAddress: trade.walletAddress });
        if (!user || !user.preferences.marketResolutionAlerts) continue;

        await pushNotificationService.sendToWallet(trade.walletAddress, {
          title: "Unclaimed Payout Available",
          body: `You have ${trade.shares} tokens to claim from "${market.title}"`,
          tag: "unclaimed-payout",
          data: {
            marketId,
            marketTitle: market.title,
            amount: trade.shares,
          },
        });
      }
    } catch (error) {
      logger.error(
        "[RESOLUTION_NOTIFIER] Error sending unclaimed reminders:",
        error,
      );
    }
  }
}

module.exports = new MarketResolutionNotifier();
