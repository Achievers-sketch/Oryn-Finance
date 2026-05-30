import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2, RefreshCcw, Loader2, Users, Vote, TrendingUp, Activity,
  CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { contractService } from '@/services/contractService';
import { type GovernanceProposal } from '@/lib/governance';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  ended: '#f59e0b',
  executed: '#3b82f6',
};

const VOTE_COLORS = {
  YES: '#10b981',
  NO: '#ef4444',
  ABSTAIN: '#94a3b8',
};

function fmtDate(iso: string | null) {
  if (!iso) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function buildParticipationHistory(proposals: GovernanceProposal[]) {
  return [...proposals]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    })
    .map((p, i) => ({
      name: `P${i + 1}`,
      label: p.title.slice(0, 20) + (p.title.length > 20 ? '…' : ''),
      totalVotes: p.totalVotes,
      yes: p.yesVotes,
      no: p.noVotes,
      abstain: p.abstainVotes,
      status: p.status,
    }));
}

export default function GovernanceAnalytics() {
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    background ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const data = await contractService.getGovernanceProposals();
      setProposals(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load governance data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const total = proposals.length;
    const active = proposals.filter(p => p.status === 'active').length;
    const executed = proposals.filter(p => p.status === 'executed').length;
    const ended = proposals.filter(p => p.status === 'ended').length;
    const totalVotes = proposals.reduce((s, p) => s + p.totalVotes, 0);
    const avgTurnout = total > 0 ? totalVotes / total : 0;
    const uniqueVoters = new Set(proposals.flatMap(p => p.votes.map(v => v.voter.toLowerCase()))).size;
    const passRate = total > 0
      ? Math.round((proposals.filter(p => p.yesVotes > p.noVotes).length / total) * 100)
      : 0;
    return { total, active, executed, ended, totalVotes, avgTurnout, uniqueVoters, passRate };
  }, [proposals]);

  const participationHistory = useMemo(() => buildParticipationHistory(proposals), [proposals]);

  const statusDistribution = useMemo(() => [
    { name: 'Active', value: stats.active, color: STATUS_COLORS.active },
    { name: 'Executed', value: stats.executed, color: STATUS_COLORS.executed },
    { name: 'Ended', value: stats.ended, color: STATUS_COLORS.ended },
  ].filter(d => d.value > 0), [stats]);

  const voteDistribution = useMemo(() => {
    const yes = proposals.reduce((s, p) => s + p.yesVotes, 0);
    const no = proposals.reduce((s, p) => s + p.noVotes, 0);
    const abstain = proposals.reduce((s, p) => s + p.abstainVotes, 0);
    return [
      { name: 'YES', value: yes, color: VOTE_COLORS.YES },
      { name: 'NO', value: no, color: VOTE_COLORS.NO },
      { name: 'ABSTAIN', value: abstain, color: VOTE_COLORS.ABSTAIN },
    ].filter(d => d.value > 0);
  }, [proposals]);

  const topVoters = useMemo(() => {
    const voterMap = new Map<string, number>();
    for (const proposal of proposals) {
      for (const vote of proposal.votes) {
        const key = vote.voter.toLowerCase();
        voterMap.set(key, (voterMap.get(key) ?? 0) + vote.weight);
      }
    }
    return Array.from(voterMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([voter, weight], i) => ({ rank: i + 1, voter, weight }));
  }, [proposals]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 border-primary/30 bg-primary/10 text-primary">Analytics</Badge>
            <h1 className="text-3xl font-bold md:text-5xl flex items-center gap-3">
              <BarChart2 className="h-9 w-9 text-primary" />
              Governance Analytics
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl">
              Historical voting participation, proposal pass rates, voter turnout trends, and per-proposal breakdowns.
            </p>
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 self-start" onClick={() => void load(true)}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* KPI cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total proposals', value: stats.total, icon: Vote },
            { label: 'Unique voters', value: stats.uniqueVoters, icon: Users },
            { label: 'Avg turnout / proposal', value: stats.avgTurnout.toFixed(1), icon: Activity },
            { label: 'Pass rate', value: `${stats.passRate}%`, icon: TrendingUp },
          ].map(item => (
            <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{isLoading ? '—' : item.value}</p>
                </div>
                <item.icon className="h-5 w-5 text-primary" />
              </div>
            </MagicCard>
          ))}
        </div>

        {/* Status overview row */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Active', value: stats.active, icon: Activity, color: 'text-emerald-400' },
            { label: 'Executed', value: stats.executed, icon: CheckCircle2, color: 'text-sky-400' },
            { label: 'Ended', value: stats.ended, icon: XCircle, color: 'text-amber-400' },
          ].map(item => (
            <MagicCard key={item.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-3">
                <item.icon className={`h-6 w-6 ${item.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{item.label}</p>
                  <p className="text-2xl font-semibold">{isLoading ? '—' : item.value}</p>
                </div>
              </div>
            </MagicCard>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading governance analytics…</p>
          </div>
        ) : proposals.length === 0 ? (
          <MagicCard className="mt-12 rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <Vote className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-semibold">No governance data indexed yet</h2>
            <p className="mt-2 text-muted-foreground">Proposals and votes will appear here once events are indexed.</p>
          </MagicCard>
        ) : (
          <>
            {/* Voter Turnout per Proposal */}
            <MagicCard className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Voter Turnout per Proposal
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={participationHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                      formatter={(v: number, name: string) => [v, name]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.label ?? label}
                    />
                    <Legend />
                    <Bar dataKey="yes" name="YES" fill={VOTE_COLORS.YES} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="no" name="NO" fill={VOTE_COLORS.NO} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="abstain" name="ABSTAIN" fill={VOTE_COLORS.ABSTAIN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MagicCard>

            {/* Participation trend line + distributions */}
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {/* Participation trend */}
              <MagicCard className="col-span-2 rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Participation Rate Trend
                </h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={participationHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.label ?? label}
                      />
                      <Line type="monotone" dataKey="totalVotes" name="Total votes" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </MagicCard>

              {/* Vote distribution pie */}
              <MagicCard className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="mb-4 text-lg font-semibold">All-time Vote Split</h2>
                {voteDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No votes recorded.</p>
                ) : (
                  <div className="h-56 flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie data={voteDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {voteDistribution.map(entry => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      {voteDistribution.map(d => (
                        <span key={d.name} className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name}: {d.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </MagicCard>
            </div>

            {/* Top voters */}
            {topVoters.length > 0 && (
              <MagicCard className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Most Active Voters
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left py-2 px-3">Rank</th>
                        <th className="text-left py-2 px-3">Voter</th>
                        <th className="text-right py-2 px-3">Voting weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topVoters.map(v => (
                        <tr key={v.voter} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 font-bold text-primary">#{v.rank}</td>
                          <td className="py-2 px-3 font-mono text-xs">{v.voter.slice(0, 8)}…{v.voter.slice(-4)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{v.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </MagicCard>
            )}

            {/* Historical per-proposal table */}
            <MagicCard className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Historical Proposal Analytics
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="text-left py-2 px-3">Proposal</th>
                      <th className="text-center py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Total votes</th>
                      <th className="text-right py-2 px-3">YES %</th>
                      <th className="text-right py-2 px-3">NO %</th>
                      <th className="text-right py-2 px-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 max-w-xs">
                          <span className="truncate block" title={p.title}>{p.title}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge style={{ backgroundColor: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status], borderColor: `${STATUS_COLORS[p.status]}40` }} className="border text-xs uppercase">
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right">{p.totalVotes}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">{p.yesShare.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right text-rose-400">{p.noShare.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{fmtDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MagicCard>
          </>
        )}
      </div>
    </Layout>
  );
}
