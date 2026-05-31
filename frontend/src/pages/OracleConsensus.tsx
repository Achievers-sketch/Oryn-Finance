import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Loader2, CheckCircle2, XCircle, ShieldCheck, Activity } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const WEIGHT_CFG: Record<string, { label: string; color: string }> = {
  high: { label: 'High Weight', color: 'text-emerald-400' },
  medium: { label: 'Medium Weight', color: 'text-yellow-400' },
  low: { label: 'Low Weight', color: 'text-red-400' },
};

export default function OracleConsensus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (bg = false) => {
    bg ? setRefreshing(true) : setLoading(true);
    try {
      const result = await apiService.oracleConsensus.getConsensus();
      setData(result);
    } catch {
      toast.error('Failed to load oracle consensus');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sources: any[] = data?.sources ?? [];
  const consensus = data?.consensus;

  const pieSources = sources.map(s => ({
    name: s.name,
    value: s.confidence,
    healthy: s.isHealthy,
  }));
  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary">Oracle</Badge>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              Oracle Consensus Visualization
            </h1>
            <p className="text-gray-400 mt-1">Oracle provider responses, consensus breakdown, and confidence indicators</p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing} className="gap-2 border-white/10 bg-white/5">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading oracle consensus…</p>
          </div>
        ) : (
          <>
            {/* Consensus Status Banner */}
            {consensus && (
              <MagicCard className={`rounded-3xl border p-6 mb-6 ${consensus.reached ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center gap-4">
                  {consensus.reached
                    ? <ShieldCheck className="h-10 w-10 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="h-10 w-10 text-red-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-xl font-bold ${consensus.reached ? 'text-emerald-300' : 'text-red-300'}`}>
                      Consensus {consensus.reached ? 'Reached' : 'Not Reached'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {consensus.healthySources} of {consensus.totalSources} sources are healthy &mdash;
                      {' '}{consensus.agreementPct}% agreement (threshold: {consensus.threshold}%)
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-3xl font-bold text-white">{consensus.overallConfidence}%</p>
                    <p className="text-xs text-muted-foreground">Overall Confidence</p>
                  </div>
                </div>

                {/* Confidence progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Consensus threshold ({consensus.threshold}%)</span>
                    <span>{consensus.agreementPct}% agreement</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${consensus.reached ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, consensus.agreementPct)}%` }}
                    />
                  </div>
                </div>
              </MagicCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Confidence Pie */}
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="text-base font-semibold text-white mb-4">Source Confidence</h2>
                {pieSources.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                          label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                          {pieSources.map((entry, i) => (
                            <Cell key={entry.name} fill={entry.healthy ? PIE_COLORS[i % PIE_COLORS.length] : '#475569'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">No sources available.</p>
                )}
              </MagicCard>

              {/* KPI Cards */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
                {[
                  { label: 'Total Sources', value: consensus?.totalSources ?? sources.length, icon: Database, color: 'text-indigo-400' },
                  { label: 'Healthy Sources', value: consensus?.healthySources ?? sources.filter(s => s.isHealthy).length, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Agreement %', value: `${consensus?.agreementPct ?? 0}%`, icon: Activity, color: 'text-sky-400' },
                  { label: 'Avg Confidence', value: `${consensus?.overallConfidence ?? 0}%`, icon: ShieldCheck, color: 'text-violet-400' },
                ].map(item => (
                  <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`mt-1 text-2xl font-semibold ${item.color}`}>{item.value}</p>
                      </div>
                      <item.icon className={`h-6 w-6 ${item.color} opacity-60`} />
                    </div>
                  </MagicCard>
                ))}
              </div>
            </div>

            {/* Source Details Table */}
            <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Oracle Source Details
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="text-left py-2 px-3">Source</th>
                      <th className="text-center py-2 px-3">Status</th>
                      <th className="text-center py-2 px-3">Weight</th>
                      <th className="text-right py-2 px-3">Confidence</th>
                      <th className="text-right py-2 px-3">Success</th>
                      <th className="text-right py-2 px-3">Failures</th>
                      <th className="text-right py-2 px-3">Failure Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map(s => {
                      const wCfg = WEIGHT_CFG[s.weight] ?? WEIGHT_CFG.medium;
                      return (
                        <tr key={s.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-medium text-white capitalize">{s.name}</td>
                          <td className="py-3 px-3 text-center">
                            {s.isHealthy
                              ? <span className="flex items-center justify-center gap-1 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Healthy</span>
                              : <span className="flex items-center justify-center gap-1 text-red-400"><XCircle className="h-4 w-4" /> Unhealthy</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-xs font-medium ${wCfg.color}`}>{wCfg.label}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${s.confidence}%` }} />
                              </div>
                              <span className="text-white font-medium">{s.confidence}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400">{s.successCount}</td>
                          <td className="py-3 px-3 text-right text-red-400">{s.failureCount}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{(s.failureRate * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
