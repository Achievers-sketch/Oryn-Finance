describe('rateLimiter middleware', () => {
  let rateLimiter;

  beforeEach(() => {
    jest.resetModules();
    rateLimiter = require('../../src/middleware/rateLimiter');
  });

  it('exports all expected limiters', () => {
    expect(rateLimiter.globalLimiter).toBeDefined();
    expect(rateLimiter.authenticatedLimiter).toBeDefined();
    expect(rateLimiter.sensitiveLimiter).toBeDefined();
    expect(rateLimiter.tradeLimiter).toBeDefined();
    expect(rateLimiter.burstLimiter).toBeDefined();
    expect(rateLimiter.getViolations).toBeDefined();
  });

  it('getViolations returns an array', () => {
    const violations = rateLimiter.getViolations();
    expect(Array.isArray(violations)).toBe(true);
  });

  it('each limiter is a callable Express middleware', () => {
    const limiters = [
      rateLimiter.globalLimiter,
      rateLimiter.authenticatedLimiter,
      rateLimiter.sensitiveLimiter,
      rateLimiter.tradeLimiter,
      rateLimiter.burstLimiter,
    ];
    limiters.forEach((limiter) => {
      expect(typeof limiter).toBe('function');
    });
  });

  describe('abuseDetection.getAbuseMetrics integration', () => {
    it('exports getAbuseMetrics', () => {
      const { getAbuseMetrics } = require('../../src/middleware/abuseDetection');
      expect(typeof getAbuseMetrics).toBe('function');
    });

    it('getAbuseMetrics returns expected shape', () => {
      const { getAbuseMetrics } = require('../../src/middleware/abuseDetection');
      const metrics = getAbuseMetrics();
      expect(metrics).toHaveProperty('currentlyBlocked');
      expect(metrics).toHaveProperty('blockedIPs');
      expect(metrics).toHaveProperty('topSuspicious');
      expect(metrics).toHaveProperty('activeWindows');
      expect(typeof metrics.currentlyBlocked).toBe('number');
      expect(Array.isArray(metrics.blockedIPs)).toBe(true);
      expect(Array.isArray(metrics.topSuspicious)).toBe(true);
      expect(typeof metrics.activeWindows).toBe('number');
    });
  });
});
