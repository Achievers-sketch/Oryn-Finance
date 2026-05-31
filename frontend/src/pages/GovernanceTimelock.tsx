import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, RefreshCw, Loader2, CheckCircle2, XCircle, Timer, Play, History } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

type ActionStatus = 'pending' | 'executed' | 'cancelled';

const STATUS_CFG: Record<ActionStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Timer },
  executed: { label: 'Executed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle },
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Ready';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CountdownBadge({ executeAfter, totalMs, status }: { executeAfter: string; totalMs: number; status: ActionStatus }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (status !== 'pending') return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status !== 'pending') return null;

  const remaining = Math.max(0, new Date(executeAfter).getTime() - Date.now());
  const pct = totalMs > 0 ? Math.max(0, (remaining / totalMs) * 100) : 0;
  const isReady = remaining <= 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`text-sm font-mono font-bold ${isReady ? 'text-emerald-400' : 'text-yellow-300'}`}>
        {isReady ? '✓ Ready to execute' : formatCountdown(remaining)}
      </span>
      {!isReady && (
        <div className="w-28 h-1.5 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function GovernanceTimelock() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | ActionStatus>('all');

  const load = useCallback(async (bg = false) => {
    bg ? setRefreshing(true) : setLoading(true);
    try {
      const result = await apiService.governanceTimelock.getActions();
      setData(result);
    } catch {
      toast.error('Failed to load timelock actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const allActions: any[] = data?.actions ?? [];
  const summary = data?.summary;

  const filtered = useMemo(() =>
    filter === 'all' ? allActions : allActions.filter(a => a.status === filter),
    [allActions, filter]);

  const pending = allActions.filter(a => a.status === 'pending');
  const executed = allActions.filter(a => a.status === 'executed');

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary">Governance</Badge>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              Governance Timelock Monitoring
            </h1>
            <p className="text-gray-400 mt-1">Countdown tracking, pending action dashboard, and execution history</p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing} className="gap-2 border-white/10 bg-white/5">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading timelock actions…</p>
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Actions', value: summary.total, color: 'text-white', icon: Clock },
                  { label: 'Pending', value: summary.pending, color: 'text-yellow-400', icon: Timer },
                  { label: 'Executed', value: summary.executed, color: 'text-emerald-400', icon: CheckCircle2 },
                  { label: 'Ready Now', value: summary.readyToExecute, color: 'text-sky-400', icon: Play },
                ].map(item => (
                  <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">{item.label}</p>
                        <p className={`mt-2 text-3xl font-semibold ${item.color}`}>{item.value}</p>
                      </div>
                      <item.icon className={`h-6 w-6 ${item.color} opacity-60`} />
                    </div>
                  </MagicCard>
                ))}
              </div>
            )}

            {/* Pending Actions Dashboard */}
            {pending.length > 0 && (
              <MagicCard className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Timer className="h-5 w-5 text-yellow-400" /> Pending Actions — Countdown
                </h2>
                <div className="space-y-3">
                  {pending.map(action => (
                    <div key={action.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{action.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{action.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Target: <span className="text-gray-300">{action.target}</span></span>
                          <span>Queued: <span className="text-gray-300">{fmtDate(action.queuedAt)}</span></span>
                          <span>Execute after: <span className="text-yellow-300">{fmtDate(action.executeAfter)}</span></span>
                        </div>
                      </div>
                      <CountdownBadge executeAfter={action.executeAfter} totalMs={action.timelockDuration} status={action.status} />
                    </div>
                  ))}
                </div>
              </MagicCard>
            )}

            {/* Filter Tabs + Full Table */}
            <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> All Actions
                </h2>
                <div className="flex gap-2">
                  {(['all', 'pending', 'executed', 'cancelled'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
                  <p className="text-muted-foreground">No actions found for this filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left py-2 px-3">Action</th>
                        <th className="text-left py-2 px-3">Target</th>
                        <th className="text-center py-2 px-3">Status</th>
                        <th className="text-right py-2 px-3">Execute After</th>
                        <th className="text-right py-2 px-3">Executed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(action => {
                        const cfg = STATUS_CFG[action.status as ActionStatus] ?? STATUS_CFG.pending;
                        const Icon = cfg.icon;
                        return (
                          <tr key={action.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 max-w-xs">
                              <p className="text-white text-sm font-medium truncate">{action.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                            </td>
                            <td className="py-3 px-3 text-gray-300 text-xs">{action.target}</td>
                            <td className="py-3 px-3 text-center">
                              <Badge className={`border ${cfg.bg} ${cfg.color} ${cfg.border} text-xs flex items-center gap-1 w-fit mx-auto`}>
                                <Icon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right text-xs text-muted-foreground">{fmtDate(action.executeAfter)}</td>
                            <td className="py-3 px-3 text-right text-xs text-muted-foreground">
                              {action.executedAt ? fmtDate(action.executedAt) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </MagicCard>

            {/* Execution History */}
            {executed.length > 0 && (
              <MagicCard className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 mt-6">
                <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Execution History
                </h2>
                <div className="space-y-2">
                  {executed.map(action => (
                    <div key={action.id} className="flex items-center justify-between gap-4 text-sm border-b border-white/5 py-2">
                      <span className="text-gray-200 truncate flex-1">{action.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{action.executedAt ? fmtDate(action.executedAt) : '—'}</span>
                      {action.executor && (
                        <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                          {action.executor.slice(0, 6)}…{action.executor.slice(-4)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </MagicCard>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
