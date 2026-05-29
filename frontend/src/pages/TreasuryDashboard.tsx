import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Clock3,
  DollarSign,
  History,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { apiService } from '@/services/apiService';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const CHART_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a855f7', '#f43f5e', '#14b8a6'];

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function TreasuryDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [inflows, setInflows] = useState<any[]>([]);
  const [outflows, setOutflows] = useState<any[]>([]);
  const [govActions, setGovActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ov, sum, inf, outf, gov] = await Promise.all([
        apiService.treasury.getOverview().catch(() => null),
        apiService.treasury.getSummary().catch(() => null),
        apiService.treasury.getInflows({ limit: 10 }).catch(() => []),
        apiService.treasury.getOutflows({ limit: 10 }).catch(() => []),
        apiService.treasury.getGovernanceActions({ limit: 10 }).catch(() => []),
      ]);
      setOverview(ov);
      setSummary(sum);
      setInflows(inf?.data || inf || []);
      setOutflows(outf?.data || outf || []);
      setGovActions(gov?.data || gov || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const treasuryTrend = useMemo(() => {
    const transactions = Array.isArray(overview?.recentTransactions) ? [...overview.recentTransactions] : [];
    transactions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let balance = 0;
    return transactions.map((transaction: any) => {
      const amount = Number(transaction.amount || 0);
      const isInflow = ['fee_inflow', 'investment_return'].includes(transaction.type);
      const isOutflow = ['distribution_outflow', 'withdrawal', 'emergency_withdraw', 'investment'].includes(transaction.type);

      balance += isInflow ? amount : isOutflow ? -amount : 0;

      return {
        date: transaction.createdAt,
        balance,
      };
    });
  }, [overview]);

  const revenueMix = useMemo(() => {
    const sources = summary?.topSources || [];
    return sources.map((item: any, index: number) => ({
      name: item._id || item.source || `Source ${index + 1}`,
      value: Number(item.total || 0),
    }));
  }, [summary]);

  const metrics = [
    { label: 'Net Balance', value: fmt(overview?.netBalance || 0), icon: DollarSign, color: 'text-primary' },
    { label: '7d Inflows', value: fmt(summary?.inflows?.last7d || 0), icon: TrendingUp, color: 'text-success' },
    { label: '7d Outflows', value: fmt(summary?.outflows?.last7d || 0), icon: TrendingDown, color: 'text-destructive' },
    { label: 'Gov Actions', value: overview?.outflowCount || govActions.length || 0, icon: History, color: 'text-warning' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              Treasury Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Protocol fee collection, revenue mix, and treasury growth</p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {metrics.map(({ label, value, icon: Icon, color }) => (
              <MagicCard key={label} className="glass-card p-6" gradientColor="#262626">
                <Icon className={`w-5 h-5 mb-2 ${color}`} />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </MagicCard>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <MagicCard className="glass-card p-6 xl:col-span-2" gradientColor="#262626">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Treasury Growth
                </h2>
                <p className="text-sm text-muted-foreground">Cumulative treasury balance from the most recent completed transactions</p>
              </div>
            </div>
            {treasuryTrend.length === 0 ? (
              <p className="text-muted-foreground text-sm py-10 text-center">No treasury history available</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={treasuryTrend}>
                    <defs>
                      <linearGradient id="treasuryBalanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      stroke="hsl(var(--muted-foreground))"
                      minTickGap={28}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => fmt(Number(value))} />
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      labelFormatter={(label) => new Date(label).toLocaleString('en-US')}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="balance" name="Cumulative balance" stroke="#22c55e" fill="url(#treasuryBalanceFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-primary" />
              Revenue Mix
            </h2>
            {revenueMix.length === 0 ? (
              <p className="text-muted-foreground text-sm py-10 text-center">No fee source data available</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueMix}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {revenueMix.map((_: any, index: number) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Legend verticalAlign="bottom" height={28} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </MagicCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" /> Recent Inflows
            </h2>
            {inflows.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No inflows recorded</p>
            ) : (
              <div className="space-y-3">
                {inflows.slice(0, 5).map((tx: any, i: number) => (
                  <div key={tx._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type || 'Fee'}</p>
                      <p className="text-xs text-muted-foreground">{tx.source || 'trading'}</p>
                    </div>
                    <span className="text-sm font-semibold text-success">+{fmt(tx.amount || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" /> Recent Outflows
            </h2>
            {outflows.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No outflows recorded</p>
            ) : (
              <div className="space-y-3">
                {outflows.slice(0, 5).map((tx: any, i: number) => (
                  <div key={tx._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type || 'Distribution'}</p>
                      <p className="text-xs text-muted-foreground">{tx.recipient || tx.description || ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">-{fmt(tx.amount || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-warning" /> Governance Actions
            </h2>
            {govActions.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No governance actions</p>
            ) : (
              <div className="space-y-3">
                {govActions.slice(0, 5).map((action: any, i: number) => (
                  <div key={action._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{action.type || 'Proposal'}</p>
                      <p className="text-xs text-muted-foreground">{action.description || action.status || ''}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        action.status === 'executed'
                          ? 'text-green-400 border-green-500/30'
                          : action.status === 'pending'
                            ? 'text-yellow-400 border-yellow-500/30'
                            : 'text-muted-foreground'
                      }
                    >
                      {action.status || 'unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>
        </div>

        <div className="mt-8 text-center">
          <Link to="/admin">
            <Button variant="outline">
              View Full Admin Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
