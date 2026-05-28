import { useEffect, useState } from 'react';
import { Brain, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/magicui/magic-card';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const LABEL_CONFIG: Record<string, { color: string; icon: typeof TrendingUp; badge: string }> = {
  bullish: { color: 'text-green-400', icon: TrendingUp, badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  bearish: { color: 'text-red-400', icon: TrendingDown, badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  neutral: { color: 'text-yellow-400', icon: Minus, badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

function SentimentGauge({ index }: { index: number }) {
  const angle = (index / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-8 border-white/10" />
        <div
          className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom rounded-full transition-transform duration-700"
          style={{ transform: `rotate(${angle}deg) translateX(-50%)` }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white" />
      </div>
      <p className="text-4xl font-bold text-white mt-2">{index}</p>
      <p className="text-sm text-gray-400">Sentiment Index (0–100)</p>
    </div>
  );
}

export default function MarketSentiment() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await apiService.sentiment.getAggregated();
      setData(result);
    } catch {
      toast.error('Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const overall = data?.overall;
  const LabelIcon = overall ? (LABEL_CONFIG[overall.label]?.icon ?? Minus) : Minus;
  const labelCfg = overall ? (LABEL_CONFIG[overall.label] ?? LABEL_CONFIG.neutral) : LABEL_CONFIG.neutral;

  const categoryChartData = (data?.byCategory ?? []).map((c: any) => ({
    name: c.category,
    sentiment: Number((c.avgSentiment * 100).toFixed(1)),
    fill: c.avgSentiment > 0.2 ? '#10b981' : c.avgSentiment < -0.2 ? '#f43f5e' : '#f59e0b',
  }));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Market Sentiment</h1>
            <p className="text-gray-400 mt-1">AI-aggregated sentiment from trading activity and market signals</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading && !data ? (
          <div className="text-center py-20 text-gray-400">Aggregating sentiment...</div>
        ) : (
          <>
            {/* Overall Sentiment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MagicCard className="p-6 md:col-span-1 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-indigo-400" />
                  <span className="text-gray-400 text-sm">Overall Market Sentiment</span>
                </div>
                {overall && <SentimentGauge index={overall.index} />}
                {overall && (
                  <div className="mt-4 flex items-center gap-2">
                    <LabelIcon className={`h-5 w-5 ${labelCfg.color}`} />
                    <Badge className={labelCfg.badge}>{overall.label.toUpperCase()}</Badge>
                    <span className="text-sm text-gray-400">score: {overall.score.toFixed(3)}</span>
                  </div>
                )}
              </MagicCard>

              {/* Category Breakdown */}
              <MagicCard className="p-6 md:col-span-2">
                <h2 className="text-lg font-semibold text-white mb-4">Sentiment by Category</h2>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[-100, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Sentiment']} />
                      <Bar dataKey="sentiment" radius={[4, 4, 0, 0]}>
                        {categoryChartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-center py-10">No category data available.</p>
                )}
              </MagicCard>
            </div>

            {/* Per-Market Sentiment */}
            <MagicCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Per-Market Sentiment</h2>
              {data?.markets?.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No active markets found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="text-left py-2 pr-4">Market</th>
                        <th className="text-left py-2 pr-4">Category</th>
                        <th className="text-left py-2 pr-4">Sentiment</th>
                        <th className="text-left py-2 pr-4">Label</th>
                        <th className="text-left py-2">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.markets ?? []).map((m: any) => {
                        const cfg = LABEL_CONFIG[m.label] ?? LABEL_CONFIG.neutral;
                        const Icon = cfg.icon;
                        return (
                          <tr key={m.marketId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 pr-4 text-gray-200 max-w-[260px] truncate">{m.question}</td>
                            <td className="py-3 pr-4 text-gray-400 capitalize">{m.category}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-1">
                                <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.abs(m.sentiment) * 100}%`,
                                      background: m.sentiment > 0 ? '#10b981' : '#f43f5e',
                                      marginLeft: m.sentiment < 0 ? 'auto' : undefined,
                                    }}
                                  />
                                </div>
                                <span className={`text-xs ${cfg.color}`}>{(m.sentiment * 100).toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`flex items-center gap-1 ${cfg.color}`}>
                                <Icon className="h-3 w-3" />
                                {m.label}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-white/10">
                                  <div className="h-full rounded-full bg-indigo-400" style={{ width: `${m.confidence}%` }} />
                                </div>
                                <span className="text-xs text-gray-400">{m.confidence}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {data?.generatedAt && (
                <p className="text-xs text-gray-500 mt-4">Last updated: {new Date(data.generatedAt).toLocaleString()}</p>
              )}
            </MagicCard>
          </>
        )}
      </div>
    </Layout>
  );
}
