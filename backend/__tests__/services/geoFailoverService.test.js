const geoFailoverService = require("../../src/services/geoFailoverService");
const axios = require("axios");

jest.mock("axios");

describe("GeoFailoverService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geoFailoverService.stop();
    geoFailoverService.healthStatus = new Map();
  });

  afterEach(() => {
    geoFailoverService.stop();
  });

  describe("loadRegions", () => {
    it("should load regions from environment", () => {
      const regions = geoFailoverService.loadRegions();
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });
  });

  describe("checkRegionHealth", () => {
    it("should mark region as healthy on successful check", async () => {
      const region = { name: "test", url: "http://test.com", priority: 1 };

      axios.get.mockResolvedValue({ status: 200, data: { status: "ok" } });

      geoFailoverService.healthStatus.set("test", {
        isHealthy: true,
        consecutiveFailures: 0,
        lastCheck: null,
        lastSuccess: new Date(),
        responseTime: 0,
      });

      await geoFailoverService.checkRegionHealth(region);

      const status = geoFailoverService.healthStatus.get("test");
      expect(status.isHealthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
    });

    it("should mark region as unhealthy after threshold failures", async () => {
      const region = { name: "test", url: "http://test.com", priority: 1 };

      axios.get.mockRejectedValue(new Error("Network error"));

      geoFailoverService.healthStatus.set("test", {
        isHealthy: true,
        consecutiveFailures: 0,
        lastCheck: null,
        lastSuccess: new Date(),
        responseTime: 0,
      });

      for (let i = 0; i < geoFailoverService.failoverThreshold; i++) {
        await geoFailoverService.checkRegionHealth(region);
      }

      const status = geoFailoverService.healthStatus.get("test");
      expect(status.isHealthy).toBe(false);
      expect(status.consecutiveFailures).toBe(
        geoFailoverService.failoverThreshold,
      );
    });
  });

  describe("getBestRegion", () => {
    it("should return primary region when healthy", () => {
      geoFailoverService.initializeHealthStatus();
      const bestRegion = geoFailoverService.getBestRegion();
      expect(bestRegion).toBeDefined();
      expect(bestRegion.priority).toBe(1);
    });
  });

  describe("getHealthSummary", () => {
    it("should return health summary with correct structure", () => {
      geoFailoverService.initializeHealthStatus();
      const summary = geoFailoverService.getHealthSummary();

      expect(summary).toHaveProperty("total");
      expect(summary).toHaveProperty("healthy");
      expect(summary).toHaveProperty("unhealthy");
      expect(summary).toHaveProperty("healthPercentage");
      expect(summary).toHaveProperty("regions");
      expect(Array.isArray(summary.regions)).toBe(true);
    });
  });
});
