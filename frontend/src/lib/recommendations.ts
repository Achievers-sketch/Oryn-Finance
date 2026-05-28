import { Market } from '@/data/mockData';

type MarketInput = Partial<Market> & Record<string, any>;
type TradeInput = Record<string, any>;

export interface RecommendationGroup {
  title: string;
  subtitle: string;
  markets: Market[];
}

const CATEGORY_WEIGHTS: Record<string, string[]> = {
  Crypto: ['Economics', 'Technology'],
  Economics: ['Crypto', 'Politics'],
  Politics: ['Economics'],
  Sports: ['Entertainment'],
  Entertainment: ['Sports', 'Technology'],
  Technology: ['Crypto', 'Economics'],
  Other: [],
};

function titleCase(value: unknown): Market['category'] {
  const normalized = String(value || 'Other').trim().toLowerCase();
  const category = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  if (['Crypto', 'Sports', 'Politics', 'Entertainment', 'Technology', 'Economics'].includes(category)) {
    return category as Market['category'];
  }

  return 'Other';
}

export function normalizeMarket(market: MarketInput, index = 0): Market {
  const currentPrices = market.currentPrices || {};
  const yesPrice = Number(currentPrices.yes ?? market.currentYesPrice ?? market.yesPrice ?? 0.5);
  const noPrice = Number(currentPrices.no ?? market.currentNoPrice ?? market.noPrice ?? 1 - yesPrice);
  const status = String(market.status || 'Active');
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return {
    id: String(market.marketId || market._id || market.id || `market_${index + 1}`),
    question: String(market.question || 'Prediction market'),
    category: titleCase(market.category),
    yesPrice,
    noPrice,
    volume: Number(market.totalVolume ?? market.volume ?? 0),
    liquidity: Number(market.initialLiquidity ?? market.liquidity ?? 0),
    expirationDate: String(market.expiresAt || market.expirationDate || market.expiryDate || new Date().toISOString()),
    status: ['Active', 'Resolved', 'Trending'].includes(normalizedStatus) ? normalizedStatus as Market['status'] : 'Active',
    creator: String(market.creatorWalletAddress || market.creator || ''),
    createdAt: String(market.createdAt || new Date().toISOString()),
    traders: Number(market.statistics?.uniqueTraders ?? market.traders ?? 0),
    resolutionSource: String(market.oracleSource || market.resolutionSource || 'manual'),
    description: market.metadata?.description || market.description || market.resolutionCriteria,
    tags: Array.isArray(market.tags) ? market.tags.map(String) : [],
  };
}

function getTradeMarket(trade: TradeInput): any {
  return trade.market || trade.marketId || trade.market_id || null;
}

function getTradeMarketId(trade: TradeInput): string | null {
  const market = getTradeMarket(trade);

  if (typeof market === 'string') {
    return market;
  }

  return market?.marketId || market?._id || market?.id || trade.marketId || trade.market_id || null;
}

function getTradeCategory(trade: TradeInput): string | null {
  const market = getTradeMarket(trade);
  const category = market?.category || trade.category || trade.marketCategory;
  return category ? titleCase(category) : null;
}

function getTradeTags(trade: TradeInput): string[] {
  const market = getTradeMarket(trade);
  const tags = market?.tags || trade.tags || [];
  return Array.isArray(tags) ? tags.map((tag) => String(tag).toLowerCase()) : [];
}

function scoreMarket(market: Market, trades: TradeInput[], tradedMarketIds: Set<string>): number {
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  trades.forEach((trade) => {
    const category = getTradeCategory(trade);
    if (category) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }

    getTradeTags(trade).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const relatedCategories = new Set<string>();
  categoryCounts.forEach((_, category) => {
    CATEGORY_WEIGHTS[category]?.forEach((related) => relatedCategories.add(related));
  });

  let score = 0;
  score += (categoryCounts.get(market.category) || 0) * 40;
  score += relatedCategories.has(market.category) ? 14 : 0;
  score += market.tags?.reduce((sum, tag) => sum + ((tagCounts.get(tag.toLowerCase()) || 0) * 12), 0) || 0;
  score += Math.log10(Math.max(market.volume, 1)) * 5;
  score += market.traders * 0.05;

  if (market.status === 'Trending') {
    score += 18;
  }

  if (tradedMarketIds.has(market.id)) {
    score -= 80;
  }

  return score;
}

function uniqueMarkets(markets: Market[]): Market[] {
  const seen = new Set<string>();

  return markets.filter((market) => {
    if (seen.has(market.id)) {
      return false;
    }

    seen.add(market.id);
    return true;
  });
}

export function getRecommendationGroups(markets: Market[], trades: TradeInput[], limit = 4): RecommendationGroup[] {
  const activeMarkets = uniqueMarkets(markets).filter((market) => market.status !== 'Resolved');
  const tradedMarketIds = new Set(trades.map(getTradeMarketId).filter(Boolean) as string[]);
  const personalized = [...activeMarkets]
    .map((market) => ({ market, score: scoreMarket(market, trades, tradedMarketIds) }))
    .sort((a, b) => b.score - a.score)
    .map(({ market }) => market)
    .slice(0, limit);

  const trending = [...activeMarkets]
    .sort((a, b) => {
      const trendingScore = (market: Market) => (market.status === 'Trending' ? 1000000 : 0) + market.volume + market.traders * 1000;
      return trendingScore(b) - trendingScore(a);
    })
    .slice(0, limit);

  const categoryLeaders = [...activeMarkets]
    .sort((a, b) => b.volume - a.volume)
    .reduce<Market[]>((leaders, market) => {
      if (!leaders.some((leader) => leader.category === market.category)) {
        leaders.push(market);
      }

      return leaders;
    }, [])
    .slice(0, limit);

  return [
    {
      title: trades.length > 0 ? 'Recommended For You' : 'Recommended Markets',
      subtitle: trades.length > 0 ? 'Based on your trade history' : 'A balanced mix of active market opportunities',
      markets: trades.length > 0 ? personalized : trending,
    },
    {
      title: 'Trending Now',
      subtitle: 'High-volume markets with strong trader activity',
      markets: trending,
    },
    {
      title: 'Explore By Category',
      subtitle: 'Top picks across different market themes',
      markets: categoryLeaders,
    },
  ].filter((group) => group.markets.length > 0);
}
