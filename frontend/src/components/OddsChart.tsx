import { useEffect, useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMarketUpdates } from '@/contexts/WebSocketContext';
import { apiService } from '@/services/apiService';

interface OddsPoint {
  time: string;
  timestamp: number;
  yes: number;
  no: number;
  volume: number;
}

interface OddsChartProps {
  marketId: string;
  initialYesPrice: number;
  initialNoPrice: number;
  initialVolume?: number;
}

type TimeRange = '1D' | '7D' | '1M';

const RANGE_CONFIG: Record<TimeRange, { resolution: '5m' | '1h' | '1d'; limit: number; stepMs: number }> = {
  '1D': { resolution: '5m', limit: 288, stepMs: 5 * 60 * 1000 },
  '7D': { resolution: '1h', limit: 168, stepMs: 60 * 60 * 1000 },
  '1M': { resolution: '1d', limit: 30, stepMs: 24 * 60 * 60 * 1000 },
};

function toProb(price: number): number {
  return Math.min(99, Math.max(1, Math.round(price * 100)));
}

function formatVolume(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function formatTime(timestamp: number, range: TimeRange): string {
  const date = new Date(timestamp);
  if (range === '1D') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7D') {
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function seededWave(seed: string, index: number): number {
  const base = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Math.sin((base + index * 17) * 0.37) * 0.035 + Math.cos(index * 0.61) * 0.025;
}

function seedHistory(
  marketId: string,
  yesPrice: number,
  initialVolume: number,
  range: TimeRange
): OddsPoint[] {
  const config = RANGE_CONFIG[range];
  const points = range === '1D' ? 48 : config.limit;
  const bucketVolume = Math.max(initialVolume / Math.max(points, 1), 25);

  return Array.from({ length: points }, (_, i) => {
    const timestamp = Date.now() - (points - 1 - i) * config.stepMs;
    const trend = (i / Math.max(points - 1, 1) - 0.5) * 0.06;
    const projectedYes = Math.min(0.99, Math.max(0.01, yesPrice + seededWave(marketId, i) + trend));
    const volumePulse = 0.7 + Math.abs(Math.sin((i + marketId.length) * 0.45)) * 0.9;
    const yes = toProb(projectedYes);

    return {
      timestamp,
      time: formatTime(timestamp, range),
      yes,
      no: 100 - yes,
      volume: Math.round(bucketVolume * volumePulse),
    };
  });
}

function normalizeHistory(rawHistory: any[], range: TimeRange): OddsPoint[] {
  return rawHistory
    .map((point) => {
      const timestamp = new Date(point.timestamp).getTime();
      const yes = toProb(point.yesPrice ?? point.marketPrices?.yesPriceAfter ?? 0.5);
      const no = toProb(point.noPrice ?? point.marketPrices?.noPriceAfter ?? 1 - yes / 100);

      return {
        timestamp,
        time: formatTime(timestamp, range),
        yes,
        no,
        volume: Number(point.volume ?? point.totalVolume ?? 0),
      };
    })
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function nowPoint(yesPrice: number, volume: number, range: TimeRange): OddsPoint {
  const timestamp = Date.now();
  const yes = toProb(yesPrice);

  return {
    timestamp,
    time: formatTime(timestamp, range),
    yes,
    no: 100 - yes,
    volume: Math.max(0, Math.round(volume)),
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const yes = payload.find((p: any) => p.dataKey === 'yes');
  const no = payload.find((p: any) => p.dataKey === 'no');
  const volume = payload.find((p: any) => p.dataKey === 'volume');

  return (
    <div className="glass-card px-3 py-2 text-xs border border-white/10 space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {yes && <p className="text-success font-semibold">YES {yes.value}¢</p>}
      {no && <p className="text-destructive font-semibold">NO {no.value}¢</p>}
      {volume && <p className="text-primary font-semibold">Volume {formatVolume(volume.value)}</p>}
    </div>
  );
};

export function OddsChart({
  marketId,
  initialYesPrice,
  initialNoPrice,
  initialVolume = 0,
}: OddsChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1D');
  const [history, setHistory] = useState<OddsPoint[]>(() => (
    seedHistory(marketId, initialYesPrice, initialVolume, '1D')
  ));
  const [liveYes, setLiveYes] = useState(toProb(initialYesPrice));
  const [liveNo, setLiveNo] = useState(toProb(initialNoPrice));
  const [isLive, setIsLive] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const { marketData, connectionQuality } = useMarketUpdates(marketId);

  const selectedConfig = RANGE_CONFIG[selectedRange];

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsLoadingHistory(true);
      setIsUsingFallback(false);

      try {
        const response = await apiService.markets.getMarketHistory(marketId, {
          resolution: selectedConfig.resolution,
          limit: selectedConfig.limit,
        });
        const nextHistory = normalizeHistory(response?.history ?? [], selectedRange);

        if (cancelled) return;
        if (nextHistory.length > 0) {
          setHistory(nextHistory);
        } else {
          setIsUsingFallback(true);
          setHistory(seedHistory(marketId, initialYesPrice, initialVolume, selectedRange));
        }
      } catch {
        if (cancelled) return;
        setIsUsingFallback(true);
        setHistory(seedHistory(marketId, initialYesPrice, initialVolume, selectedRange));
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [marketId, initialYesPrice, initialVolume, selectedConfig.limit, selectedConfig.resolution, selectedRange]);

  useEffect(() => {
    if (!marketData) return;

    const rawYes =
      marketData.prices?.yes ??
      marketData.currentYesPrice ??
      marketData.yesPrice;

    if (rawYes == null) return;

    const yesProb = toProb(rawYes);
    setLiveYes(yesProb);
    setLiveNo(100 - yesProb);
    setIsLive(true);

    setHistory(prev => {
      const rawVolume = Number(
        marketData.volume24h ??
        marketData.volume ??
        marketData.totalVolume ??
        prev[prev.length - 1]?.volume ??
        0
      );
      const next = [...prev, nowPoint(rawYes, rawVolume, selectedRange)];
      return next.length > selectedConfig.limit ? next.slice(next.length - selectedConfig.limit) : next;
    });
  }, [marketData, selectedConfig.limit, selectedRange]);

  const currentYes = history[history.length - 1]?.yes ?? liveYes;
  const currentNo = history[history.length - 1]?.no ?? liveNo;
  const totalVisibleVolume = useMemo(
    () => history.reduce((sum, point) => sum + point.volume, 0),
    [history]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">YES {currentYes}¢</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-sm font-bold text-red-400">NO {currentNo}¢</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-bold text-primary">{formatVolume(totalVisibleVolume)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['1D', '7D', '1M'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              type="button"
              size="sm"
              variant={selectedRange === range ? 'default' : 'outline'}
              className="h-8 px-3 text-xs"
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </Button>
          ))}
          <Badge
            variant="outline"
            className={`text-[10px] ${
              isLive && connectionQuality === 'good'
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                : isUsingFallback
                  ? 'border-warning/30 text-warning bg-warning/10'
                  : 'border-white/20 text-white/40'
            }`}
          >
            {isLive && connectionQuality === 'good' ? 'LIVE' : isUsingFallback ? 'DEMO' : isLoadingHistory ? 'LOADING' : 'HISTORY'}
          </Badge>
        </div>
      </div>

      <div className="h-[220px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={history} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="price"
              domain={[0, 100]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `${v}¢`}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatVolume}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="price" y={50} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-white/60 capitalize">{value}</span>
              )}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="Volume"
              fill="hsl(var(--chart-volume))"
              fillOpacity={0.28}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="yes"
              name="YES"
              stroke="hsl(var(--chart-yes))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="no"
              name="NO"
              stroke="hsl(var(--chart-no))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
