const logger = require("../config/logger");
const Trade = require("../models/Trade");
const User = require("../models/User");
const Market = require("../models/Market");

/**
 * Tax Reporting Service
 * Generates tax reports for trading activities
 */
class TaxReportingService {
  /**
   * Calculate gains and losses for a user
   * @param {string} walletAddress - User's wallet address
   * @param {Date} startDate - Start date for calculation
   * @param {Date} endDate - End date for calculation
   * @returns {Object} Gains and losses summary
   */
  async calculateGainsLosses(walletAddress, startDate, endDate) {
    try {
      const trades = await Trade.find({
        walletAddress,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["executed", "confirmed"] },
      }).populate("marketId");

      let totalGains = 0;
      let totalLosses = 0;
      let shortTermGains = 0;
      let longTermGains = 0;
      const tradeDetails = [];

      for (const trade of trades) {
        if (!trade.marketId || !trade.marketId.resolved) continue;

        const isWinner = trade.side === trade.marketId.outcome;
        const costBasis = trade.amount || 0;
        const proceeds = isWinner ? trade.shares || 0 : 0;
        const gainLoss = proceeds - costBasis;

        const holdingPeriod = trade.marketId.resolvedAt
          ? (new Date(trade.marketId.resolvedAt) - new Date(trade.createdAt)) /
            (1000 * 60 * 60 * 24)
          : 0;

        const isLongTerm = holdingPeriod > 365;

        if (gainLoss > 0) {
          totalGains += gainLoss;
          if (isLongTerm) {
            longTermGains += gainLoss;
          } else {
            shortTermGains += gainLoss;
          }
        } else {
          totalLosses += Math.abs(gainLoss);
        }

        tradeDetails.push({
          tradeId: trade._id,
          marketTitle: trade.marketId.title,
          date: trade.createdAt,
          side: trade.side,
          costBasis,
          proceeds,
          gainLoss,
          holdingPeriod: Math.round(holdingPeriod),
          isLongTerm,
          outcome: trade.marketId.outcome,
        });
      }

      const netGainLoss = totalGains - totalLosses;

      return {
        walletAddress,
        period: { startDate, endDate },
        summary: {
          totalGains,
          totalLosses,
          netGainLoss,
          shortTermGains,
          longTermGains,
          totalTrades: tradeDetails.length,
        },
        trades: tradeDetails,
      };
    } catch (error) {
      logger.error("[TAX_REPORTING] Error calculating gains/losses:", error);
      throw error;
    }
  }

  /**
   * Generate yearly tax report
   * @param {string} walletAddress - User's wallet address
   * @param {number} year - Tax year
   * @returns {Object} Yearly tax report
   */
  async generateYearlyReport(walletAddress, year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const gainsLosses = await this.calculateGainsLosses(
      walletAddress,
      startDate,
      endDate,
    );

    const user = await User.findOne({ walletAddress });

    return {
      reportType: "YEARLY_TAX_REPORT",
      generatedAt: new Date(),
      taxYear: year,
      taxpayer: {
        walletAddress,
        username: user?.username || "N/A",
        email: user?.email || "N/A",
      },
      ...gainsLosses,
      disclaimer:
        "This report is for informational purposes only. Please consult a tax professional for tax advice.",
    };
  }

  /**
   * Generate CSV export of tax data
   * @param {Object} reportData - Tax report data
   * @returns {string} CSV formatted string
   */
  generateCSV(reportData) {
    const headers = [
      "Trade ID",
      "Date",
      "Market",
      "Side",
      "Cost Basis",
      "Proceeds",
      "Gain/Loss",
      "Holding Period (Days)",
      "Term",
      "Outcome",
    ];

    const rows = reportData.trades.map((trade) => [
      trade.tradeId,
      new Date(trade.date).toISOString().split("T")[0],
      `"${trade.marketTitle}"`,
      trade.side.toUpperCase(),
      trade.costBasis.toFixed(2),
      trade.proceeds.toFixed(2),
      trade.gainLoss.toFixed(2),
      trade.holdingPeriod,
      trade.isLongTerm ? "Long-term" : "Short-term",
      trade.outcome.toUpperCase(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const summary = [
      "",
      "SUMMARY",
      `Total Gains,${reportData.summary.totalGains.toFixed(2)}`,
      `Total Losses,${reportData.summary.totalLosses.toFixed(2)}`,
      `Net Gain/Loss,${reportData.summary.netGainLoss.toFixed(2)}`,
      `Short-term Gains,${reportData.summary.shortTermGains.toFixed(2)}`,
      `Long-term Gains,${reportData.summary.longTermGains.toFixed(2)}`,
      `Total Trades,${reportData.summary.totalTrades}`,
    ].join("\n");

    return csvContent + "\n" + summary;
  }

  /**
   * Generate PDF-ready data structure
   * @param {Object} reportData - Tax report data
   * @returns {Object} PDF-ready data
   */
  generatePDFData(reportData) {
    return {
      title: `Tax Report ${reportData.taxYear}`,
      generatedAt: reportData.generatedAt,
      taxpayer: reportData.taxpayer,
      summary: {
        "Total Gains": `$${reportData.summary.totalGains.toFixed(2)}`,
        "Total Losses": `$${reportData.summary.totalLosses.toFixed(2)}`,
        "Net Gain/Loss": `$${reportData.summary.netGainLoss.toFixed(2)}`,
        "Short-term Gains": `$${reportData.summary.shortTermGains.toFixed(2)}`,
        "Long-term Gains": `$${reportData.summary.longTermGains.toFixed(2)}`,
        "Total Trades": reportData.summary.totalTrades,
      },
      trades: reportData.trades.map((trade) => ({
        date: new Date(trade.date).toLocaleDateString(),
        market: trade.marketTitle,
        side: trade.side.toUpperCase(),
        costBasis: `$${trade.costBasis.toFixed(2)}`,
        proceeds: `$${trade.proceeds.toFixed(2)}`,
        gainLoss: `$${trade.gainLoss.toFixed(2)}`,
        term: trade.isLongTerm ? "Long-term" : "Short-term",
      })),
      disclaimer: reportData.disclaimer,
    };
  }
}

module.exports = new TaxReportingService();
