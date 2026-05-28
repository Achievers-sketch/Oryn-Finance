import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketCard } from '@/components/markets/MarketCard';
import { allMarkets, Market } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { getRecommendationGroups, normalizeMarket } from '@/lib/recommendations';

export function FeaturedMarkets() {
  const { isConnected, publicKey } = useWallet();
  const [markets, setMarkets] = useState<Market[]>(allMarkets);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadDiscoveryData = async () => {
      setLoading(true);

      try {
        const [marketResponse, tradesResponse] = await Promise.all([
          apiService.markets.getMarkets({ status: 'active', limit: 24 }).catch(() => null),
          isConnected && publicKey
            ? apiService.trades.getTradeHistory(publicKey, { limit: 50 }).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!isMounted) {
          return;
        }

        const marketData = marketResponse?.data?.markets || marketResponse?.markets || marketResponse || [];
        if (Array.isArray(marketData) && marketData.length > 0) {
          setMarkets(marketData.map(normalizeMarket));
        } else {
          setMarkets(allMarkets);
        }

        const trades = tradesResponse?.trades || tradesResponse?.data?.trades || tradesResponse || [];
        setTradeHistory(Array.isArray(trades) ? trades : []);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDiscoveryData();

    return () => {
      isMounted = false;
    };
  }, [isConnected, publicKey]);

  const recommendationGroups = useMemo(() => {
    return getRecommendationGroups(markets, tradeHistory);
  }, [markets, tradeHistory]);

  const selectedGroup = recommendationGroups[Math.min(activeGroup, recommendationGroups.length - 1)];

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-6 mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm text-primary font-medium">Market Discovery</span>
              {isConnected && tradeHistory.length > 0 && (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  Personalized
                </Badge>
              )}
            </div>
            <h2 className="text-3xl font-bold">Find Your Next Prediction</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {selectedGroup?.subtitle || 'Browse markets matched to activity, momentum, and category variety.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {recommendationGroups.map((group, index) => (
                <Button
                  key={group.title}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveGroup(index)}
                  className={`tab-button ${activeGroup === index ? 'active' : ''}`}
                >
                  {group.title === 'Trending Now' && <TrendingUp className="mr-2 h-4 w-4" />}
                  {group.title}
                </Button>
              ))}
            </div>
            <Link to="/markets">
              <Button variant="ghost" className="group">
                View All Markets
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(selectedGroup?.markets || []).map((market, index) => (
            <div 
              key={market.id} 
              className="animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <MarketCard market={market} featured />
            </div>
          ))}
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Updating recommendations
          </div>
        )}
      </div>
    </section>
  );
}
