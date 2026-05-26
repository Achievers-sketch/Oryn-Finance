import { describe, expect, it } from 'vitest';
import { Market } from '@/data/mockData';
import { getRecommendationGroups, normalizeMarket } from '@/lib/recommendations';

const baseMarket: Market = {
  id: 'base',
  question: 'Base market?',
  category: 'Other',
  yesPrice: 0.5,
  noPrice: 0.5,
  volume: 100,
  liquidity: 1000,
  expirationDate: '2026-12-31',
  status: 'Active',
  creator: 'GBASE',
  createdAt: '2026-01-01',
  traders: 1,
  resolutionSource: 'manual',
  tags: [],
};

function market(overrides: Partial<Market>): Market {
  return { ...baseMarket, ...overrides };
}

describe('recommendations', () => {
  it('prioritizes markets related to a user trade history', () => {
    const groups = getRecommendationGroups(
      [
        market({ id: 'crypto-pick', category: 'Crypto', volume: 500, tags: ['btc'] }),
        market({ id: 'sports-pick', category: 'Sports', volume: 500000 }),
        market({ id: 'economics-pick', category: 'Economics', volume: 1000 }),
      ],
      [
        {
          marketId: {
            marketId: 'previous-crypto',
            category: 'crypto',
            tags: ['btc'],
          },
        },
      ],
      2,
    );

    expect(groups[0].title).toBe('Recommended For You');
    expect(groups[0].markets.map((item) => item.id)).toContain('crypto-pick');
  });

  it('falls back to trending recommendations without trade history', () => {
    const groups = getRecommendationGroups(
      [
        market({ id: 'quiet', status: 'Active', volume: 100 }),
        market({ id: 'trending', status: 'Trending', volume: 50 }),
      ],
      [],
      1,
    );

    expect(groups[0].title).toBe('Recommended Markets');
    expect(groups[0].markets[0].id).toBe('trending');
  });

  it('normalizes API market payloads into homepage market cards', () => {
    const normalized = normalizeMarket({
      marketId: 'api-1',
      question: 'Will test payloads work?',
      category: 'technology',
      currentPrices: { yes: 0.7, no: 0.3 },
      totalVolume: 12000,
      initialLiquidity: 3000,
      expiresAt: '2026-09-01',
      status: 'active',
      creatorWalletAddress: 'GUSER',
      statistics: { uniqueTraders: 42 },
      oracleSource: 'oracle',
      metadata: { description: 'Description' },
      tags: ['ai'],
    });

    expect(normalized).toMatchObject({
      id: 'api-1',
      category: 'Technology',
      yesPrice: 0.7,
      noPrice: 0.3,
      volume: 12000,
      traders: 42,
      tags: ['ai'],
    });
  });
});
