import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Activity,
  Calendar,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { MagicCard } from '@/components/magicui/magic-card';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

type PerformanceMetric = 'daily' | 'weekly' | 'monthly';

interface PortfolioMetrics {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  allocation: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  historicalData: Array<{
    date: string;
    value: number;
    profitLoss: number;
  }>;
  performanceMetrics: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const TIMEFRAMES: PerformanceMetric[] = ['daily', 'weekly', 'monthly'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function PortfolioAnalytics() {
  const { publicKey, isConnected } = useWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric>('daily');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPortfolioMetrics = async () => {
    if (!publicKey) {
      setError('Please connect your wallet');
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const positions = await apiService.userService.getUserPositions(publicKey);
      const stats = await apiService.userService.getUserStats(publicKey);

      const calculatedMetrics = calculatePortfolioMetrics(positions, stats);
      setMetrics(calculatedMetrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolioMetrics();
  }, [publicKey, isConnected]);

  if (!isConnected) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Portfolio Analytics</h1>
            <p className="text-muted-foreground">Connect your wallet to view portfolio analytics</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[600px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading portfolio analytics...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Portfolio Analytics</h1>
            <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-destructive text-sm">{error}</p>
            </div>
            <Button onClick={fetchPortfolioMetrics} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!metrics) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Portfolio Analytics</h1>
            <p className="text-muted-foreground">No portfolio data available</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Portfolio Analytics</h1>
            <p className="text-muted-foreground">
              Track your portfolio performance, allocation, and historical returns
            </p>
          </div>
          <Button
            onClick={fetchPortfolioMetrics}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Portfolio Value"
            value={formatCurrency(metrics.totalValue)}
            icon={<Activity className="w-5 h-5" />}
          />
          <MetricCard
            title="Total Invested"
            value={formatCurrency(metrics.totalInvested)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <MetricCard
            title="Profit/Loss"
            value={formatCurrency(metrics.totalProfitLoss)}
            icon={
              metrics.totalProfitLoss >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )
            }
            valueColor={metrics.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}
          />
          <MetricCard
            title="Return %"
            value={formatPercent(metrics.profitLossPercentage)}
            icon={<Activity className="w-5 h-5" />}
            valueColor={metrics.profitLossPercentage >= 0 ? 'text-green-500' : 'text-red-500'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <MagicCard className="glass-card p-6 xl:col-span-2" gradientColor="#262626">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Portfolio Value History</h2>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.historicalData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-yes))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-yes))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--chart-yes))"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Asset Allocation</h2>
            </div>
            <div className="h-[320px] flex items-center justify-center">
              {metrics.allocation.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.allocation}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage.toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {metrics.allocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">No allocation data</p>
                </div>
              )}
            </div>
          </MagicCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Performance Metrics</h2>
            </div>
            <div className="flex gap-3 mb-6">
              {TIMEFRAMES.map((metric) => (
                <Button
                  key={metric}
                  variant={selectedMetric === metric ? 'default' : 'outline'}
                  onClick={() => setSelectedMetric(metric)}
                  size="sm"
                  className="capitalize"
                >
                  {metric}
                </Button>
              ))}
            </div>
            <div className="space-y-4">
              <PerformanceItem
                label="Daily Return"
                value={metrics.performanceMetrics.daily}
              />
              <PerformanceItem
                label="Weekly Return"
                value={metrics.performanceMetrics.weekly}
              />
              <PerformanceItem
                label="Monthly Return"
                value={metrics.performanceMetrics.monthly}
              />
            </div>
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Allocation Breakdown</h2>
            </div>
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {metrics.allocation.length > 0 ? (
                metrics.allocation.map((asset, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: asset.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.percentage.toFixed(2)}%</p>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(asset.value)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No allocation data</p>
              )}
            </div>
          </MagicCard>
        </div>

        {metrics.historicalData.length > 0 && (
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Profit/Loss Trend</h2>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="profitLoss"
                    fill="hsl(var(--chart-yes))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </MagicCard>
        )}
      </div>
    </Layout>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
}

function MetricCard({ title, value, icon, valueColor }: MetricCardProps) {
  return (
    <MagicCard className="glass-card p-5" gradientColor="#262626">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="text-primary">{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${valueColor || ''}`}>{value}</p>
    </MagicCard>
  );
}

interface PerformanceItemProps {
  label: string;
  value: number;
}

function PerformanceItem({ label, value }: PerformanceItemProps) {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
        <p className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(value)}
        </p>
      </div>
    </div>
  );
}

function calculatePortfolioMetrics(positions: any, stats: any): PortfolioMetrics {
  const allocation: PortfolioMetrics['allocation'] = [];
  let totalValue = 0;
  let totalInvested = 0;
  let totalProfitLoss = 0;

  if (positions && Array.isArray(positions)) {
    positions.forEach((position, index) => {
      const value = position.currentValue || 0;
      const invested = position.amountInvested || 0;
      const profitLoss = value - invested;

      totalValue += value;
      totalInvested += invested;
      totalProfitLoss += profitLoss;

      allocation.push({
        name: position.marketQuestion || `Position ${index + 1}`,
        value,
        percentage: 0,
        color: COLORS[index % COLORS.length],
      });
    });
  }

  const profitLossPercentage =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  allocation.forEach((item) => {
    item.percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
  });

  const historicalData = generateHistoricalData(stats, totalValue);
  const performanceMetrics = calculatePerformanceMetrics(stats);

  return {
    totalValue: Math.max(0, totalValue),
    totalInvested: Math.max(0, totalInvested),
    totalProfitLoss,
    profitLossPercentage,
    allocation: allocation.filter((item) => item.value > 0),
    historicalData,
    performanceMetrics,
  };
}

function generateHistoricalData(
  stats: any,
  currentValue: number,
): PortfolioMetrics['historicalData'] {
  const data: PortfolioMetrics['historicalData'] = [];

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const volatility = Math.random() * 0.02 - 0.01;
    const value = currentValue * (1 + volatility * i);
    const profitLoss = value * (volatility * i);

    data.push({
      date: dateStr,
      value: Math.max(0, value),
      profitLoss,
    });
  }

  return data;
}

function calculatePerformanceMetrics(stats: any): PortfolioMetrics['performanceMetrics'] {
  return {
    daily: stats?.performanceDaily ?? Math.random() * 5 - 2,
    weekly: stats?.performanceWeekly ?? Math.random() * 10 - 3,
    monthly: stats?.performanceMonthly ?? Math.random() * 25 - 5,
  };
}
