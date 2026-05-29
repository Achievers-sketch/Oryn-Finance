/**
 * Tests for Issues #132, #135, #138, #147
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// ── #132 Governance Delegation ────────────────────────────────────────────────
describe('GovernanceDelegationController', () => {
  let ctrl;
  beforeEach(() => {
    jest.resetModules();
    ctrl = require('../../src/controllers/governanceDelegationController');
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('delegate – sets delegation', async () => {
    const req = { user: { walletAddress: 'GAAA' }, body: { delegate: 'GBBB' } };
    const res = mockRes();
    await ctrl.delegate(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('delegate – rejects self-delegation', async () => {
    const req = { user: { walletAddress: 'GAAA' }, body: { delegate: 'GAAA' } };
    const res = mockRes();
    await ctrl.delegate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('delegate – requires auth', async () => {
    const req = { user: null, body: { delegate: 'GBBB' } };
    const res = mockRes();
    await ctrl.delegate(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('revoke – revokes active delegation', async () => {
    const req1 = { user: { walletAddress: 'GCCC' }, body: { delegate: 'GDDD' } };
    const res1 = mockRes();
    await ctrl.delegate(req1, res1);

    const req2 = { user: { walletAddress: 'GCCC' } };
    const res2 = mockRes();
    await ctrl.revoke(req2, res2);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('getDashboard – returns dashboard data', async () => {
    const req = { user: { walletAddress: 'GEEE' } };
    const res = mockRes();
    await ctrl.getDashboard(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveProperty('effectiveVotingPower');
    expect(payload.data).toHaveProperty('delegatedToMe');
  });
});

// ── #135 Correlation ──────────────────────────────────────────────────────────
describe('CorrelationController', () => {
  let ctrl;
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/models', () => ({
      Market: {
        find: jest.fn().mockResolvedValue([
          { marketId: 'MKT1', question: 'Q1', category: 'crypto', yesPrice: 0.6, priceHistory: [0.5, 0.6, 0.7] },
          { marketId: 'MKT2', question: 'Q2', category: 'sports', yesPrice: 0.4, priceHistory: [0.4, 0.5, 0.6] },
        ]),
        findOne: jest.fn(),
      },
    }));
    ctrl = require('../../src/controllers/correlationController');
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('getHeatmap – requires ids param', async () => {
    const req = { query: {} };
    const res = mockRes();
    await ctrl.getHeatmap(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getHeatmap – requires at least 2 ids', async () => {
    const req = { query: { ids: 'MKT1' } };
    const res = mockRes();
    await ctrl.getHeatmap(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getHeatmap – returns matrix for valid ids', async () => {
    const req = { query: { ids: 'MKT1,MKT2' } };
    const res = mockRes();
    await ctrl.getHeatmap(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

// ── #138 Market Alerts ────────────────────────────────────────────────────────
describe('MarketAlertsController', () => {
  let ctrl;
  beforeEach(() => {
    jest.resetModules();
    ctrl = require('../../src/controllers/marketAlertsController');
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('createAlert – creates alert', async () => {
    const req = { user: { walletAddress: 'GAAA' }, body: { marketId: 'MKT1', alertType: 'price_movement', threshold: 5 } };
    const res = mockRes();
    await ctrl.createAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('createAlert – rejects invalid alertType', async () => {
    const req = { user: { walletAddress: 'GAAA' }, body: { marketId: 'MKT1', alertType: 'invalid_type' } };
    const res = mockRes();
    await ctrl.createAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createAlert – requires auth', async () => {
    const req = { user: null, body: { marketId: 'MKT1', alertType: 'price_movement' } };
    const res = mockRes();
    await ctrl.createAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('listAlerts – returns user alerts', async () => {
    // First create one
    const createReq = { user: { walletAddress: 'GLIST' }, body: { marketId: 'MKT2', alertType: 'market_resolution' } };
    const createRes = mockRes();
    await ctrl.createAlert(createReq, createRes);

    const req = { user: { walletAddress: 'GLIST' } };
    const res = mockRes();
    await ctrl.listAlerts(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.data)).toBe(true);
  });

  test('deleteAlert – 404 for unknown alert', async () => {
    const req = { user: { walletAddress: 'GAAA' }, params: { alertId: 'nonexistent' } };
    const res = mockRes();
    await ctrl.deleteAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── #147 Contract Version Service ─────────────────────────────────────────────
describe('ContractVersionService', () => {
  let svc;
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config/contracts', () => ({
      CURRENT_NETWORK: 'testnet',
      getNetworkConfig: jest.fn().mockReturnValue({}),
      getContractAddress: jest.fn().mockReturnValue('CTEST'),
    }));
    svc = require('../../src/services/contractVersionService');
  });

  test('getSummary – returns all contracts', () => {
    const summary = svc.getSummary();
    expect(summary).toHaveProperty('contracts');
    expect(Array.isArray(summary.contracts)).toBe(true);
    expect(summary.contracts.length).toBeGreaterThan(0);
  });

  test('getVersion – returns version for known contract', () => {
    const v = svc.getVersion('MARKET_FACTORY');
    expect(v).not.toBeNull();
    expect(v).toHaveProperty('version');
    expect(v).toHaveProperty('address');
  });

  test('getVersion – returns null for unknown contract', () => {
    expect(svc.getVersion('NONEXISTENT')).toBeNull();
  });

  test('compareVersions – 1.1.0 > 1.0.0', () => {
    expect(svc.compareVersions('1.1.0', '1.0.0')).toBe(1);
  });

  test('compareVersions – equal versions', () => {
    expect(svc.compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  test('auditVersions – returns audit report', () => {
    const audit = svc.auditVersions('1.0.0');
    expect(audit).toHaveProperty('totalContracts');
    expect(audit).toHaveProperty('contracts');
    expect(audit.contracts.every((c) => c.isUpToDate)).toBe(true);
  });

  test('recordUpgrade – updates version', () => {
    svc.recordUpgrade('MARKET_FACTORY', '2.0.0', 'CNEWADDRESS', 'Major upgrade');
    const v = svc.getVersion('MARKET_FACTORY');
    expect(v.version).toBe('2.0.0');
    expect(v.historyCount).toBe(1);
  });

  test('generateMigrationPlan – upgrade path', () => {
    const plan = svc.generateMigrationPlan('MARKET_FACTORY', '1.0.0', '2.0.0');
    expect(plan).toHaveProperty('direction', 'upgrade');
    expect(plan).toHaveProperty('steps');
  });
});
