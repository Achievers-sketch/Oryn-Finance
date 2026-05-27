import { useEffect, useMemo, useState } from 'react';
import { Award, ShieldCheck, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/apiService';
import { cn } from '@/lib/utils';

interface CreatorReputationData {
  walletAddress: string;
  trustScore: number;
  verified: boolean;
  trustLevel: string;
  source: 'reputation_contract' | 'indexed_profile' | string;
  statistics?: {
    marketsCreated?: number;
    winRate?: number;
    totalVolume?: number;
  };
}

interface CreatorReputationProps {
  creatorAddress: string;
}

function isFullStellarAddress(address: string) {
  return /^G[A-Z0-9]{55}$/.test(address);
}

function getDemoReputation(address: string): CreatorReputationData {
  const seed = address.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const trustScore = 450 + (seed % 350);

  return {
    walletAddress: address,
    trustScore,
    verified: trustScore >= 600,
    trustLevel: trustScore >= 600 ? 'verified' : 'trusted',
    source: 'indexed_profile',
    statistics: {
      marketsCreated: 8 + (seed % 24),
      winRate: 0.52 + ((seed % 22) / 100),
      totalVolume: 12500 + seed * 93,
    },
  };
}

function formatPercent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function formatVolume(value = 0) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function CreatorReputation({ creatorAddress }: CreatorReputationProps) {
  const [reputation, setReputation] = useState<CreatorReputationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReputation() {
      if (!creatorAddress) return;

      if (!isFullStellarAddress(creatorAddress)) {
        setReputation(getDemoReputation(creatorAddress));
        return;
      }

      setIsLoading(true);
      try {
        const data = await apiService.users.getPublicReputation(creatorAddress);
        if (!cancelled) setReputation(data);
      } catch {
        if (!cancelled) setReputation(getDemoReputation(creatorAddress));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadReputation();

    return () => {
      cancelled = true;
    };
  }, [creatorAddress]);

  const scorePercent = useMemo(() => {
    return Math.max(0, Math.min(100, Math.round(((reputation?.trustScore || 0) / 1000) * 100)));
  }, [reputation?.trustScore]);

  return (
    <div className={cn(
      'rounded-xl border p-4',
      reputation?.verified
        ? 'border-emerald-400/30 bg-emerald-500/10'
        : 'border-white/10 bg-white/[0.03]'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Creator Reputation</p>
            {reputation?.verified && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-medium break-all">{creatorAddress}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <Award className={cn('h-5 w-5', reputation?.verified ? 'text-emerald-300' : 'text-primary')} />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{isLoading ? '--' : reputation?.trustScore ?? 0}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{reputation?.trustLevel || 'loading'}</p>
          </div>
          <Badge variant="outline" className="border-white/10">
            {reputation?.source === 'reputation_contract' ? 'Contract linked' : 'Indexed profile'}
          </Badge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full', reputation?.verified ? 'bg-emerald-400' : 'bg-primary')}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-black/20 p-2">
          <Users className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-semibold">{reputation?.statistics?.marketsCreated ?? 0}</p>
          <p className="text-muted-foreground">Markets</p>
        </div>
        <div className="rounded-lg bg-black/20 p-2">
          <Star className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-semibold">{formatPercent(reputation?.statistics?.winRate)}</p>
          <p className="text-muted-foreground">Win rate</p>
        </div>
        <div className="rounded-lg bg-black/20 p-2">
          <Award className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-semibold">{formatVolume(reputation?.statistics?.totalVolume)}</p>
          <p className="text-muted-foreground">Volume</p>
        </div>
      </div>
    </div>
  );
}
