const PortfolioAnalyticsController = require('../../../src/controllers/portfolioAnalyticsController');
const Trade = require('../../../src/models/Trade');

jest.mock('../../../src/models/Trade');
jest.mock('../../../src/config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('PortfolioAnalyticsController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPerformanceSeries', () => {
    it('returns series data for valid wallet address', async () => {
      const mockSeries = [{ date: '2024-01-01', totalCost: 100, tradeCount: 2, avgPrice: 0.5, totalFees: 1 }];
      Trade.aggregate = jest.fn().mockResolvedValue(mockSeries);
      const req = { params: { walletAddress: 'GTEST' }, query: { timeframe: '30d' } };
      const res = mockRes();
      await PortfolioAnalyticsController.getPerformanceSeries(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 500 on aggregate error', async () => {
      Trade.aggregate = jest.fn().mockRejectedValue(new Error('db error'));
      const req = { params: { walletAddress: 'GTEST' }, query: {} };
      const res = mockRes();
      await PortfolioAnalyticsController.getPerformanceSeries(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllocation', () => {
    it('returns allocation with percentages', async () => {
      Trade.aggregate = jest.fn().mockResolvedValue([
        { tokenType: 'yes', totalCost: 75, tradeCount: 3 },
        { tokenType: 'no',  totalCost: 25, tradeCount: 1 },
      ]);
      const req = { params: { walletAddress: 'GTEST' }, query: { timeframe: '7d' } };
      const res = mockRes();
      await PortfolioAnalyticsController.getAllocation(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
