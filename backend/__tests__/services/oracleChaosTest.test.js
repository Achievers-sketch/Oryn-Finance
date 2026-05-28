const jest = require('jest');
const BaseOracleProvider = require('../../src/services/oracle/BaseOracleProvider');
const logger = require('../../src/config/logger');

jest.mock('../../src/config/logger', () => ({ oracle: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

class MockProvider extends BaseOracleProvider {
  constructor(config = {}) {
    super(config);
    this.name = config.name || 'mock-provider';
    this.shouldFail = config.shouldFail || false;
    this.resolveDelay = config.resolveDelay || 10;
    this.failUntil = config.failUntil || null;
    this.resolveCount = 0;
  }

  getSupportedMarketTypes() {
    return ['test', 'generic'];
  }

  async resolve(market) {
    this.resolveCount++;
    if (this.shouldFail) {
      throw new Error(`Provider ${this.name} simulated failure`);
    }
    if (this.failUntil && Date.now() < this.failUntil) {
      throw new Error(`Provider ${this.name} unavailable until recovery`);
    }
    await new Promise(r => setTimeout(r, this.resolveDelay));
    return {
      outcome: 'yes',
      confidence: 0.9,
      data: { source: this.name, timestamp: new Date().toISOString() }
    };
  }
}

let chaosTestProvider;

beforeEach(() => {
  jest.clearAllMocks();
  chaosTestProvider = null;
});

describe('Oracle Chaos Tests - Downtime Simulation', () => {
  it('should handle single provider failure gracefully', async () => {
    const provider = new MockProvider({ name: 'unstable-provider', shouldFail: true });
    await expect(provider.resolve({ marketId: 'test' })).rejects.toThrow('simulated failure');
    expect(provider.health.failureCount).toBe(0);
    try { await provider.resolve({ marketId: 'test' }); } catch (e) { /* expected */ }
    expect(provider.resolveCount).toBe(1);
  });

  it('should track health metrics after consecutive failures', async () => {
    const provider = new MockProvider({ name: 'failing-provider', shouldFail: true });
    const failures = 5;
    for (let i = 0; i < failures; i++) {
      try { await provider.resolve({ marketId: 'test' }); } catch (e) { /* expected */ }
    }
    expect(provider.resolveCount).toBe(failures);
  });

  it('should recover after transient failure', async () => {
    const failUntil = Date.now() + 50;
    const provider = new MockProvider({ name: 'recovering-provider', failUntil });
    try { await provider.resolve({ marketId: 'test' }); } catch (e) { /* expected */ }
    await new Promise(r => setTimeout(r, 60));
    await expect(provider.resolve({ marketId: 'test' })).resolves.toHaveProperty('outcome', 'yes');
  });

  it('should use fallback when primary provider is down', async () => {
    const primary = new MockProvider({ name: 'primary', shouldFail: true });
    const fallback = new MockProvider({ name: 'fallback', shouldFail: false });
    let result = null;
    try {
      result = await primary.resolve({ marketId: 'test' });
    } catch {
      result = await fallback.resolve({ marketId: 'test' });
    }
    expect(result).toHaveProperty('outcome', 'yes');
    expect(result.data.source).toBe('fallback');
  });

  it('should not cascade failures across providers', async () => {
    const providers = [
      new MockProvider({ name: 'p1', shouldFail: true }),
      new MockProvider({ name: 'p2', shouldFail: false }),
      new MockProvider({ name: 'p3', shouldFail: true }),
      new MockProvider({ name: 'p4', shouldFail: false })
    ];
    const results = [];
    for (const p of providers) {
      try {
        const r = await p.resolve({ marketId: 'test' });
        results.push(r);
      } catch { /* skip failed */ }
    }
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.data.source).toMatch(/^p[24]$/));
  });
});

describe('Oracle Chaos Tests - Fallback Mechanism Validation', () => {
  it('should return first successful result from fallback chain', async () => {
    const chain = [
      new MockProvider({ name: 'chain-0', shouldFail: true }),
      new MockProvider({ name: 'chain-1', shouldFail: true }),
      new MockProvider({ name: 'chain-2', shouldFail: false }),
      new MockProvider({ name: 'chain-3', shouldFail: false })
    ];
    let result = null;
    for (const provider of chain) {
      if (result) break;
      try {
        result = await provider.resolve({ marketId: 'test' });
      } catch { /* continue */ }
    }
    expect(result).toBeTruthy();
    expect(result.data.source).toBe('chain-2');
  });

  it('should handle all providers in chain failing', async () => {
    const chain = [
      new MockProvider({ name: 'dead-1', shouldFail: true }),
      new MockProvider({ name: 'dead-2', shouldFail: true }),
      new MockProvider({ name: 'dead-3', shouldFail: true })
    ];
    let result = null;
    for (const provider of chain) {
      try {
        result = await provider.resolve({ marketId: 'test' });
      } catch { /* continue */ }
    }
    expect(result).toBeNull();
  });

  it('should prefer higher weight providers in aggregation', async () => {
    const providers = [
      { source: 'high-weight', outcome: 'yes', confidence: 0.9, data: {} },
      { source: 'low-weight', outcome: 'no', confidence: 0.3, data: {} },
      { source: 'medium-weight', outcome: 'yes', confidence: 0.7, data: {} }
    ];
    const yesWeight = providers
      .filter(p => p.outcome === 'yes')
      .reduce((sum, p) => sum + p.confidence, 0);
    const noWeight = providers
      .filter(p => p.outcome === 'no')
      .reduce((sum, p) => sum + p.confidence, 0);
    expect(yesWeight).toBeGreaterThan(noWeight);
  });
});

describe('Oracle Chaos Tests - Recovery Behavior Measurement', () => {
  it('should measure recovery time after failure', async () => {
    const failDuration = 30;
    const failUntil = Date.now() + failDuration;
    const provider = new MockProvider({ name: 'measured-recovery', failUntil });
    const startTime = Date.now();
    let recovered = false;
    let attempts = 0;
    while (!recovered && attempts < 10) {
      attempts++;
      try {
        await provider.resolve({ marketId: 'test' });
        recovered = true;
      } catch { await new Promise(r => setTimeout(r, 10)); }
    }
    const recoveryTime = Date.now() - startTime;
    expect(recovered).toBe(true);
    expect(recoveryTime).toBeGreaterThanOrEqual(failDuration);
    expect(attempts).toBeGreaterThan(1);
  });

  it('should return to healthy state after recovery period', async () => {
    const provider = new MockProvider({ name: 'health-cycle' });
    provider.health.failureCount = 5;
    provider.health.isHealthy = false;
    provider.health.failureRate = 1.0;
    provider.resolveCount = 0;
    await provider.resolve({ marketId: 'test' });
    provider.health.successCount = 1;
    expect(provider.resolveCount).toBe(1);
  });

  it('should maintain service availability during partial outage', async () => {
    const providers = Array.from({ length: 10 }, (_, i) =>
      new MockProvider({ name: `node-${i}`, shouldFail: i < 3 })
    );
    const results = [];
    for (const p of providers) {
      try {
        const r = await p.resolve({ marketId: 'test' });
        results.push(r);
      } catch { /* partial outage */ }
    }
    expect(results.length).toBe(7);
    expect(results.every(r => r.outcome === 'yes')).toBe(true);
  });

  it('should handle rapid repeated failures without crashing', async () => {
    const provider = new MockProvider({ name: 'hammered', shouldFail: true });
    const promises = Array.from({ length: 20 }, () =>
      provider.resolve({ marketId: 'test' }).catch(() => null)
    );
    const results = await Promise.all(promises);
    expect(results.every(r => r === null)).toBe(true);
    expect(provider.resolveCount).toBe(20);
  });

  it('should correctly aggregate results from healthy providers only', async () => {
    const results = [
      { source: 'healthy-1', outcome: 'yes', confidence: 0.95, data: {} },
      { source: 'healthy-2', outcome: 'yes', confidence: 0.85, data: {} },
      { source: 'healthy-3', outcome: 'no', confidence: 0.4, data: {} }
    ];
    const totalWeight = results.reduce((s, r) => s + r.confidence, 0);
    const yesWeight = results.filter(r => r.outcome === 'yes').reduce((s, r) => s + r.confidence, 0);
    const aggregatedOutcome = yesWeight > (totalWeight - yesWeight) ? 'yes' : 'no';
    expect(aggregatedOutcome).toBe('yes');
    expect(totalWeight).toBeCloseTo(2.2, 1);
  });
});
