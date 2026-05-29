import { useEffect, useState } from 'react';
import { BarChart2, RefreshCw, Search } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

function correlationColor(r: number): string {
  if (r >= 0.7) return 'bg-green-500';
  if (r >= 0.3) return 'bg-green-300';
  if (r >= -0.3) return 'bg-gray-400';
  if (r >= -0.7) return 'bg-red-300';
  return 'bg-red-500';
}

function correlationTextColor(r: number): string {
  if (Math.abs(r) >= 0.5) return 'text-white';
  return 'text-gray-900';
}

interface HeatmapData {
  labels: Array<{ id: string; question: string }>;
  matrix: number[][];
}

interface RelatedMarket {
  marketId: string;
  question: string;
  category: string;
  correlation: number;
}

export default function MarketCorrelation() {
  const [idsInput, setIdsInput] = useState('');
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [relatedMarketId, setRelatedMarketId] = useState('');
  const [related, setRelated] = useState<RelatedMarket[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const fetchHeatmap = async () => {
    const ids = idsInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length < 2) {
      toast.error('Enter at least 2 comma-separated market IDs');
      return;
    }
    try {
      setLoadingHeatmap(true);
      const data = await apiService.correlation.getHeatmap(ids);
      setHeatmap(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load heatmap');
    } finally {
      setLoadingHeatmap(false);
    }
  };

  const fetchRelated = async () => {
    if (!relatedMarketId.trim()) return;
    try {
      setLoadingRelated(true);
      const data = await apiService.correlation.getRelated(relatedMarketId.trim());
      setRelated(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load related markets');
    } finally {
      setLoadingRelated(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="h-8 w-8 text-cyan-400" />
            Cross-Market Correlation
          </h1>
          <p className="text-gray-400 mt-1">Understand relationships between prediction markets</p>
        </div>

        <div className="space-y-8">
          {/* Heatmap Section */}
          <MagicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Correlation Heatmap</h2>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Market IDs (comma-separated)"
                value={idsInput}
                onChange={(e) => setIdsInput(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={fetchHeatmap} disabled={loadingHeatmap} className="gap-2">
                {loadingHeatmap ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Generate
              </Button>
            </div>

            {heatmap && (
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-1" />
                      {heatmap.labels.map((l) => (
                        <th key={l.id} className="p-1 text-gray-400 font-normal max-w-[80px] truncate" title={l.question}>
                          {l.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.matrix.map((row, i) => (
                      <tr key={heatmap.labels[i].id}>
                        <td className="p-1 text-gray-400 pr-2 max-w-[80px] truncate" title={heatmap.labels[i].question}>
                          {heatmap.labels[i].id}
                        </td>
                        {row.map((val, j) => (
                          <td
                            key={j}
                            className={`p-2 text-center font-mono rounded ${correlationColor(val)} ${correlationTextColor(val)}`}
                            title={`${heatmap.labels[i].id} vs ${heatmap.labels[j].id}: ${val}`}
                          >
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Strong positive</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Neutral</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Strong negative</span>
                </div>
              </div>
            )}
          </MagicCard>

          {/* Related Markets Section */}
          <MagicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Related Markets</h2>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Market ID"
                value={relatedMarketId}
                onChange={(e) => setRelatedMarketId(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={fetchRelated} disabled={loadingRelated} className="gap-2">
                {loadingRelated ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find
              </Button>
            </div>

            {related.length > 0 && (
              <div className="space-y-2">
                {related.map((m) => (
                  <div key={m.marketId} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm text-white">{m.question}</p>
                      <p className="text-xs text-gray-400">{m.category} · {m.marketId}</p>
                    </div>
                    <span className={`text-sm font-mono font-bold ${m.correlation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {m.correlation >= 0 ? '+' : ''}{m.correlation.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
}
