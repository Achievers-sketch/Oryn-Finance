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
});
