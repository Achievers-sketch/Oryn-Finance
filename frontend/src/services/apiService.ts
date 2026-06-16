import { apiClient } from '@/lib/api-client';
import { ENDPOINTS, ApiResponse, HealthResponse, NetworkInfo, TransactionBuildResponse } from '@/lib/api-config';

// Health & Status Services
export const healthService = {
  // Check backend health
  async getHealth(): Promise<HealthResponse> {
    const response = await apiClient.get<HealthResponse>(ENDPOINTS.HEALTH);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get health status');
    }
    return response.data!;
  },

  // Check contract integration status
  async getContractsHealth(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.HEALTH_CONTRACTS);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get contracts status');
    }
    return response.data;
  },

  // Test backend connectivity
  async testConnection() {
    return apiClient.testConnection();
  },
};

// Network & Transaction Services
export const networkService = {
  // Get network information
  async getNetworkInfo(): Promise<NetworkInfo> {
    const response = await apiClient.get<NetworkInfo>(ENDPOINTS.NETWORK_INFO);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get network info');
    }
    return response.data!;
  },

  // Get current ledger
  async getCurrentLedger(): Promise<number> {
    const response = await apiClient.get<{ currentLedger: number }>(ENDPOINTS.CURRENT_LEDGER);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get current ledger');
    }
    return response.data!.currentLedger ?? (response.data as any).ledger;
  },

  // Get transaction status
  async getTransactionStatus(txHash: string): Promise<any> {
    const endpoint = typeof ENDPOINTS.TRANSACTION_STATUS === 'function'
      ? ENDPOINTS.TRANSACTION_STATUS(txHash)
      : `/transactions/status/${txHash}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get transaction status');
    }
    return response.data;
  },
};

// Transaction Building Services
export const transactionService = {
  // Build create market transaction
  async buildCreateMarket(data: {
    question: string;
    category: string;
    expiryTimestamp: number;
    initialLiquidity: number;
    marketContract?: string;
    poolAddress?: string;
    yesToken?: string;
    noToken?: string;
  }, walletAddress: string): Promise<TransactionBuildResponse> {
    // Use wallet address directly as auth token (testing mode)
    apiClient.setAuthToken(walletAddress);
    
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_CREATE_MARKET, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build create market transaction');
    }
    return response.data!;
  },

  // Build buy tokens transaction
  async buildBuyTokens(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_BUY_TOKENS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build buy tokens transaction');
    }
    return response.data!;
  },

  // Build sell tokens transaction
  async buildSellTokens(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_SELL_TOKENS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build sell tokens transaction');
    }
    return response.data!;
  },

  // Build swap transaction
  async buildSwap(data: {
    fromToken: string;
    toToken: string;
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_SWAP, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build swap transaction');
    }
    return response.data!;
  },

  async buildClaimWinnings(data: {
    marketContract: string;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_CLAIM_WINNINGS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build claim winnings transaction');
    }
    return response.data!;
  },

  async buildAddLiquidity(data: {
    tokenA: string;
    tokenB: string;
    amountA: number;
    amountB: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_ADD_LIQUIDITY, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build add liquidity transaction');
    }
    return response.data!;
  },

  async buildStake(data: {
    amount: number;
    lockPeriod: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_STAKE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build stake transaction');
    }
    return response.data!;
  },

  async buildVote(data: {
    proposalId: number | string;
    choice: 'YES' | 'NO' | 'ABSTAIN';
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_VOTE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build vote transaction');
    }
    return response.data!;
  },

  async getGovernanceProposals(): Promise<any[]> {
    const response = await apiClient.get<any[]>(ENDPOINTS.GOVERNANCE_PROPOSALS);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch governance proposals');
    }
    return response.data || [];
  },

  // Submit signed transaction
  async submitTransaction(data: {
    xdr: string;
    networkPassphrase?: string;
  }): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.SUBMIT_TRANSACTION, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to submit transaction');
    }
    return response.data;
  },

  // Submit signed transaction to Stellar network
  async submitSignedTransaction(data: {
    signedXdr: string;
  }): Promise<any> {
    const response = await apiClient.post('/transactions/submit', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to submit signed transaction');
    }
    return response.data;
  },
};

// Market Services
export const marketService = {
  // Get markets sorted by liquidity
  async getMarketsByLiquidity(filters?: { category?: string; page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString()
      ? `/markets/sort/liquidity?${queryParams}`
      : '/markets/sort/liquidity';
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch markets by liquidity');
    return response.data;
  },

  // Get markets sorted by momentum
  async getMarketsByMomentum(filters?: { category?: string; timeframe?: string; page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString()
      ? `/markets/sort/momentum?${queryParams}`
      : '/markets/sort/momentum';
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch markets by momentum');
    return response.data;
  },

  // Get markets sorted by activity
  async getMarketsByActivity(filters?: { category?: string; page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString()
      ? `/markets/sort/activity?${queryParams}`
      : '/markets/sort/activity';
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch markets by activity');
    return response.data;
  },

  // Get markets with enhanced trending algorithm
  async getTrendingMarketsV2(filters?: { limit?: number; timeframe?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString()
      ? `/markets/trending/v2?${queryParams}`
      : '/markets/trending/v2';
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch trending markets v2');
    return response.data;
  },
  // Get all markets
  async getMarkets(filters?: {
    category?: string;
    status?: string;
    region?: string;
    archived?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `${ENDPOINTS.MARKETS}?${queryParams}`
      : ENDPOINTS.MARKETS;
      
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch markets');
    }
    
    // Return the nested data structure from the API
    return response.data;
  },

  // Get market by ID
  async getMarket(id: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.MARKET_DETAIL(id));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market');
    }
    return response.data;
  },

  async getMarketsByRegion(region: string, filters?: { page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.MARKET_BY_REGION(region)}?${queryParams}`
      : ENDPOINTS.MARKET_BY_REGION(region);
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch regional markets');
    }
    return response.data;
  },

  async getRecommendedMarkets(params?: { region?: string; country?: string; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.MARKET_RECOMMENDED}?${queryParams}`
      : ENDPOINTS.MARKET_RECOMMENDED;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch recommended markets');
    }
    return response.data;
  },

  async getRegionStats(): Promise<any[]> {
    const response = await apiClient.get<any[]>(ENDPOINTS.MARKET_REGION_STATS);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch region stats');
    }
    return response.data!;
  },

  // Get historical market prices and volume
  async getMarketHistory(id: string, params?: {
    resolution?: '5m' | '15m' | '1h' | '1d';
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.MARKET_HISTORY(id)}?${queryParams}`
      : ENDPOINTS.MARKET_HISTORY(id);

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market history');
    }
    return response.data;
  },

  // Get market trades
  async getMarketTrades(id: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(ENDPOINTS.MARKET_TRADES(id));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market trades');
    }
    return response.data!;
  },
};

// User Services
export const userService = {
  // Get user profile
  async getProfile(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.USER_PROFILE);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user profile');
    }
    return response.data;
  },

  // Update user profile
  async updateProfile(data: any, authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.USER_PROFILE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update profile');
    }
    return response.data;
  },

  // Get user by wallet address
  async getUserByAddress(address: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.USER_BY_ADDRESS(address));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user data');
    }
    return response.data;
  },

  async getPublicReputation(address: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.USER_REPUTATION_BY_ADDRESS(address));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user reputation');
    }
    return response.data;
  },

  // Watchlist / Favorite Markets
  async getFavoriteMarkets(authToken: string, filters?: { page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const endpoint = queryParams.toString()
      ? `/users/favorites?${queryParams}`
      : '/users/favorites';
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch favorite markets');
    }
    return response.data;
  },

  async addFavoriteMarket(authToken: string, marketId: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post('/users/favorites', { marketId });
    if (!response.success) {
      throw new Error(response.message || 'Failed to add favorite market');
    }
    return response.data;
  },

  async removeFavoriteMarket(authToken: string, marketId: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.delete(`/users/favorites/${marketId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to remove favorite market');
    }
    return response.data;
  },

  async getUserPositions(authToken: string, filters?: { status?: string; page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.USER_POSITIONS}?${queryParams}`
      : ENDPOINTS.USER_POSITIONS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user positions');
    }
    return response.data;
  },

  async getUserStats(authToken: string, filters?: { timeframe?: string; marketId?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.USER_STATS}?${queryParams}`
      : ENDPOINTS.USER_STATS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user stats');
    }
    return response.data;
  },
};

// Trade Services
export const tradeService = {
  // Calculate swap output with slippage protection
  async calculateSwapOutput(data: {
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    slippageTolerance?: number;
  }): Promise<any> {
    const response = await apiClient.post('/trades/calculate-swap', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to calculate swap output');
    }
    return response.data;
  },

  // Get trade history
  async getTradeHistory(authToken: string, filters?: {
    marketId?: string;
    tokenType?: 'yes' | 'no';
    tradeType?: 'buy' | 'sell';
    status?: 'all' | 'confirmed' | 'partially_filled' | 'pending' | 'failed' | 'cancelled';
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    outcome?: 'won' | 'lost' | 'pending';
    search?: string;
    sortBy?: 'timestamp' | 'amount' | 'totalCost' | 'price';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `/trades/history?${queryParams}`
      : '/trades/history';
      
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch trade history');
    }
    return response.data;
  },

  // Execute trade
  async executeTrade(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    action: 'buy' | 'sell';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post('/trades', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to execute trade');
    }
    return response.data;
  },

  // Get single trade by ID
  async getTradeById(tradeId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.TRADE_DETAIL(tradeId));
    if (!response.success) {
      throw new Error(response.message || 'Trade not found');
    }
    return response.data;
  },
};

// Leaderboard Services
export const leaderboardService = {
  async getReputationLeaderboard(limit = 50): Promise<any[]> {
    const endpoint = `${ENDPOINTS.REPUTATION_LEADERBOARD}?limit=${limit}`;
    const response = await apiClient.get<any[]>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch reputation leaderboard');
    }
    return response.data!;
  },

  async getAdvancedMetrics(limit = 20): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.LEADERBOARD_ADVANCED}?limit=${limit}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch advanced leaderboard metrics');
    }
    return response.data;
  },

  async getLeaderboard(params?: { limit?: number; timeframe?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `/leaderboard?${queryParams}`
      : '/leaderboard';
      
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch leaderboard');
    }
    return response.data;
  },
};

export const analyticsService = {
  async getPlatformStats(timeframe = '30d'): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.ANALYTICS_STATS}?timeframe=${timeframe}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch platform stats');
    }
    return response.data;
  },

  async getMarketTrends(params?: { timeframe?: string; interval?: string; category?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.ANALYTICS_MARKET_TRENDS}?${queryParams}`
      : ENDPOINTS.ANALYTICS_MARKET_TRENDS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market trends');
    }
    return response.data;
  },

  async getPriceTrends(params?: { timeframe?: string; interval?: string; marketId?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.ANALYTICS_PRICE_TRENDS}?${queryParams}`
      : ENDPOINTS.ANALYTICS_PRICE_TRENDS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch price trends');
    }
    return response.data;
  },

  async getUserInsights(walletAddress: string, timeframe = '30d'): Promise<any> {
    const endpoint = `${ENDPOINTS.ANALYTICS_USER_INSIGHTS}?walletAddress=${encodeURIComponent(walletAddress)}&timeframe=${encodeURIComponent(timeframe)}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user insights');
    }
    return response.data;
  },

  async getIndexedEvents(filters?: { contractName?: string; topic?: string; marketId?: string; limit?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.INDEXED_EVENTS}?${queryParams}`
      : ENDPOINTS.INDEXED_EVENTS;

    const response = await apiClient.get<any[]>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch indexed events');
    }
    return response.data!;
  }
};

// Liquidity Services
export const liquidityService = {
  async getStats(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_STATS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch liquidity stats');
    return response.data;
  },

  async getPools(params?: { category?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.LIQUIDITY_POOLS}?${queryParams}` : ENDPOINTS.LIQUIDITY_POOLS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch liquidity pools');
    return response.data;
  },

  async getPool(marketId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_POOL(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch pool');
    return response.data;
  },

  async getDepthChart(marketId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_DEPTH(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch depth chart');
    return response.data;
  },
};

// Admin Services
export const adminService = {
  async getDashboard(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.ADMIN_DASHBOARD);
    if (!response.success) throw new Error(response.message || 'Failed to fetch admin dashboard');
    return response.data;
  },

  async getUsers(authToken: string, params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_USERS}?${queryParams}` : ENDPOINTS.ADMIN_USERS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch users');
    return response.data;
  },

  async updateUser(authToken: string, walletAddress: string, data: any): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_USER(walletAddress), data);
    if (!response.success) throw new Error(response.message || 'Failed to update user');
    return response.data;
  },

  async resolveMarket(authToken: string, marketId: string, data: { outcome: string; resolution: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_MARKETS_RESOLVE(marketId), data);
    if (!response.success) throw new Error(response.message || 'Failed to resolve market');
    return response.data;
  },

  async getPendingTrades(authToken: string, params?: { page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_TRADES_PENDING}?${queryParams}` : ENDPOINTS.ADMIN_TRADES_PENDING;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch pending trades');
    return response.data;
  },

  async updateTradeStatus(authToken: string, tradeId: string, data: { status: string; stellarTransactionHash?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_TRADE(tradeId), data);
    if (!response.success) throw new Error(response.message || 'Failed to update trade');
    return response.data;
  },

  async getConfig(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.ADMIN_CONFIG);
    if (!response.success) throw new Error(response.message || 'Failed to fetch config');
    return response.data;
  },

  async getLogs(authToken: string, params?: { level?: string; page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_LOGS}?${queryParams}` : ENDPOINTS.ADMIN_LOGS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch logs');
    return response.data;
  },
};

// Volatility Services
export const volatilityService = {
  async getVolatileMarkets(params?: { limit?: number; badge?: string; sortBy?: string; sortOrder?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.VOLATILITY_MARKETS}?${queryParams}` : ENDPOINTS.VOLATILITY_MARKETS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch volatility markets');
    return response.data;
  },

  async getMarketVolatility(id: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.VOLATILITY_MARKET(id));
    if (!response.success) throw new Error(response.message || 'Failed to fetch volatility');
    return response.data;
  },

  async getVolatilityHistory(id: string, limit?: number): Promise<any> {
    const endpoint = limit ? `${ENDPOINTS.VOLATILITY_HISTORY(id)}?limit=${limit}` : ENDPOINTS.VOLATILITY_HISTORY(id);
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch volatility history');
    return response.data;
  },

  async calculateVolatility(id: string, authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post(ENDPOINTS.VOLATILITY_CALCULATE(id));
    if (!response.success) throw new Error(response.message || 'Failed to calculate volatility');
    return response.data;
  },
};

// Treasury Services
export const treasuryService = {
  async getOverview(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.TREASURY_OVERVIEW);
    if (!response.success) throw new Error(response.message || 'Failed to fetch treasury overview');
    return response.data;
  },

  async getSummary(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.TREASURY_SUMMARY);
    if (!response.success) throw new Error(response.message || 'Failed to fetch treasury summary');
    return response.data;
  },

  async getInflows(params?: { limit?: number; type?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.TREASURY_INFLOWS}?${queryParams}` : ENDPOINTS.TREASURY_INFLOWS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch inflows');
    return response.data;
  },

  async getOutflows(params?: { limit?: number; type?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.TREASURY_OUTFLOWS}?${queryParams}` : ENDPOINTS.TREASURY_OUTFLOWS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch outflows');
    return response.data;
  },

  async getGovernanceActions(params?: { limit?: number; status?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.TREASURY_GOV_ACTIONS}?${queryParams}` : ENDPOINTS.TREASURY_GOV_ACTIONS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch governance actions');
    return response.data;
  },
};

// Institutional Reporting Services
export const reportingService = {
  buildQuery(params?: { timeframe?: string; category?: string; limit?: number }): string {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    return queryParams.toString();
  },

  async getInstitutionalDashboard(params?: { timeframe?: string; category?: string; limit?: number }): Promise<any> {
    const query = this.buildQuery(params);
    const endpoint = query ? `${ENDPOINTS.REPORTS_INSTITUTIONAL}?${query}` : ENDPOINTS.REPORTS_INSTITUTIONAL;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch institutional reports');
    return response.data;
  },

  async getMarketExposure(params?: { timeframe?: string; category?: string; limit?: number }): Promise<any> {
    const query = this.buildQuery(params);
    const endpoint = query ? `${ENDPOINTS.REPORTS_MARKET_EXPOSURE}?${query}` : ENDPOINTS.REPORTS_MARKET_EXPOSURE;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch market exposure report');
    return response.data;
  },

  async getTreasury(params?: { timeframe?: string; limit?: number }): Promise<any> {
    const query = this.buildQuery(params);
    const endpoint = query ? `${ENDPOINTS.REPORTS_TREASURY}?${query}` : ENDPOINTS.REPORTS_TREASURY;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch treasury report');
    return response.data;
  },

  async getGovernanceActivity(params?: { timeframe?: string; limit?: number }): Promise<any> {
    const query = this.buildQuery(params);
    const endpoint = query ? `${ENDPOINTS.REPORTS_GOVERNANCE_ACTIVITY}?${query}` : ENDPOINTS.REPORTS_GOVERNANCE_ACTIVITY;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch governance activity report');
    return response.data;
  },
};

// Contract Operations Services
export const contractService = {
  async getDependencyGraph(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CONTRACT_DEPENDENCIES);
    if (!response.success) throw new Error(response.message || 'Failed to fetch contract dependencies');
    return response.data;
  },

  async getDependencyFlow(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CONTRACT_DEPENDENCY_FLOW);
    if (!response.success) throw new Error(response.message || 'Failed to fetch contract dependency flow');
    return response.data;
  },

  async getDependencyConflicts(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CONTRACT_DEPENDENCY_CONFLICTS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch contract dependency conflicts');
    return response.data;
  },

  async getVersions(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CONTRACT_VERSIONS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch contract versions');
    return response.data;
  },

  async getVersionAudit(minimum = '1.0.0'): Promise<any> {
    const endpoint = `${ENDPOINTS.CONTRACT_VERSIONS_AUDIT}?minimum=${encodeURIComponent(minimum)}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch contract version audit');
    return response.data;
  },

  async compareVersions(a: string, b: string): Promise<any> {
    const endpoint = `${ENDPOINTS.CONTRACT_VERSIONS_COMPARE}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to compare versions');
    return response.data;
  },

  async getOracleHealth(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.ORACLE_HEALTH);
    if (!response.success) throw new Error(response.message || 'Failed to fetch oracle health');
    return response.data;
  },
};

// Liquidity Position Services
export const liquidityPositionService = {
  async getUserPositions(authToken: string, params?: { status?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.LIQUIDITY_POSITIONS}?${queryParams}` : ENDPOINTS.LIQUIDITY_POSITIONS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch LP positions');
    return response.data;
  },

  async getMarketPosition(authToken: string, marketId: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_POSITION(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch LP position');
    return response.data;
  },

  async getPortfolioMetrics(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_METRICS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch LP metrics');
    return response.data;
  },

  async createPosition(authToken: string, data: {
    marketId: string;
    depositedYesAmount: number;
    depositedNoAmount: number;
    lpTokens?: number;
    shareOfPool?: number;
  }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post(ENDPOINTS.LIQUIDITY_CREATE_POSITION, data);
    if (!response.success) throw new Error(response.message || 'Failed to create LP position');
    return response.data;
  },

  async recordFeeEarned(authToken: string, positionId: string, amount: number, source?: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post(ENDPOINTS.LIQUIDITY_RECORD_FEE(positionId), { amount, source });
    if (!response.success) throw new Error(response.message || 'Failed to record fee');
    return response.data;
  },

  async calculateImpermanentLoss(authToken: string, positionId: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post(ENDPOINTS.LIQUIDITY_CALCULATE_IL(positionId));
    if (!response.success) throw new Error(response.message || 'Failed to calculate IL');
    return response.data;
  },
};

// Cross-Chain Monitoring Services (#119)
export const crossChainService = {
  async trackTransaction(data: { txId: string; status?: string; bridgeChain?: string; amount?: number; walletAddress?: string }): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.CROSS_CHAIN_TRACK, data);
    if (!response.success) throw new Error(response.message || 'Failed to track transaction');
    return response.data;
  },
  async listTransactions(params?: { walletAddress?: string; status?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => v && q.append(k, v));
    const endpoint = q.toString() ? `${ENDPOINTS.CROSS_CHAIN_LIST}?${q}` : ENDPOINTS.CROSS_CHAIN_LIST;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to list transactions');
    return response.data;
  },
  async getFailures(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CROSS_CHAIN_FAILURES);
    if (!response.success) throw new Error(response.message || 'Failed to fetch failures');
    return response.data;
  },
  async getStats(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CROSS_CHAIN_STATS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch stats');
    return response.data;
  },
  async getTransaction(txId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.CROSS_CHAIN_TX(txId));
    if (!response.success) throw new Error(response.message || 'Transaction not found');
    return response.data;
  },
  async recoverTransaction(txId: string): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.CROSS_CHAIN_RECOVER(txId), {});
    if (!response.success) throw new Error(response.message || 'Recovery failed');
    return response.data;
  },
};

// Insurance Claim Services (#118)
export const insuranceService = {
  async submitClaim(data: { walletAddress: string; policyId: string; incidentType: string; description?: string; requestedAmount: number }): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.INSURANCE_CLAIMS, data);
    if (!response.success) throw new Error(response.message || 'Failed to submit claim');
    return response.data;
  },
  async listClaims(params?: { walletAddress?: string; status?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => v && q.append(k, v));
    const endpoint = q.toString() ? `${ENDPOINTS.INSURANCE_CLAIMS}?${q}` : ENDPOINTS.INSURANCE_CLAIMS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to list claims');
    return response.data;
  },
  async getClaim(claimId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.INSURANCE_CLAIM(claimId));
    if (!response.success) throw new Error(response.message || 'Claim not found');
    return response.data;
  },
  async reviewClaim(claimId: string, data: { decision: 'approved' | 'rejected'; payoutAmount?: number; reviewNote?: string }): Promise<any> {
    const response = await apiClient.put(ENDPOINTS.INSURANCE_CLAIM_REVIEW(claimId), data);
    if (!response.success) throw new Error(response.message || 'Failed to review claim');
    return response.data;
  },
  async processPayout(claimId: string): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.INSURANCE_CLAIM_PAYOUT(claimId), {});
    if (!response.success) throw new Error(response.message || 'Failed to process payout');
    return response.data;
  },
  async getStats(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.INSURANCE_STATS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch insurance stats');
    return response.data;
  },
};

// Risk Analytics Services (#117)
export const riskService = {
  async getRiskExposure(walletAddress: string): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.RISK_EXPOSURE}?walletAddress=${encodeURIComponent(walletAddress)}`);
    if (!response.success) throw new Error(response.message || 'Failed to fetch risk exposure');
    return response.data;
  },
  async getDiversification(walletAddress: string): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.RISK_DIVERSIFICATION}?walletAddress=${encodeURIComponent(walletAddress)}`);
    if (!response.success) throw new Error(response.message || 'Failed to fetch diversification');
    return response.data;
  },
  async getVolatility(walletAddress: string): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.RISK_VOLATILITY}?walletAddress=${encodeURIComponent(walletAddress)}`);
    if (!response.success) throw new Error(response.message || 'Failed to fetch volatility');
    return response.data;
  },
};

// Market Sentiment Services (#116, #162)
export const sentimentService = {
  async getAggregated(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.SENTIMENT_AGGREGATED);
    if (!response.success) throw new Error(response.message || 'Failed to fetch sentiment');
    return response.data;
  },
  async getHistory(limit?: number): Promise<any> {
    const endpoint = limit ? `${ENDPOINTS.SENTIMENT_HISTORY}?limit=${limit}` : ENDPOINTS.SENTIMENT_HISTORY;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch sentiment history');
    return response.data;
  },
  async getMarketSentiment(marketId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.SENTIMENT_MARKET(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch market sentiment');
    return response.data;
  },
};

// Oracle Consensus Services (#164)
export const oracleConsensusService = {
  async getConsensus(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.ORACLE_CONSENSUS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch oracle consensus');
    return response.data;
  },
};

// Liquidity Rebalancing Services (#163)
export const liquidityRebalancingService = {
  async getSuggestions(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_REBALANCING);
    if (!response.success) throw new Error(response.message || 'Failed to fetch rebalancing suggestions');
    return response.data;
  },
};

// Governance Timelock Services (#165)
export const governanceTimelockService = {
  async getActions(status?: string): Promise<any> {
    const endpoint = status ? `${ENDPOINTS.GOVERNANCE_TIMELOCK}?status=${status}` : ENDPOINTS.GOVERNANCE_TIMELOCK;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch timelock actions');
    return response.data;
  },
  async getAction(id: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.GOVERNANCE_TIMELOCK_ACTION(id));
    if (!response.success) throw new Error(response.message || 'Timelock action not found');
    return response.data;
  },
};

// Combined API service object
export const apiService = {
  health: healthService,
  network: networkService,
  transactions: transactionService,
  markets: marketService,
  users: userService,
  trades: tradeService,
  leaderboard: leaderboardService,
  analytics: analyticsService,
  liquidity: liquidityService,
  admin: adminService,
  volatility: volatilityService,
  treasury: treasuryService,
  reports: reportingService,
  contracts: contractService,
  liquidityPositions: liquidityPositionService,
  crossChain: crossChainService,
  insurance: insuranceService,
  risk: riskService,
  sentiment: sentimentService,
  oracleConsensus: oracleConsensusService,
  liquidityRebalancing: liquidityRebalancingService,
  governanceTimelock: governanceTimelockService,
};
