const axios = require("axios");
const logger = require("../config/logger");

/**
 * Geo-Distributed API Failover Service
 * Manages regional failover and health-based routing
 */
class GeoFailoverService {
  constructor() {
    this.regions = this.loadRegions();
    this.healthStatus = new Map();
    this.healthCheckInterval = null;
    this.failoverThreshold = 3; // Number of failed checks before failover
    this.healthCheckIntervalMs = 30000; // 30 seconds
  }

  /**
   * Load regional endpoints from environment
   */
  loadRegions() {
    const regions = [];

    // Primary region
    if (process.env.API_PRIMARY_REGION && process.env.API_PRIMARY_URL) {
      regions.push({
        name: process.env.API_PRIMARY_REGION,
        url: process.env.API_PRIMARY_URL,
        priority: 1,
        isPrimary: true,
      });
    }

    // Secondary regions
    const secondaryRegions =
      process.env.API_SECONDARY_REGIONS?.split(",") || [];
    const secondaryUrls = process.env.API_SECONDARY_URLS?.split(",") || [];

    secondaryRegions.forEach((region, index) => {
      if (secondaryUrls[index]) {
        regions.push({
          name: region.trim(),
          url: secondaryUrls[index].trim(),
          priority: index + 2,
          isPrimary: false,
        });
      }
    });

    // Fallback to localhost if no regions configured
    if (regions.length === 0) {
      regions.push({
        name: "local",
        url: "http://localhost:5001",
        priority: 1,
        isPrimary: true,
      });
    }

    logger.info(`[GEO_FAILOVER] Loaded ${regions.length} regions`);
    return regions;
  }

  /**
   * Initialize health status for all regions
   */
  initializeHealthStatus() {
    this.regions.forEach((region) => {
      this.healthStatus.set(region.name, {
        isHealthy: true,
        consecutiveFailures: 0,
        lastCheck: null,
        lastSuccess: new Date(),
        responseTime: 0,
      });
    });
  }

  /**
   * Start health check monitoring
   */
  start() {
    if (this.healthCheckInterval) {
      logger.warn("[GEO_FAILOVER] Health checks already running");
      return;
    }

    this.initializeHealthStatus();

    // Run initial health check
    this.performHealthChecks();

    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    logger.info("[GEO_FAILOVER] Health check monitoring started");
  }

  /**
   * Stop health check monitoring
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info("[GEO_FAILOVER] Health check monitoring stopped");
    }
  }

  /**
   * Perform health checks on all regions
   */
  async performHealthChecks() {
    const checks = this.regions.map((region) => this.checkRegionHealth(region));
    await Promise.allSettled(checks);
  }

  /**
   * Check health of a specific region
   */
  async checkRegionHealth(region) {
    const startTime = Date.now();
    const status = this.healthStatus.get(region.name);

    try {
      const response = await axios.get(`${region.url}/api/health`, {
        timeout: 5000,
        validateStatus: (status) => status === 200,
      });

      const responseTime = Date.now() - startTime;

      // Update health status
      status.isHealthy = true;
      status.consecutiveFailures = 0;
      status.lastCheck = new Date();
      status.lastSuccess = new Date();
      status.responseTime = responseTime;

      logger.debug(`[GEO_FAILOVER] ${region.name} healthy (${responseTime}ms)`);
    } catch (error) {
      status.consecutiveFailures += 1;
      status.lastCheck = new Date();

      if (status.consecutiveFailures >= this.failoverThreshold) {
        status.isHealthy = false;
        logger.warn(
          `[GEO_FAILOVER] ${region.name} marked unhealthy after ${status.consecutiveFailures} failures`,
        );
      } else {
        logger.debug(
          `[GEO_FAILOVER] ${region.name} check failed (${status.consecutiveFailures}/${this.failoverThreshold})`,
        );
      }
    }

    this.healthStatus.set(region.name, status);
  }

  /**
   * Get the best available region based on health and priority
   */
  getBestRegion() {
    const healthyRegions = this.regions
      .filter((region) => {
        const status = this.healthStatus.get(region.name);
        return status && status.isHealthy;
      })
      .sort((a, b) => {
        const statusA = this.healthStatus.get(a.name);
        const statusB = this.healthStatus.get(b.name);

        // Sort by priority first, then by response time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return statusA.responseTime - statusB.responseTime;
      });

    if (healthyRegions.length === 0) {
      logger.error("[GEO_FAILOVER] No healthy regions available");
      return this.regions[0]; // Return primary as fallback
    }

    return healthyRegions[0];
  }

  /**
   * Get region by name
   */
  getRegion(name) {
    return this.regions.find((r) => r.name === name);
  }

  /**
   * Get all regions with health status
   */
  getAllRegionsStatus() {
    return this.regions.map((region) => ({
      ...region,
      health: this.healthStatus.get(region.name),
    }));
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const total = this.regions.length;
    const healthy = this.regions.filter((r) => {
      const status = this.healthStatus.get(r.name);
      return status && status.isHealthy;
    }).length;

    return {
      total,
      healthy,
      unhealthy: total - healthy,
      healthPercentage: total > 0 ? ((healthy / total) * 100).toFixed(2) : 0,
      regions: this.getAllRegionsStatus(),
    };
  }

  /**
   * Force failover to a specific region
   */
  forceFailover(regionName) {
    const region = this.getRegion(regionName);
    if (!region) {
      throw new Error(`Region ${regionName} not found`);
    }

    const status = this.healthStatus.get(regionName);
    if (!status || !status.isHealthy) {
      throw new Error(`Region ${regionName} is not healthy`);
    }

    logger.info(`[GEO_FAILOVER] Forced failover to ${regionName}`);
    return region;
  }
}

module.exports = new GeoFailoverService();
