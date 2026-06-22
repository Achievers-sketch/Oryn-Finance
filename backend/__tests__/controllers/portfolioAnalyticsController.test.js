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
