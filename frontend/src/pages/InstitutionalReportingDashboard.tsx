import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Download,
  FileText,
  Gauge,
  Landmark,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Vote,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiService } from '@/services/apiService';

const TIMEFRAMES = ['24h', '7d', '30d', '90d', '1y'] as const;
const CATEGORIES = ['all', 'crypto', 'sports', 'politics', 'economics', 'technology', 'entertainment', 'other'];
const COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6'];

type Timeframe = (typeof TIMEFRAMES)[number];

function formatCurrency(value: number): string {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatPercent(value: number): string {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function shortAddress(value?: string): string {
  if (!value) return 'unknown';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Gauge;
  tone: string;
}) {
  return (
    <MagicCard className="glass-card p-5" gradientColor="#262626">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
    </MagicCard>
  );
}

export default function InstitutionalReportingDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [category, setCategory] = useState('all');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.reports.getInstitutionalDashboard({
        timeframe,
        category: category === 'all' ? undefined : category,
        limit: 10,
      });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load institutional reports');
    } finally {
      setLoading(false);
    }
  }, [category, timeframe]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const marketExposure = report?.marketExposure || {};
  const treasury = report?.treasury || {};
  const governance = report?.governanceActivity || {};
  const metadata = report?.metadata;

  const exposureSummary = marketExposure.summary || {};
  const treasurySummary = treasury.summary || {};
  const governanceSummary = governance.summary || {};
  const exposureByCategory = marketExposure.byCategory || [];
  const topMarkets = marketExposure.topMarkets || [];
  const flowSeries = treasury.flowSeries || [];
  const sourceMix = treasury.sourceMix || [];
  const recentTransactions = treasury.recentTransactions || [];
  const eventSeries = governance.eventSeries || [];
  const actionsByType = governance.actionsByType || [];
  const proposalActivity = governance.proposalActivity || [];
  const recentActions = governance.recentActions || [];

  const sourceMixTotal = useMemo(
    () => sourceMix.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0),
    [sourceMix],
  );

  const exportRows = useMemo(() => {
    const rows: Array<Record<string, unknown>> = [
      { report: 'market_exposure', metric: 'active_positions', value: exposureSummary.activePositions || 0 },
      { report: 'market_exposure', metric: 'total_cost_basis', value: exposureSummary.totalCostBasis || 0 },
      { report: 'market_exposure', metric: 'unrealized_pnl', value: exposureSummary.unrealizedPnL || 0 },
      { report: 'treasury', metric: 'total_balance', value: treasurySummary.totalBalance || 0 },
      { report: 'treasury', metric: 'net_flow', value: treasurySummary.netFlow || 0 },
      { report: 'governance', metric: 'total_actions', value: governanceSummary.totalActions || 0 },
      { report: 'governance', metric: 'indexed_events', value: governanceSummary.indexedGovernanceEvents || 0 },
    ];

    topMarkets.forEach((market: any) => {
      rows.push({
        report: 'top_market_exposure',
        metric: market.marketId,
        value: market.totalCostBasis || 0,
        category: market.category,
        holders: market.holders,
      });
    });

    return rows;
  }, [exposureSummary, governanceSummary, topMarkets, treasurySummary]);

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`oryn-institutional-report-${stamp}.csv`, exportRows);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-4 border-primary/30 bg-primary/10 text-primary" variant="outline">
              Institutional Reports
            </Badge>
            <h1 className="flex items-center gap-3 text-3xl font-bold md:text-4xl">
              <Building2 className="h-8 w-8 text-primary" />
              Reporting Dashboard
            </h1>
            <p className="mt-3 text-muted-foreground">
              Market exposure, treasury flow, and governance activity reports for professional operators.
            </p>
            {metadata && (
              <p className="mt-2 text-xs text-muted-foreground">
                Generated {formatDate(metadata.generatedAt)} for {metadata.filters?.category || 'all'} markets
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-white/10 bg-black/30 p-1">
              {TIMEFRAMES.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={timeframe === item ? 'default' : 'ghost'}
                  onClick={() => setTimeframe(item)}
                  disabled={loading}
                  className="h-8"
                >
                  {item}
                </Button>
              ))}
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={loading}
              className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition-colors hover:bg-white/5"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item} className="bg-black text-white">
                  {item === 'all' ? 'All Categories' : item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!report || loading}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !report ? (
          <MagicCard className="glass-card p-10" gradientColor="#262626">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p>Loading institutional reports...</p>
            </div>
          </MagicCard>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Open Exposure"
                value={formatCurrency(exposureSummary.totalCostBasis)}
                detail={`${formatNumber(exposureSummary.activePositions)} active positions`}
                icon={Gauge}
                tone="text-sky-400"
              />
              <KpiCard
                label="Directional Skew"
                value={formatNumber(exposureSummary.netDirectionalShares)}
                detail={`YES ${formatNumber(exposureSummary.yesShares)} / NO ${formatNumber(exposureSummary.noShares)}`}
                icon={Scale}
                tone="text-amber-400"
              />
              <KpiCard
                label="Treasury Balance"
                value={formatCurrency(treasurySummary.totalBalance)}
                detail={`${formatCurrency(treasurySummary.netFlow)} net flow`}
                icon={WalletCards}
                tone="text-emerald-400"
              />
              <KpiCard
                label="Governance Actions"
                value={formatNumber(governanceSummary.totalActions)}
                detail={`${formatNumber(governanceSummary.indexedGovernanceEvents)} indexed events`}
                icon={Vote}
                tone="text-purple-400"
              />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
              <MagicCard className="glass-card p-6 xl:col-span-2" gradientColor="#262626">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Market Exposure by Category
                    </h2>
                    <p className="text-sm text-muted-foreground">Cost basis and unrealized P&L across open positions</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-muted-foreground">
                    Concentration {formatPercent(exposureSummary.concentrationRatio)}
                  </Badge>
                </div>
                <div className="h-[320px]">
                  {exposureByCategory.length === 0 ? (
                    <EmptyState label="No market exposure data for this selection" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={exposureByCategory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => formatCurrency(Number(value))} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="totalCostBasis" name="Cost basis" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unrealizedPnL" name="Unrealized P&L" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </MagicCard>

              <MagicCard className="glass-card p-6" gradientColor="#262626">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Revenue Sources
                </h2>
                <div className="space-y-4">
                  {sourceMix.length === 0 ? (
                    <EmptyState label="No treasury source data in this period" />
                  ) : (
                    sourceMix.slice(0, 6).map((source: any, index: number) => {
                      const share = sourceMixTotal > 0 ? Number(source.total || 0) / sourceMixTotal : 0;
                      return (
                        <div key={source.source || index}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="capitalize text-muted-foreground">{String(source.source || 'other').replace(/_/g, ' ')}</span>
                            <span className="font-medium">{formatCurrency(source.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${Math.max(2, share * 100)}%`, backgroundColor: COLORS[index % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </MagicCard>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MagicCard className="glass-card p-6" gradientColor="#262626">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Landmark className="h-5 w-5 text-primary" />
                  Treasury Flow
                </h2>
                <div className="h-[300px]">
                  {flowSeries.length === 0 ? (
                    <EmptyState label="No treasury flow data in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={flowSeries}>
                        <defs>
                          <linearGradient id="inflowFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="outflowFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" minTickGap={28} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => formatCurrency(Number(value))} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="inflows" name="Inflows" stroke="#22c55e" fill="url(#inflowFill)" />
                        <Area type="monotone" dataKey="outflows" name="Outflows" stroke="#f43f5e" fill="url(#outflowFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </MagicCard>

              <MagicCard className="glass-card p-6" gradientColor="#262626">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Governance Activity
                </h2>
                <div className="h-[300px]">
                  {eventSeries.length === 0 && actionsByType.length === 0 ? (
                    <EmptyState label="No governance activity in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eventSeries.length ? eventSeries : actionsByType.map((item: any) => ({ period: item.action, events: item.count }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="events" name="Indexed events" stroke="#a855f7" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </MagicCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <MagicCard className="glass-card p-6 xl:col-span-2" gradientColor="#262626">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5 text-primary" />
                  Top Market Exposures
                </h2>
                {topMarkets.length === 0 ? (
                  <EmptyState label="No open market exposure" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Market</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="text-right">YES / NO</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topMarkets.map((market: any) => (
                        <TableRow key={market.marketId}>
                          <TableCell>
                            <div className="max-w-[360px]">
                              <p className="truncate font-medium">{market.question || market.marketId}</p>
                              <p className="text-xs text-muted-foreground">{market.marketId} - {formatNumber(market.holders)} holders</p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{market.category || 'other'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(market.totalCostBasis)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {formatNumber(market.yesShares)} / {formatNumber(market.noShares)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${Number(market.unrealizedPnL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(market.unrealizedPnL)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </MagicCard>

              <MagicCard className="glass-card p-6" gradientColor="#262626">
                <h2 className="mb-4 text-lg font-semibold">Proposal Activity</h2>
                {proposalActivity.length === 0 ? (
                  <EmptyState label="No proposal-linked actions" />
                ) : (
                  <div className="space-y-3">
                    {proposalActivity.slice(0, 6).map((proposal: any) => (
                      <div key={proposal.proposalId} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{proposal.proposalId}</p>
                          <Badge variant="outline" className="border-white/10 text-muted-foreground">
                            {formatNumber(proposal.actions)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(proposal.lastActionAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </MagicCard>

              <MagicCard className="glass-card p-6 xl:col-span-2" gradientColor="#262626">
                <h2 className="mb-4 text-lg font-semibold">Recent Treasury Transactions</h2>
                {recentTransactions.length === 0 ? (
                  <EmptyState label="No treasury transactions recorded" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.slice(0, 8).map((tx: any, index: number) => (
                        <TableRow key={tx.transactionId || tx._id || index}>
                          <TableCell className="capitalize">{String(tx.type || 'transaction').replace(/_/g, ' ')}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{String(tx.source || 'other').replace(/_/g, ' ')}</TableCell>
                          <TableCell>{tx.asset || 'USDC'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </MagicCard>

              <MagicCard className="glass-card p-6" gradientColor="#262626">
                <h2 className="mb-4 text-lg font-semibold">Recent Governance Actions</h2>
                {recentActions.length === 0 ? (
                  <EmptyState label="No governance actions recorded" />
                ) : (
                  <div className="space-y-3">
                    {recentActions.slice(0, 6).map((action: any, index: number) => (
                      <div key={action.transactionId || action._id || index} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {action.metadata?.action || action.purpose || 'Governance action'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{action.governanceProposalId || 'unlinked proposal'}</p>
                          </div>
                          <Badge variant="outline" className="border-white/10 text-muted-foreground">
                            {shortAddress(action.executedBy)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(action.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </MagicCard>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
