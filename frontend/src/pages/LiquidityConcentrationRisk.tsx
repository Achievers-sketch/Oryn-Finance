import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, RefreshCw, Loader2, ShieldAlert, Droplets,
  TrendingUp, BarChart3, Users, CheckCircle
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

interface Pool {
  marketId: string;
  question: string;
  category: string;
  tvl: number;
  liquidity: number;
  totalVolume: number;
  utilizationPct: number;
  volatility?: { score: number; badge: string };
}

interface ConcentrationData {
  pool: Pool;
  concentrationScore: number;
  riskLevel: RiskLevel;
  topSharePct: number;
  herfindahlIndex: number;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  safe: { label: 'Safe', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  moderate: { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function deriveRiskLevel(utilizationPct: number, volatilityBadge?: string): RiskLevel {
  const isExtreme = volatilityBadge === 'extreme';
  const isHigh = volatilityBadge === 'high';
  if (utilizationPct >= 85 || isExtreme) return 'critical';
  if (utilizationPct >= 65 || isHigh) return 'high';
  if (utilizationPct >= 40) return 'moderate';
  return 'safe';
}

function deriveConcentrationScore(pool: Pool): number {
  const utilizationWeight = pool.utilizationPct * 0.6;
  const volatilityWeight = (() => {
    switch (pool.volatility?.badge) {
      case 'extreme': return 40;
      case 'high': return 25;
      case 'moderate': return 10;
      default: return 0;
    }
  })();
  return Math.min(100, Math.round(utilizationWeight + volatilityWeight));
}

export default function LiquidityConcentrationRisk() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | 'all'>('all');

  const fetchData = useCallback(async (background = false) => {
    background ? setIsRefreshing(true) : setLoading(true);
    try {
      const [statsData, poolsData] = await Promise.all([
        apiService.liquidity.getStats(),
        apiService.liquidity.getPools({ status: 'active', limit: 100 }),
      ]);
      setStats(statsData);
      setPools(poolsData?.pools || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load liquidity data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const concentrationData: ConcentrationData[] = useMemo(() => {
    const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
    return pools
      .map(pool => {
        const topSharePct = totalTvl > 0 ? (pool.tvl / totalTvl) * 100 : 0;
        const concentrationScore = deriveConcentrationScore(pool);
        const riskLevel = deriveRiskLevel(pool.utilizationPct, pool.volatility?.badge);
        const herfindahlIndex = Math.round((topSharePct / 100) ** 2 * 10000);
        return { pool, concentrationScore, riskLevel, topSharePct, herfindahlIndex };
      })
      .sort((a, b) => b.concentrationScore - a.concentrationScore);
  }, [pools]);

  const summary = useMemo(() => {
    const counts: Record<RiskLevel, number> = { safe: 0, moderate: 0, high: 0, critical: 0 };
    for (const d of concentrationData) counts[d.riskLevel]++;
    const riskScore = counts.critical * 40 + counts.high * 20 + counts.moderate * 5;
    return { counts, riskScore };
  }, [concentrationData]);

  const ownershipDistribution = useMemo(() => {
    const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
    if (totalTvl === 0) return [];
    return concentrationData.slice(0, 8).map((d, i) => ({
      name: d.pool.question.slice(0, 22) + (d.pool.question.length > 22 ? '…' : ''),
      share: parseFloat(d.topSharePct.toFixed(2)),
      tvl: d.pool.tvl,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [concentrationData, pools]);

  const filtered = useMemo(() =>
    selectedRisk === 'all' ? concentrationData : concentrationData.filter(d => d.riskLevel === selectedRisk),
    [concentrationData, selectedRisk]
  );

  const overallRisk: RiskLevel = summary.riskScore > 120 ? 'critical' : summary.riskScore > 60 ? 'high' : summary.riskScore > 20 ? 'moderate' : 'safe';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 border-primary/30 bg-primary/10 text-primary">Risk Dashboard</Badge>
            <h1 className="text-3xl font-bold md:text-5xl flex items-center gap-3">
              <ShieldAlert className="h-9 w-9 text-primary" />
              Liquidity Concentration Risk
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl">
              Detect large LP concentration, visualize pool ownership distribution, and identify risky pools before they become a problem.
            </p>
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 self-start" onClick={() => void fetchData(true)}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Overall risk banner */}
        {!loading && concentrationData.length > 0 && (
          <div className={`mt-6 rounded-2xl border p-4 flex items-center gap-3 ${RISK_CONFIG[overallRisk].bg} ${RISK_CONFIG[overallRisk].border}`}>
            {overallRisk === 'safe' || overallRisk === 'moderate'
              ? <CheckCircle className={`h-5 w-5 ${RISK_CONFIG[overallRisk].color}`} />
              : <AlertTriangle className={`h-5 w-5 ${RISK_CONFIG[overallRisk].color}`} />}
            <div>
              <span className={`font-semibold ${RISK_CONFIG[overallRisk].color}`}>
                Overall concentration risk: {RISK_CONFIG[overallRisk].label}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {summary.counts.critical} critical · {summary.counts.high} high · {summary.counts.moderate} moderate · {summary.counts.safe} safe pools
              </span>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active pools', value: loading ? '—' : pools.length, icon: Droplets },
            { label: 'Risky pools', value: loading ? '—' : summary.counts.high + summary.counts.critical, icon: AlertTriangle },
            { label: 'Total liquidity', value: loading ? '—' : fmt(stats?.totalLiquidity ?? 0), icon: TrendingUp },
            { label: 'Avg utilization', value: loading ? '—' : `${(stats?.avgUtilizationPct ?? 0).toFixed(1)}%`, icon: BarChart3 },
          ].map(item => (
            <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                </div>
                <item.icon className="h-5 w-5 text-primary" />
              </div>
            </MagicCard>
          ))}
        </div>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Analyzing liquidity concentration…</p>
          </div>
        ) : pools.length === 0 ? (
          <MagicCard className="mt-12 rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <Droplets className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-semibold">No pool data available</h2>
            <p className="mt-2 text-muted-foreground">Pool data will appear here once markets are active.</p>
          </MagicCard>
        ) : (
          <>
            {/* Charts row */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Pool ownership distribution pie */}
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Pool Ownership Distribution (by TVL)
                </h2>
                {ownershipDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No TVL data.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ownershipDistribution} dataKey="share" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                          {ownershipDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                          formatter={(v: number, _name: string, props: any) => [`${v.toFixed(2)}% (${fmt(props.payload.tvl)})`, props.payload.name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </MagicCard>

              {/* Concentration score bar chart */}
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Concentration Score by Pool
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={concentrationData.slice(0, 10).map(d => ({
                      name: d.pool.question.slice(0, 14) + '…',
                      score: d.concentrationScore,
                      risk: d.riskLevel,
                    }))} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        formatter={(v: number) => [`${v}`, 'Concentration score']}
                      />
                      <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
                        {concentrationData.slice(0, 10).map((d, i) => {
                          const c = d.riskLevel === 'critical' ? '#ef4444' : d.riskLevel === 'high' ? '#f97316' : d.riskLevel === 'moderate' ? '#eab308' : '#10b981';
                          return <Cell key={i} fill={c} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </MagicCard>
            </div>

            {/* Risk filter + pool table */}
            <div className="mt-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Filter by risk:</span>
                {(['all', 'critical', 'high', 'moderate', 'safe'] as const).map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={selectedRisk === r ? 'default' : 'outline'}
                    className="capitalize border-white/10"
                    onClick={() => setSelectedRisk(r)}
                  >
                    {r === 'all' ? 'All pools' : RISK_CONFIG[r].label}
                    {r !== 'all' && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({summary.counts[r]})
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Pool / Market</th>
                        <th className="text-center px-4 py-3 font-medium">Risk Level</th>
                        <th className="text-right px-4 py-3 font-medium">TVL</th>
                        <th className="text-right px-4 py-3 font-medium">Share of total</th>
                        <th className="text-right px-4 py-3 font-medium">Utilization</th>
                        <th className="text-right px-4 py-3 font-medium">Concentration</th>
                        <th className="text-center px-4 py-3 font-medium">Volatility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-muted-foreground">
                            No pools match the selected risk filter.
                          </td>
                        </tr>
                      ) : (
                        filtered.map(d => {
                          const rc = RISK_CONFIG[d.riskLevel];
                          return (
                            <tr key={d.pool.marketId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 max-w-xs">
                                <p className="font-medium truncate" title={d.pool.question}>{d.pool.question}</p>
                                <p className="text-xs text-muted-foreground capitalize">{d.pool.category}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge className={`border ${rc.bg} ${rc.border} ${rc.color} text-xs uppercase`}>
                                  {d.riskLevel === 'high' || d.riskLevel === 'critical'
                                    ? <AlertTriangle className="inline h-3 w-3 mr-1" />
                                    : null}
                                  {rc.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">{fmt(d.pool.tvl)}</td>
                              <td className="px-4 py-3 text-right">{d.topSharePct.toFixed(2)}%</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${d.pool.utilizationPct >= 80 ? 'bg-red-400' : d.pool.utilizationPct >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                                      style={{ width: `${d.pool.utilizationPct}%` }}
                                    />
                                  </div>
                                  <span>{d.pool.utilizationPct.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${d.concentrationScore >= 70 ? 'bg-red-400' : d.concentrationScore >= 40 ? 'bg-yellow-400' : 'bg-green-400'}`}
                                      style={{ width: `${d.concentrationScore}%` }}
                                    />
                                  </div>
                                  <span>{d.concentrationScore}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {d.pool.volatility ? (
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    d.pool.volatility.badge === 'low' ? 'bg-green-500/10 text-green-400' :
                                    d.pool.volatility.badge === 'moderate' ? 'bg-yellow-500/10 text-yellow-400' :
                                    d.pool.volatility.badge === 'high' ? 'bg-orange-500/10 text-orange-400' :
                                    'bg-red-500/10 text-red-400'
                                  }`}>
                                    {d.pool.volatility.badge}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </MagicCard>
            </div>

            {/* Risk legend */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.entries(RISK_CONFIG) as [RiskLevel, typeof RISK_CONFIG[RiskLevel]][]).map(([level, cfg]) => (
                <div key={level} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
                  <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {level === 'safe' && 'Utilization <40%, low volatility. Normal operation.'}
                    {level === 'moderate' && 'Utilization 40–65% or moderate volatility. Monitor.'}
                    {level === 'high' && 'Utilization 65–85% or high volatility. Consider rebalancing.'}
                    {level === 'critical' && 'Utilization >85% or extreme volatility. Immediate attention needed.'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
