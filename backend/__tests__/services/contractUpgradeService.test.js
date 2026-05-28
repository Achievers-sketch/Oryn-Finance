// Import the globally mocked contracts config and populate expected functions for this test
const contractConfig = require('../../src/config/contracts');
contractConfig.CONTRACT_FUNCTIONS = {
  MARKET_FACTORY: {
    initialize: 'initialize',
    createMarket: 'create_market',
    getMarket: 'get_market',
    getAllMarkets: 'get_all_markets',
    pauseContract: 'pause_contract',
    unpauseContract: 'unpause_contract',
    grantUserRole: 'grant_user_role',
    revokeUserRole: 'revoke_user_role',
    blacklistUser: 'blacklist_user',
  }
};

const contractUpgradeService = require('../../src/services/contractUpgradeService');
const sorobanService = require('../../src/services/sorobanService');

jest.mock('../../src/services/sorobanService', () => ({
  queryContract: jest.fn()
}));

describe('ContractUpgradeService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should pass compatibility check when all required methods exist', () => {
    const mockNewAbi = {
      functions: [
        { name: 'initialize', inputs: [] },
        { name: 'create_market', inputs: [{ name: 'question', type: 'string' }] },
        { name: 'get_market', inputs: [] },
        { name: 'get_all_markets', inputs: [] },
        { name: 'pause_contract', inputs: [] },
        { name: 'unpause_contract', inputs: [] },
        { name: 'grant_user_role', inputs: [] },
        { name: 'revoke_user_role', inputs: [] },
        { name: 'blacklist_user', inputs: [] }
      ]
    };

    const report = contractUpgradeService.validateAbiCompatibility('MARKET_FACTORY', mockNewAbi);
    expect(report.isCompatible).toBe(true);
    expect(report.breakingChanges.length).toBe(0);
  });

  test('should detect additions as non-breaking changes', () => {
    const mockNewAbi = {
      functions: [
        { name: 'initialize', inputs: [] },
        { name: 'create_market', inputs: [] },
        { name: 'get_market', inputs: [] },
        { name: 'get_all_markets', inputs: [] },
        { name: 'pause_contract', inputs: [] },
        { name: 'unpause_contract', inputs: [] },
        { name: 'grant_user_role', inputs: [] },
        { name: 'revoke_user_role', inputs: [] },
        { name: 'blacklist_user', inputs: [] },
        { name: 'some_new_feature_function', inputs: [] } // Addition!
      ]
    };

    const report = contractUpgradeService.validateAbiCompatibility('MARKET_FACTORY', mockNewAbi);
    expect(report.isCompatible).toBe(true);
    expect(report.breakingChanges.length).toBe(0);
    expect(report.additions.length).toBe(1);
    expect(report.additions[0]).toContain('some_new_feature_function');
  });

  test('should fail compatibility check when a required method is missing', () => {
    const mockNewAbi = {
      functions: [
        { name: 'initialize', inputs: [] },
        // 'create_market' is missing!
        { name: 'get_market', inputs: [] },
        { name: 'get_all_markets', inputs: [] },
        { name: 'pause_contract', inputs: [] },
        { name: 'unpause_contract', inputs: [] },
        { name: 'grant_user_role', inputs: [] },
        { name: 'revoke_user_role', inputs: [] },
        { name: 'blacklist_user', inputs: [] }
      ]
    };

    const report = contractUpgradeService.validateAbiCompatibility('MARKET_FACTORY', mockNewAbi);
    expect(report.isCompatible).toBe(false);
    expect(report.breakingChanges.length).toBe(1);
    expect(report.breakingChanges[0]).toContain("Required function 'create_market'");
  });

  test('should simulate upgrading a contract successfully', async () => {
    sorobanService.queryContract.mockResolvedValue({
      result: {
        events: ['upgraded_event']
      }
    });

    const simulation = await contractUpgradeService.simulateUpgrade('C_FACTORY', 'hash_123');
    expect(simulation.success).toBe(true);
    expect(simulation.gasUsed).toBe(1);
  });

  test('should report failure when simulation returns error', async () => {
    sorobanService.queryContract.mockResolvedValue({
      error: 'WASM validation failed: missing upgrade method'
    });

    const simulation = await contractUpgradeService.simulateUpgrade('C_FACTORY', 'hash_123');
    expect(simulation.success).toBe(false);
    expect(simulation.error).toBe('WASM validation failed: missing upgrade method');
  });
});
