const asyncHandler = require("express-async-handler");
const geoFailoverService = require("../services/geoFailoverService");

/**
 * @desc    Get health summary of all regions
 * @route   GET /api/geo-failover/health
 * @access  Public
 */
const getHealthSummary = asyncHandler(async (req, res) => {
  const summary = geoFailoverService.getHealthSummary();

  res.json({
    success: true,
    data: summary,
  });
});

/**
 * @desc    Get best available region
 * @route   GET /api/geo-failover/best-region
 * @access  Public
 */
const getBestRegion = asyncHandler(async (req, res) => {
  const region = geoFailoverService.getBestRegion();

  res.json({
    success: true,
    data: region,
  });
});

/**
 * @desc    Get all regions with status
 * @route   GET /api/geo-failover/regions
 * @access  Public
 */
const getAllRegions = asyncHandler(async (req, res) => {
  const regions = geoFailoverService.getAllRegionsStatus();

  res.json({
    success: true,
    data: regions,
  });
});

/**
 * @desc    Force failover to specific region
 * @route   POST /api/geo-failover/force-failover
 * @access  Private (Admin only)
 */
const forceFailover = asyncHandler(async (req, res) => {
  const { regionName } = req.body;

  if (!regionName) {
    res.status(400);
    throw new Error("Region name is required");
  }

  const region = geoFailoverService.forceFailover(regionName);

  res.json({
    success: true,
    message: `Failover to ${regionName} successful`,
    data: region,
  });
});

module.exports = {
  getHealthSummary,
  getBestRegion,
  getAllRegions,
  forceFailover,
};
