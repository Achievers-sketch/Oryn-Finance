// API Configuration for Oryn Finance Backend
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:5001/api'),
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

// API Endpoints
export const ENDPOINTS = {
  // Health & Status
  HEALTH: '/health',
  HEALTH_CONTRACTS: '/health/contracts',
  
  // Network & Transactions
  NETWORK_INFO: '/transactions/network-info',
  CURRENT_LEDGER: '/transactions/current-ledger',
  TRANSACTION_STATUS: (txHash: string) => `/transactions/status/${txHash}`,
  GOVERNANCE_PROPOSALS: '/transactions/governance/proposals',
  
  // Transaction Building
  BUILD_CREATE_MARKET: '/transactions/build/create-market',
  BUILD_BUY_TOKENS: '/transactions/build/buy-tokens',
  BUILD_SELL_TOKENS: '/transactions/build/sell-tokens',
  BUILD_CLAIM_WINNINGS: '/transactions/build/claim-winnings',
  BUILD_SWAP: '/transactions/build/swap',
  BUILD_ADD_LIQUIDITY: '/transactions/build/add-liquidity',
  BUILD_STAKE: '/transactions/build/stake',
  BUILD_VOTE: '/transactions/build/vote',
  BUILD_PURCHASE_INSURANCE: '/transactions/build/purchase-insurance',
  BUILD_SUBMIT_PRIVATE_ORDER: '/transactions/build/submit-private-order',
  
  // Transaction Submission
  SUBMIT_TRANSACTION: '/transactions/submit',
  
  // Markets
  MARKETS: '/markets',
  MARKET_DETAIL: (id: string) => `/markets/${id}`,
  MARKET_HISTORY: (id: string) => `/markets/${id}/history`,
  MARKET_TRADES: (id: string) => `/markets/${id}/trades`,
  
  // Trades
  TRADES: '/trades',
  TRADE_DETAIL: (tradeId: string) => `/trades/${tradeId}`,
  TRADE_HISTORY: '/trades/history',
  RECENT_TRADES: '/trades/recent',
  
  // Users
  USERS: '/users',
  USER_PROFILE: '/users/profile',
  USER_BY_ADDRESS: (address: string) => `/users/${address}`,
  USER_REPUTATION_BY_ADDRESS: (address: string) => `/users/${address}/reputation`,
  USER_POSITIONS: '/users/positions',
  USER_STATS: '/users/stats',
  
  // Leaderboard
  LEADERBOARD: '/leaderboard',
  REPUTATION_LEADERBOARD: '/leaderboard/reputation',
  LEADERBOARD_ADVANCED: '/leaderboard/advanced-metrics',

  // Push Notifications
  PUSH_VAPID_KEY: '/push/vapid-public-key',
  PUSH_SUBSCRIBE: '/push/subscribe',
  
  // Analytics
  ANALYTICS: '/analytics',
  ANALYTICS_STATS: '/analytics/stats',
  ANALYTICS_MARKET_TRENDS: '/analytics/market-trends',
  ANALYTICS_PRICE_TRENDS: '/analytics/price-trends',
  ANALYTICS_USER_INSIGHTS: '/analytics/user-insights',
  INDEXED_EVENTS: '/analytics/events',

  // Liquidity
  LIQUIDITY_STATS: '/liquidity/stats',
  LIQUIDITY_POOLS: '/liquidity/pools',
  LIQUIDITY_POOL: (marketId: string) => `/liquidity/pools/${marketId}`,
  LIQUIDITY_DEPTH: (marketId: string) => `/liquidity/pools/${marketId}/depth`,
  YIELD_COMPARISON: '/yield/comparison',
  YIELD_HISTORY: (marketId: string) => `/yield/history/${marketId}`,

  // Markets - Extended
  MARKET_BY_REGION: (region: string) => `/markets/region/${region}`,
  MARKET_RECOMMENDED: '/markets/recommended',
  MARKET_REGION_STATS: '/markets/region-stats',

  // Volatility
  VOLATILITY_MARKETS: '/volatility/markets',
  VOLATILITY_MARKET: (id: string) => `/volatility/market/${id}`,
  VOLATILITY_HISTORY: (id: string) => `/volatility/market/${id}/history`,
  VOLATILITY_CALCULATE: (id: string) => `/volatility/market/${id}/calculate`,

  // Treasury
  TREASURY_OVERVIEW: '/treasury/overview',
  TREASURY_SUMMARY: '/treasury/summary',
  TREASURY_INFLOWS: '/treasury/inflows',
  TREASURY_OUTFLOWS: '/treasury/outflows',
  TREASURY_GOV_ACTIONS: '/treasury/governance-actions',
  TREASURY_RECORD_INFLOW: '/treasury/inflows',
  TREASURY_RECORD_OUTFLOW: '/treasury/distributions',
  TREASURY_RECORD_GOV_ACTION: '/treasury/governance-actions',

  // Audit Logs (Issue #194)
  AUDIT_LOGS: '/audit',
  AUDIT_STATS: '/audit/stats',
  AUDIT_EXPORT: '/audit/export',

  // Institutional Reports
  REPORTS_INSTITUTIONAL: '/reports/institutional',
  REPORTS_MARKET_EXPOSURE: '/reports/market-exposure',
  REPORTS_TREASURY: '/reports/treasury',
  REPORTS_GOVERNANCE_ACTIVITY: '/reports/governance-activity',

  // Contracts
  CONTRACT_DEPENDENCIES: '/contracts/dependencies',
  CONTRACT_DEPENDENCY_FLOW: '/contracts/dependencies/flow',
  CONTRACT_DEPENDENCY_CONFLICTS: '/contracts/dependencies/conflicts',
  CONTRACT_VERSIONS: '/contracts/versions',
  CONTRACT_VERSIONS_AUDIT: '/contracts/versions/audit',
  CONTRACT_VERSIONS_COMPARE: '/contracts/versions/compare',

  // Oracle
  ORACLE_HEALTH: '/oracle/health',

  // Liquidity Positions
  LIQUIDITY_POSITIONS: '/liquidity-positions/positions',
  LIQUIDITY_POSITION: (marketId: string) => `/liquidity-positions/positions/${marketId}`,
  LIQUIDITY_METRICS: '/liquidity-positions/metrics',
  LIQUIDITY_CREATE_POSITION: '/liquidity-positions/positions',
  LIQUIDITY_RECORD_FEE: (positionId: string) => `/liquidity-positions/positions/${positionId}/fees`,
  LIQUIDITY_CALCULATE_IL: (positionId: string) => `/liquidity-positions/positions/${positionId}/calculate-il`,

  // Cross-Chain Monitoring (#119)
  CROSS_CHAIN_TRACK: '/cross-chain/track',
  CROSS_CHAIN_LIST: '/cross-chain/list',
  CROSS_CHAIN_FAILURES: '/cross-chain/failures',
  CROSS_CHAIN_STATS: '/cross-chain/stats',
  CROSS_CHAIN_TX: (txId: string) => `/cross-chain/tx/${txId}`,
  CROSS_CHAIN_RECOVER: (txId: string) => `/cross-chain/tx/${txId}/recover`,

  // Insurance Claims (#118)
  INSURANCE_CLAIMS: '/insurance/claims',
  INSURANCE_CLAIM: (claimId: string) => `/insurance/claims/${claimId}`,
  INSURANCE_CLAIM_REVIEW: (claimId: string) => `/insurance/claims/${claimId}/review`,
  INSURANCE_CLAIM_PAYOUT: (claimId: string) => `/insurance/claims/${claimId}/payout`,
  INSURANCE_STATS: '/insurance/claims/stats',

  // Risk Analytics (#117)
  RISK_EXPOSURE: '/risk/exposure',
  RISK_DIVERSIFICATION: '/risk/diversification',
  RISK_VOLATILITY: '/risk/volatility',

  // Market Sentiment (#116, #162)
  SENTIMENT_AGGREGATED: '/sentiment/aggregated',
  SENTIMENT_HISTORY: '/sentiment/history',
  SENTIMENT_MARKET: (marketId: string) => `/sentiment/market/${marketId}`,

  // Oracle Consensus (#164)
  ORACLE_CONSENSUS: '/oracle/consensus',

  // Liquidity Rebalancing (#163)
  LIQUIDITY_REBALANCING: '/liquidity/rebalancing',

  // Governance Timelock (#165)
  GOVERNANCE_TIMELOCK: '/governance/timelock',
  GOVERNANCE_TIMELOCK_ACTION: (id: string) => `/governance/timelock/${id}`,

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER: (walletAddress: string) => `/admin/users/${walletAddress}`,
  ADMIN_MARKETS_RESOLVE: (marketId: string) => `/admin/markets/${marketId}/resolve`,
  ADMIN_TRADES_PENDING: '/admin/trades/pending',
  ADMIN_TRADE: (tradeId: string) => `/admin/trades/${tradeId}`,
  ADMIN_CONFIG: '/admin/config',
  ADMIN_LOGS: '/admin/logs',
};

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  responseTime: string;
  services: {
    database: {
      status: string;
      host: string;
    };
    stellar: {
      status: string;
      network: string;
      latestLedger: number;
    };
    soroban: {
      isConnected: boolean;
      network: string;
      rpcUrl: string;
      contracts: {
        total: number;
        deployed: number;
      };
    };
  };
}

export interface NetworkInfo {
  network: string;
  passphrase: string;
  rpcUrl: string;
  latestLedger: number;
  horizonUrl: string;
}

export interface TransactionBuildResponse {
  xdr: string;
  fees: number;
  simulation: any;
}
