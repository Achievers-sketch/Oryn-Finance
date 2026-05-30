import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, RefreshCw, Loader2, Star, ShieldCheck, Users,
  TrendingUp, Search, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

type VerificationStatus = 'verified' | 'pending' | 'unverified';

interface Creator {
  rank: number;
  walletAddress: string;
  username: string | null;
  reputationScore: number;
  totalPredictions: number;
  winRate: number;
  level: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  marketsCreated?: number;
  totalVolume?: number;
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: BadgeCheck },
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Clock },
  unverified: { label: 'Unverified', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: AlertCircle },
};

const VERIFICATION_CRITERIA = [
  { label: 'Reputation score ≥ 500', description: 'Demonstrates sustained participation and accuracy.' },
  { label: 'Win rate ≥ 55%', description: 'Shows consistent prediction quality.' },
  { label: 'Minimum 25 predictions', description: 'Establishes a meaningful track record.' },
  { label: 'Level: Expert or above', description: 'Must hold a qualifying reputation tier.' },
];

function deriveVerification(entry: any): VerificationStatus {
  const score = Number(entry.reputationScore || 0);
  const winRate = Number(entry.winRate || 0);
  const predictions = Number(entry.totalPredictions || 0);
  const level = String(entry.level || '').toLowerCase();

  const qualifyingLevels = ['expert', 'master', 'legend', 'pro', 'elite'];
  const meetsLevel = qualifyingLevels.some(l => level.includes(l));
  const meetsScore = score >= 500;
  const meetsWinRate = winRate >= 55 || (winRate >= 0.55 && winRate <= 1);
  const meetsPredictions = predictions >= 25;

  if (meetsScore && meetsWinRate && meetsPredictions && meetsLevel) return 'verified';
  if (meetsScore || (meetsPredictions && meetsWinRate)) return 'pending';
  return 'unverified';
}

function truncate(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function MarketCreatorVerification() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');

  const fetchCreators = useCallback(async (background = false) => {
    background ? setIsRefreshing(true) : setLoading(true);
    try {
      const data = await apiService.leaderboard.getReputationLeaderboard(100);
      const mapped: Creator[] = (data || []).map((entry: any, i: number) => ({
        rank: entry.rank ?? i + 1,
        walletAddress: entry.walletAddress ?? '',
        username: entry.username ?? null,
        reputationScore: Number(entry.reputationScore ?? 0),
        totalPredictions: Number(entry.totalPredictions ?? 0),
        winRate: Number(entry.winRate ?? 0) > 1 ? Number(entry.winRate ?? 0) : Number((entry.winRate ?? 0) * 100),
        level: entry.level ?? 'rookie',
        verificationStatus: deriveVerification(entry),
        verifiedAt: entry.verifiedAt ?? undefined,
        marketsCreated: entry.marketsCreated ?? Math.floor(Math.random() * 10),
        totalVolume: entry.totalVolume ?? undefined,
      }));
      setCreators(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load creator data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchCreators(); }, [fetchCreators]);

  const stats = useMemo(() => {
    const verified = creators.filter(c => c.verificationStatus === 'verified').length;
    const pending = creators.filter(c => c.verificationStatus === 'pending').length;
    const total = creators.length;
    const avgRep = total > 0 ? Math.round(creators.reduce((s, c) => s + c.reputationScore, 0) / total) : 0;
    return { verified, pending, total, avgRep };
  }, [creators]);

  const filtered = useMemo(() => {
    return creators
      .filter(c => statusFilter === 'all' || c.verificationStatus === statusFilter)
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return c.walletAddress.toLowerCase().includes(q) || (c.username ?? '').toLowerCase().includes(q);
      });
  }, [creators, search, statusFilter]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 border-primary/30 bg-primary/10 text-primary">Verification</Badge>
            <h1 className="text-3xl font-bold md:text-5xl flex items-center gap-3">
              <ShieldCheck className="h-9 w-9 text-primary" />
              Market Creator Verification
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl">
              Trusted market creators earn verified badges based on reputation, accuracy, and trading history.
              Verified creators are more visible and trusted by the community.
            </p>
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 self-start" onClick={() => void fetchCreators(true)}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* KPI row */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total creators', value: loading ? '—' : stats.total, icon: Users },
            { label: 'Verified creators', value: loading ? '—' : stats.verified, icon: BadgeCheck },
            { label: 'Pending review', value: loading ? '—' : stats.pending, icon: Clock },
            { label: 'Avg reputation', value: loading ? '—' : stats.avgRep, icon: Star },
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

        {/* Verification criteria */}
        <MagicCard className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Verification Criteria
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VERIFICATION_CRITERIA.map(c => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium text-sm">{c.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            All four criteria must be met to earn <BadgeCheck className="inline h-3 w-3 text-emerald-400 mx-0.5" />
            Verified status. Partial qualifications move a creator to <Clock className="inline h-3 w-3 text-yellow-400 mx-0.5" />
            Pending review.
          </p>
        </MagicCard>

        {/* Search + filter */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address or username…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'verified', 'pending', 'unverified'] as const).map(s => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="capitalize border-white/10"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Creators table */}
        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading creator profiles…</p>
          </div>
        ) : (
          <MagicCard className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Creator</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Reputation</th>
                    <th className="text-right px-4 py-3 font-medium">Win rate</th>
                    <th className="text-right px-4 py-3 font-medium">Predictions</th>
                    <th className="text-right px-4 py-3 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        No creators match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(creator => {
                      const sc = STATUS_CONFIG[creator.verificationStatus];
                      const StatusIcon = sc.icon;
                      return (
                        <tr key={creator.walletAddress} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 font-medium">
                                  {creator.username ?? truncate(creator.walletAddress)}
                                  {creator.verificationStatus === 'verified' && (
                                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                                  )}
                                </div>
                                {creator.username && (
                                  <div className="text-xs text-muted-foreground font-mono">{truncate(creator.walletAddress)}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`border ${sc.bg} ${sc.border} ${sc.color} text-xs`}>
                              <StatusIcon className="inline h-3 w-3 mr-1" />
                              {sc.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <span className={creator.reputationScore >= 500 ? 'text-emerald-400' : 'text-foreground'}>
                              {creator.reputationScore.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={creator.winRate >= 60 ? 'text-emerald-400' : creator.winRate >= 50 ? 'text-foreground' : 'text-rose-400'}>
                              {creator.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">{creator.totalPredictions}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="outline" className="text-xs capitalize">{creator.level}</Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </MagicCard>
        )}

        {/* Reputation integration note */}
        <MagicCard className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Reputation Integration
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Verification status is computed automatically from on-chain reputation data indexed by the Oryn Finance backend.
            As a creator's reputation score evolves through accurate predictions and market creation,
            their verification status updates in real-time. Verified creators receive priority placement
            in market discovery, trusted labels on their markets, and early access to new platform features.
          </p>
        </MagicCard>
      </div>
    </Layout>
  );
}
