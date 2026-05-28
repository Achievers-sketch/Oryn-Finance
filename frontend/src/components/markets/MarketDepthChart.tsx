import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
  side: 'buy' | 'sell';
}

interface MarketDepthData {
  marketId: string;
  currentPrice: number;
  spread: number;
  buyOrders: OrderBookEntry[];
  sellOrders: OrderBookEntry[];
  totalBuyLiquidity: number;
  totalSellLiquidity: number;
  lastUpdate: number;
}

interface MarketDepthChartProps {
  marketId: string;
  tokenType: 'yes' | 'no';
  className?: string;
}

const MarketDepthChart: React.FC<MarketDepthChartProps> = ({ 
  marketId, 
  tokenType, 
  className = '' 
}) => {
  const [depthData, setDepthData] = useState<MarketDepthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'depth' | 'liquidity'>('depth');
  const [priceRange, setPriceRange] = useState<'full' | 'tight'>('tight');

  // Fetch real market depth data
  useEffect(() => {
    const fetchDepthData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/market-depth/${marketId}/depth?tokenType=${tokenType}`);
        const result = await response.json();
        
        if (result.success) {
          setDepthData(result.data);
        } else {
          throw new Error(result.message || 'Failed to fetch market depth');
        }
      } catch (err) {
        console.error('Market depth fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load market depth data');
        
        // Fallback to mock data
        const mockData = generateMockDepthData();
        setDepthData(mockData);
      } finally {
        setLoading(false);
      }
    };

    const generateMockDepthData = (): MarketDepthData => {
      const currentPrice = 0.45 + Math.random() * 0.1; // Price between 0.45-0.55
      const spread = 0.01 + Math.random() * 0.02; // Spread between 1-3%
      
      const buyOrders: OrderBookEntry[] = [];
      const sellOrders: OrderBookEntry[] = [];
      
      let buyTotal = 0;
      let sellTotal = 0;
      
      // Generate buy orders (below current price)
      for (let i = 0; i < 20; i++) {
        const price = currentPrice - (i + 1) * 0.01;
        if (price <= 0) break;
        
        const amount = Math.random() * 1000 + 100;
        buyTotal += amount;
        
        buyOrders.push({
          price,
          amount,
          total: buyTotal,
          side: 'buy'
        });
      }
      
      // Generate sell orders (above current price)
      for (let i = 0; i < 20; i++) {
        const price = currentPrice + spread + i * 0.01;
        if (price >= 1) break;
        
        const amount = Math.random() * 1000 + 100;
        sellTotal += amount;
        
        sellOrders.push({
          price,
          amount,
          total: sellTotal,
          side: 'sell'
        });
      }
      
      return {
        marketId,
        currentPrice,
        spread,
        buyOrders: buyOrders.reverse(), // Highest buy prices first
        sellOrders,
        totalBuyLiquidity: buyTotal,
        totalSellLiquidity: sellTotal,
        lastUpdate: Date.now()
      };
    };

    fetchDepthData();
    
    // Update every 5 seconds for real-time effect
    const interval = setInterval(fetchDepthData, 5000);
    
    return () => clearInterval(interval);
  }, [marketId, tokenType]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!depthData) return [];
    
    const data = [];
    
    // Add buy side data
    depthData.buyOrders.forEach(order => {
      data.push({
        price: order.price,
        buyDepth: order.total,
        sellDepth: 0,
        side: 'buy',
        amount: order.amount
      });
    });
    
    // Add sell side data
    depthData.sellOrders.forEach(order => {
      data.push({
        price: order.price,
        buyDepth: 0,
        sellDepth: order.total,
        side: 'sell',
        amount: order.amount
      });
    });
    
    return data.sort((a, b) => a.price - b.price);
  }, [depthData]);

  // Filter data based on price range
  const filteredData = useMemo(() => {
    if (!depthData || chartData.length === 0) return [];
    
    if (priceRange === 'tight') {
      const minPrice = depthData.currentPrice - 0.1;
      const maxPrice = depthData.currentPrice + 0.1;
      return chartData.filter(d => d.price >= minPrice && d.price <= maxPrice);
    }
    
    return chartData;
  }, [chartData, depthData, priceRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">Price: ${label?.toFixed(4)}</p>
          <p className="text-sm text-gray-600">
            Amount: {data.amount?.toFixed(2)} tokens
          </p>
          <p className="text-sm text-gray-600">
            Total Depth: {(data.buyDepth || data.sellDepth)?.toFixed(2)}
          </p>
          <p className={`text-sm font-medium ${data.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
            {data.side === 'buy' ? 'Buy Orders' : 'Sell Orders'}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Depth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Depth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600 py-8">
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!depthData) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Depth - {tokenType.toUpperCase()} Token
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Live
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPriceRange(priceRange === 'full' ? 'tight' : 'full')}
            >
              {priceRange === 'full' ? 'Zoom In' : 'Zoom Out'}
            </Button>
          </div>
        </div>
        
        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Current Price</p>
            <p className="font-bold text-lg">${depthData.currentPrice.toFixed(4)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Spread</p>
            <p className="font-bold text-lg">{(depthData.spread * 100).toFixed(2)}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Buy Liquidity
            </p>
            <p className="font-bold text-lg text-green-600">
              {depthData.totalBuyLiquidity.toFixed(0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-600" />
              Sell Liquidity
            </p>
            <p className="font-bold text-lg text-red-600">
              {depthData.totalSellLiquidity.toFixed(0)}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'depth' | 'liquidity')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="depth">Depth Chart</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity Zones</TabsTrigger>
          </TabsList>
          
          <TabsContent value="depth" className="mt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="price" 
                    type="number"
                    scale="linear"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => `$${value.toFixed(3)}`}
                  />
                  <YAxis tickFormatter={(value) => value.toFixed(0)} />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Buy orders (green) */}
                  <Line
                    type="stepAfter"
                    dataKey="buyDepth"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  
                  {/* Sell orders (red) */}
                  <Line
                    type="stepBefore"
                    dataKey="sellDepth"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  
                  {/* Current price line */}
                  <Line
                    type="linear"
                    dataKey={() => depthData.currentPrice}
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="liquidity" className="mt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="price" 
                    type="number"
                    scale="linear"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => `$${value.toFixed(3)}`}
                  />
                  <YAxis tickFormatter={(value) => value.toFixed(0)} />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Buy liquidity area */}
                  <Area
                    type="stepAfter"
                    dataKey="buyDepth"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  
                  {/* Sell liquidity area */}
                  <Area
                    type="stepBefore"
                    dataKey="sellDepth"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Order Book Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-green-600 mb-2 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Top Buy Orders
            </h4>
            <div className="space-y-1">
              {depthData.buyOrders.slice(0, 3).map((order, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>${order.price.toFixed(4)}</span>
                  <span>{order.amount.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-red-600 mb-2 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              Top Sell Orders
            </h4>
            <div className="space-y-1">
              {depthData.sellOrders.slice(0, 3).map((order, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>${order.price.toFixed(4)}</span>
                  <span>{order.amount.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {new Date(depthData.lastUpdate).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketDepthChart;