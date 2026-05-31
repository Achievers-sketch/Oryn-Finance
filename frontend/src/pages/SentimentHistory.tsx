import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, History } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';

const LABEL_CFG: Record<string, { color: string; icon: typeof TrendingUp }> = {
  bullish: { color: 'text-green-400', icon: TrendingUp },
  bearish: { color: 'text-red-400', icon: TrendingDown },
  neutral: { color: 'text-yellow-400', icon: Minus },
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(iso));
}

export default function SentimentHistory() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (bg = false) => {
    bg ? setRefreshing(true) : setLoading(true);
    try {
      // Fetch both history and current aggregated for latest context
      const [histRes, aggRes] = await Promise.all([
        apiService.sentiment.getHistory(48),
        apiService.sentiment.getAggregated(),
      ]);
      setData({ history: histRes, current: aggRes });
    } catch {
      toast.error('Failed to load sentiment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const chartData = useMemo(() => {
    const snapshots: any[] = data?.history?.snapshots ?? [];
    return snapshots.map((s: any, i: number) => ({
      name: fmtTime(s.timestamp),
      index: s.overall?.index ?? 0,
      score: Number(((s.overall?.score ?? 0) * 100).toFixed(1)),
      label: s.overall?.label ?? 'neutral',
    }));
  }, [data]);

  const categoryTrend = useMemo(() => {
    const snapshots: any[] = data?.history?.snapshots ?? [];
    if (snapshots.length === 0) return [];
    const catSet = new Set<string>();
    snapshots.forEach(s => (s.byCategory ?? []).forEach((c: any) => catSet.add(c.category)));
    return snapshots.map(s => {
      const point: Record<string, any> = { name: fmtTime(s.timestamp) };
      catSet.forEach(cat => {
        const entry = (s.byCategory ?? []).find((c: any) => c.category === cat);
        point[cat] = entry ? Number((entry.avgSentiment * 100).toFixed(1)) : 0;
      });
      return point;
    });
  }, [data]);

  const categories = useMemo(() => {
    const snapshots: any[] = data?.history?.snapshots ?? [];
    const catSet = new Set<string>();
    snapshots.forEach(s => (s.byCategory ?? []).forEach((c: any) => catSet.add(c.category)));
    return Array.from(catSet);
  }, [data]);

  const CAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  const current = data?.current;
  const latestLabel = current?.overall?.label ?? 'neutral';
  const LabelIcon = LABEL_CFG[latestLabel]?.icon ?? Minus;
  const labelColor = LABEL_CFG[latestLabel]?.color ?? 'text-yellow-400';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary">Sentiment History</Badge>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <History className="h-8 w-8 text-primary" />
              Market Sentiment History
            </h1>
            <p className="text-gray-400 mt-1">Rolling sentiment snapshots, trend analysis, and historical charts</p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing} className="gap-2 border-white/10 bg-white/5">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading sentiment history…</p>
          </div>
        ) : (
          <>
            {/* Current snapshot summary */}
            {current && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Current Index', value: current.overall?.index ?? '—', sub: 'out of 100' },
                  { label: 'Sentiment', value: (current.overall?.label ?? '—').toUpperCase(), sub: `score ${(current.overall?.score ?? 0).toFixed(3)}` },
                  { label: 'Snapshots', value: data?.history?.count ?? 0, sub: 'captured in rolling window' },
                ].map(item => (
                  <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{item.label}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {item.label === 'Sentiment' && <LabelIcon className={`h-5 w-5 ${labelColor}`} />}
                      <p className={`text-2xl font-semibold ${item.label === 'Sentiment' ? labelColor : 'text-white'}`}>{item.value}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                  </MagicCard>
                ))}
              </div>
            )}

            {/* Sentiment Index Over Time */}
            <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" /> Sentiment Index Over Time
              </h2>
              {chartData.length < 2 ? (
                <p className="text-gray-400 text-center py-10 text-sm">Not enough snapshots yet. Sentiment is captured each time the aggregated endpoint is called.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        formatter={(v: number) => [`${v}`, 'Sentiment Index']}
                      />
                      <Area type="monotone" dataKey="index" name="Index" stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </MagicCard>

            {/* Category Sentiment Trends */}
            {categoryTrend.length >= 2 && categories.length > 0 && (
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Category Sentiment Trend
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={categoryTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        formatter={(v: number) => [`${v}%`, '']}
                      />
                      <Legend />
                      {categories.map((cat, i) => (
                        <Line key={cat} type="monotone" dataKey={cat} stroke={CAT_COLORS[i % CAT_COLORS.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </MagicCard>
            )}

            {/* Snapshot Table */}
            <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Snapshot Log
              </h2>
              {chartData.length === 0 ? (
                <p className="text-gray-400 text-center py-8 text-sm">No snapshots captured yet. Refresh the aggregated sentiment to generate the first snapshot.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-center py-2 px-3">Index</th>
                        <th className="text-center py-2 px-3">Label</th>
                        <th className="text-right py-2 px-3">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...chartData].reverse().map((row, i) => {
                        const cfg = LABEL_CFG[row.label] ?? LABEL_CFG.neutral;
                        const Icon = cfg.icon;
                        return (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 text-gray-300 text-xs">{row.name}</td>
                            <td className="py-2 px-3 text-center font-semibold">{row.index}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`flex items-center justify-center gap-1 ${cfg.color}`}>
                                <Icon className="h-3 w-3" />
                                {row.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{row.score}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </MagicCard>
          </>
        )}
      </div>
    </Layout>
  );
}
