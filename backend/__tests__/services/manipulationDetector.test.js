const manipulationDetector = require('../../src/services/manipulationDetector');
const models = require('../../src/models');
const websocketHandler = require('../../src/services/websocketHandler');

jest.mock('../../src/models', () => {
  const mockAlertSave = jest.fn().mockImplementation(function() {
    return Promise.resolve(this);
  });
  
  function MockAlert(data) {
    this.marketId = data.marketId;
    this.userWalletAddress = data.userWalletAddress;
    this.alertType = data.alertType;
    this.severity = data.severity;
    this.details = data.details;
    this.save = mockAlertSave;
  }

  const mockSelect = jest.fn().mockResolvedValue([]);
  const MockTrade = {
    find: jest.fn().mockImplementation(() => ({
      select: mockSelect
    })),
    findOne: jest.fn().mockResolvedValue(null),
    countDocuments: jest.fn().mockResolvedValue(0),
    _mockSelect: mockSelect
  };

  return {
    Trade: MockTrade,
    Alert: MockAlert,
    Market: {}
  };
});

jest.mock('../../src/services/websocketHandler', () => ({
  io: {
    emit: jest.fn()
  }
}));

describe('ManipulationDetector Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish default return values that might be reset by resetMocks
    models.Trade._mockSelect.mockResolvedValue([]);
    models.Trade.find.mockImplementation(() => ({
      select: models.Trade._mockSelect
    }));
    models.Trade.findOne.mockResolvedValue(null);
    models.Trade.countDocuments.mockResolvedValue(0);
  });

  test('should return empty alerts for normal small trades', async () => {
    models.Trade._mockSelect.mockResolvedValue([
      { totalCost: 100 },
      { totalCost: 120 },
      { totalCost: 90 },
      { totalCost: 110 },
      { totalCost: 100 }
    ]);

    const normalTrade = {
      marketId: 'm1',
      userWalletAddress: 'GB_USER_A',
      amount: 100,
      price: 0.5,
      totalCost: 50,
      tradeType: 'buy',
      tokenType: 'yes',
      tradeId: 't_normal'
    };

    const alerts = await manipulationDetector.scanTrade(normalTrade);
    expect(alerts.length).toBe(0);
    expect(websocketHandler.io.emit).not.toHaveBeenCalled();
  });

  test('should trigger high severity alert on absolute high trade size', async () => {
    const hugeTrade = {
      marketId: 'm1',
      userWalletAddress: 'GB_USER_A',
      amount: 30000,
      price: 0.5,
      totalCost: 15000,
      tradeType: 'buy',
      tokenType: 'yes',
      tradeId: 't_huge'
    };

    const alerts = await manipulationDetector.scanTrade(hugeTrade);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alertType).toBe('volume_spike');
    expect(alerts[0].severity).toBe('high');
    expect(websocketHandler.io.emit).toHaveBeenCalled();
  });

  test('should trigger wash trading alert if user executes opposing trades within 5 minutes', async () => {
    // Mock finding a previous opposing trade
    models.Trade.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        tradeId: 't_prev',
        tradeType: 'sell',
        tokenType: 'yes',
        timestamp: new Date(Date.now() - 60 * 1000)
      })
    });

    const currentTrade = {
      marketId: 'm1',
      userWalletAddress: 'GB_USER_A',
      amount: 100,
      price: 0.5,
      totalCost: 50,
      tradeType: 'buy',
      tokenType: 'yes',
      tradeId: 't_current'
    };

    const alerts = await manipulationDetector.scanTrade(currentTrade);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alertType).toBe('wash_trading');
    expect(alerts[0].severity).toBe('high');
  });

  test('should trigger order spamming alert if user executes >= 5 trades in a minute', async () => {
    // 4 previous trades + the current one = 5 trades in a minute
    models.Trade.countDocuments.mockResolvedValue(4);

    const currentTrade = {
      marketId: 'm1',
      userWalletAddress: 'GB_USER_A',
      amount: 10,
      price: 0.5,
      totalCost: 5,
      tradeType: 'buy',
      tokenType: 'yes',
      tradeId: 't_spam'
    };

    const alerts = await manipulationDetector.scanTrade(currentTrade);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alertType).toBe('order_spam');
    expect(alerts[0].severity).toBe('medium');
  });
});
