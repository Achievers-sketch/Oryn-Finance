import { apiClient } from '@/lib/api-client';
import { ENDPOINTS } from '@/lib/api-config';

type MarketFilters = {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  search?: string;
};

function buildQuery(filters?: MarketFilters) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  return params.toString();
}

export const marketService = {
  async getMarkets(filters?: MarketFilters) {
    const query = buildQuery(filters);
    const endpoint = query ? `${ENDPOINTS.MARKETS}?${query}` : ENDPOINTS.MARKETS;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch markets');
    }

    return {
      data: response.data?.markets || response.data || [],
      pagination: response.data?.pagination || (response as any).pagination,
    };
  },

  async getMarketById(id: string) {
    const response = await apiClient.get(`${ENDPOINTS.MARKETS}/${id}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market');
    }
    return response.data;
  },

  async createMarket(data: Record<string, unknown>) {
    const response = await apiClient.post(ENDPOINTS.MARKETS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to create market');
    }
    return response.data;
  },
};

export default marketService;
