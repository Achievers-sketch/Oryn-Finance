jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/models/Market', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../src/models/Trade', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../src/models/Position', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../src/models/IndexedEvent', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../src/models/TreasuryTransaction', () => ({
  aggregate: jest.fn(),
  find: jest.fn(),
  getTreasuryBalance: jest.fn(),
}));

const Market = require('../../src/models/Market');
const Trade = require('../../src/models/Trade');
const Position = require('../../src/models/Position');
const IndexedEvent = require('../../src/models/IndexedEvent');
const TreasuryTransaction = require('../../src/models/TreasuryTransaction');
const ReportingController = require('../../src/controllers/reportingController');

const mockResponse = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

const findChain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

describe('ReportingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Position.aggregate
      .mockResolvedValueOnce([{
        activePositions: 4,
        uniqueWallets: 3,
        totalShares: 1500,
        totalCostBasis: 900,
        realizedPnL: 35,
        unrealizedPnL: 42,
        yesShares: 1000,
        noShares: 500,
      }])
      .mockResolvedValueOnce([{ category: 'crypto', totalCostBasis: 900, activePositions: 4 }])
      .mockResolvedValueOnce([{ marketId: 'MKT-1', question: 'Will BTC rally?', totalCostBasis: 900 }]);

    Trade.aggregate.mockResolvedValue([{ category: 'crypto', totalVolume: 1200, tradeCount: 8 }]);
    Market.aggregate.mockResolvedValue([{ status: 'active', count: 2, totalVolume: 5000 }]);

    TreasuryTransaction.getTreasuryBalance.mockResolvedValue([
      { _id: 'USDC', totalInflow: 5000, totalOutflow: 1200 },
    ]);
    TreasuryTransaction.aggregate
      .mockResolvedValueOnce([{ totalInflows: 1000, totalOutflows: 300, netFlow: 700, governanceActions: 2, transactionCount: 6 }])
      .mockResolvedValueOnce([{ period: '2026-06-16', inflows: 1000, outflows: 300, netFlow: 700 }])
      .mockResolvedValueOnce([{ source: 'trading_fees', total: 900, count: 5 }])
      .mockResolvedValueOnce([{ asset: 'USDC', inflows: 1000, outflows: 300, netFlow: 700 }])
      .mockResolvedValueOnce([{ totalActions: 2, proposalsAffected: 2, uniqueExecutors: 1 }])
      .mockResolvedValueOnce([{ action: 'fee_update', count: 1, proposals: 1 }])
      .mockResolvedValueOnce([{ proposalId: 'prop-1', actions: 1 }])
      .mockResolvedValueOnce([{ executor: 'GAAA', actions: 2 }]);

    TreasuryTransaction.find
      .mockReturnValueOnce(findChain([{ transactionId: 'treasury-1', amount: 100 }]))
      .mockReturnValueOnce(findChain([{ transactionId: 'gov-1', governanceProposalId: 'prop-1' }]));

    IndexedEvent.aggregate
      .mockResolvedValueOnce([{ topic: 'vote_cast', count: 4, latestLedger: 10 }])
      .mockResolvedValueOnce([{ period: '2026-06-16', events: 4 }]);
  });

  test('getInstitutionalDashboard returns market, treasury, and governance report families', async () => {
    const req = { query: { timeframe: '30d', category: 'crypto', limit: '5' } };
    const res = mockResponse();

    await ReportingController.getInstitutionalDashboard(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const payload = res.json.mock.calls[0][0].data;
    expect(payload.metadata.timeframe).toBe('30d');
    expect(payload.metadata.filters.category).toBe('crypto');
    expect(payload.marketExposure.summary.totalCostBasis).toBe(900);
    expect(payload.treasury.summary.totalBalance).toBe(3800);
    expect(payload.governanceActivity.summary.indexedGovernanceEvents).toBe(4);
  });

  test('getReportOptions caps unsafe limits and defaults unsupported timeframes', () => {
    const options = ReportingController.getReportOptions({ timeframe: 'bad', limit: '5000' });
    expect(options.timeframe).toBe('30d');
    expect(options.limit).toBe(100);
  });
});
