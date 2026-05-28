const asyncHandler = require("express-async-handler");
const taxReportingService = require("../services/taxReportingService");
const logger = require("../config/logger");

/**
 * @desc    Get gains/losses for a period
 * @route   GET /api/tax/gains-losses
 * @access  Private
 */
const getGainsLosses = asyncHandler(async (req, res) => {
  const { walletAddress } = req.user;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400);
    throw new Error("Start date and end date are required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400);
    throw new Error("Invalid date format");
  }

  const report = await taxReportingService.calculateGainsLosses(
    walletAddress,
    start,
    end,
  );

  res.json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Generate yearly tax report
 * @route   GET /api/tax/yearly-report/:year
 * @access  Private
 */
const getYearlyReport = asyncHandler(async (req, res) => {
  const { walletAddress } = req.user;
  const { year } = req.params;

  const taxYear = parseInt(year);
  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    res.status(400);
    throw new Error("Invalid tax year");
  }

  const report = await taxReportingService.generateYearlyReport(
    walletAddress,
    taxYear,
  );

  res.json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Export tax report as CSV
 * @route   GET /api/tax/export/csv/:year
 * @access  Private
 */
const exportCSV = asyncHandler(async (req, res) => {
  const { walletAddress } = req.user;
  const { year } = req.params;

  const taxYear = parseInt(year);
  if (isNaN(taxYear)) {
    res.status(400);
    throw new Error("Invalid tax year");
  }

  const report = await taxReportingService.generateYearlyReport(
    walletAddress,
    taxYear,
  );
  const csv = taxReportingService.generateCSV(report);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="tax-report-${taxYear}.csv"`,
  );
  res.send(csv);
});

/**
 * @desc    Export tax report as PDF data
 * @route   GET /api/tax/export/pdf/:year
 * @access  Private
 */
const exportPDF = asyncHandler(async (req, res) => {
  const { walletAddress } = req.user;
  const { year } = req.params;

  const taxYear = parseInt(year);
  if (isNaN(taxYear)) {
    res.status(400);
    throw new Error("Invalid tax year");
  }

  const report = await taxReportingService.generateYearlyReport(
    walletAddress,
    taxYear,
  );
  const pdfData = taxReportingService.generatePDFData(report);

  res.json({
    success: true,
    data: pdfData,
  });
});

module.exports = {
  getGainsLosses,
  getYearlyReport,
  exportCSV,
  exportPDF,
};
