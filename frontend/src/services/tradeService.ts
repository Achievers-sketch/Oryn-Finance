import { apiClient } from '@/lib/api-client';
import { ENDPOINTS } from '@/lib/api-config';

type PlaceTradeInput = {
  marketId: string;
  outcome?: 'yes' | 'no';
  tokenType?: 'yes' | 'no';
  amount: number;
};

export const tradeService = {
  async placeTrade(data: PlaceTradeInput) {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Trade amount must be positive');
    }

    const response = await apiClient.post(ENDPOINTS.TRADES, {
      ...data,
      tokenType: data.tokenType || data.outcome,
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to place trade');
    }
    return response.data;
  },

  async getTrades(filters?: Record<string, unknown>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = params.toString() ? `${ENDPOINTS.TRADES}?${params}` : ENDPOINTS.TRADES;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch trades');
    }

    return {
      data: response.data?.trades || response.data || [],
      pagination: response.data?.pagination || (response as any).pagination,
    };
  },
};

export default tradeService;
