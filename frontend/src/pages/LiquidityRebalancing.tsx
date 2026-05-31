import { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw, Loader2, AlertTriangle, CheckCircle, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ImbalanceLevel = 'critical' | 'high' | 'moderate' | 'balanced';

const LEVEL_CFG: Record<ImbalanceLevel, { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
  moderate: { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: TrendingUp },
  balanced: { label: 'Balanced', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle },
};

const LEVEL_COLORS: Record<ImbalanceLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#f59e0b',
  balanced: '#10b981',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function LiquidityRebalancing() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (bg = false) => {
    bg ? setRefreshing(true) : setLoading(true);
    try {
      const result = await apiService.liquidityRebalancing.getSuggestions();
      setData(result);
    } catch {
      toast.error('Failed to load rebalancing suggestions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary;
  const suggestions: any[] = data?.suggestions ?? [];

  const chartData = useMemo(() =>
    suggestions.slice(0, 10).map(s => ({
      name: s.question.slice(0, 20) + (s.question.length > 20 ? '…' : ''),
      yes: Number((s.yesRatio * 100).toFixed(1)),
      no: Number(((1 - s.yesRatio) * 100).toFixed(1)),
      level: s.imbalanceLevel,
    })), [suggestions]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary">Liquidity</Badge>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-primary" />
              Liquidity Rebalancing Suggestions
            </h1>
            <p className="text-gray-400 mt-1">Detect pool imbalances, get reallocation suggestions, and estimate impact</p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing} className="gap-2 border-white/10 bg-white/5">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Analyzing liquidity pools…</p>
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Pools', value: summary.total, color: 'text-white' },
                  { label: 'Critical', value: summary.critical, color: 'text-red-400' },
                  { label: 'High Risk', value: summary.high, color: 'text-orange-400' },
                  { label: 'Balanced', value: summary.balanced, color: 'text-emerald-400' },
                ].map(item => (
                  <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{item.label}</p>
                    <p className={`mt-2 text-3xl font-semibold ${item.color}`}>{item.value}</p>
                  </MagicCard>
                ))}
              </div>
            )}

            {/* YES/NO Ratio Chart */}
            {chartData.length > 0 && (
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-primary" /> YES/NO Volume Ratio (Top 10)
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                      <Bar dataKey="yes" name="YES" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={LEVEL_COLORS[entry.level as ImbalanceLevel] ?? '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </MagicCard>
            )}

            {/* Suggestions Table */}
            <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Rebalancing Suggestions
              </h2>
              {suggestions.length === 0 ? (
                <div className="text-center py-12">
                  <Droplets className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
                  <p className="text-muted-foreground">No active markets found to analyze.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map(s => {
                    const cfg = LEVEL_CFG[s.imbalanceLevel as ImbalanceLevel] ?? LEVEL_CFG.balanced;
                    const Icon = cfg.icon;
                    return (
                      <div key={s.marketId} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                              <span className="text-white font-medium text-sm truncate">{s.question}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                              <span>YES vol: <span className="text-emerald-400">{fmt(s.yesVolume)}</span></span>
                              <span>NO vol: <span className="text-red-400">{fmt(s.noVolume)}</span></span>
                              <span>YES ratio: <span className="text-white">{(s.yesRatio * 100).toFixed(1)}%</span></span>
                            </div>
                            <p className="text-xs text-gray-300">{s.suggestion.description}</p>
                            {(s.impact.requiredYes > 0 || s.impact.requiredNo > 0) && (
                              <p className="text-xs text-indigo-300 mt-1">
                                Suggested add: {s.impact.requiredYes > 0 ? `${fmt(s.impact.requiredYes)} YES` : `${fmt(s.impact.requiredNo)} NO`}
                                {' '}&mdash; est. slippage reduction: {s.impact.estimatedSlippageReduction}%
                              </p>
                            )}
                          </div>
                          <Badge className={`flex-shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border} text-xs`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        {/* YES/NO bar */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${s.yesRatio * 100}%` }} />
                            <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${(1 - s.yesRatio) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {(s.yesRatio * 100).toFixed(0)}% / {((1 - s.yesRatio) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MagicCard>
          </>
        )}
      </div>
    </Layout>
  );
}
