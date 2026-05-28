import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, RotateCcw } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/magicui/magic-card';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  executed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  reverted: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export default function CrossChainMonitor() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txData, statsData] = await Promise.all([
        apiService.crossChain.listTransactions(),
        apiService.crossChain.getStats(),
      ]);
      setTransactions(txData || []);
      setStats(statsData);
    } catch {
      toast.error('Failed to load cross-chain data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecover = async (txId: string) => {
    try {
      setRecovering(txId);
      await apiService.crossChain.recoverTransaction(txId);
      toast.success(`Recovery initiated for ${txId}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Recovery failed');
    } finally {
      setRecovering(null);
    }
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: Activity, color: 'text-blue-400' },
    { label: 'Pending', value: stats?.byStatus?.pending ?? 0, icon: Clock, color: 'text-yellow-400' },
    { label: 'Executed', value: stats?.byStatus?.executed ?? 0, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Failed', value: (stats?.byStatus?.failed ?? 0) + (stats?.byStatus?.reverted ?? 0), icon: AlertTriangle, color: 'text-red-400' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Cross-Chain Monitor</h1>
            <p className="text-gray-400 mt-1">Track X402 transaction states and recover failed bridge operations</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <MagicCard key={label} className="p-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-6 w-6 ${color}`} />
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-sm text-gray-400">{label}</p>
                </div>
              </div>
            </MagicCard>
          ))}
        </div>

        {/* Transactions Table */}
        <MagicCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Tracked Transactions</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No transactions tracked yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 pr-4">TX ID</th>
                    <th className="text-left py-2 pr-4">Chain</th>
                    <th className="text-left py-2 pr-4">Amount</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Recovery</th>
                    <th className="text-left py-2">Updated</th>
                    <th className="text-right py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.txId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300 truncate max-w-[120px]">{tx.txId}</td>
                      <td className="py-3 pr-4 text-gray-300">{tx.bridgeChain}</td>
                      <td className="py-3 pr-4 text-white">{tx.amount}</td>
                      <td className="py-3 pr-4">
                        <Badge className={STATUS_COLORS[tx.status] || ''}>{tx.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{tx.recoveryAttempts > 0 ? `#${tx.recoveryAttempts}` : '—'}</td>
                      <td className="py-3 text-gray-400 text-xs">{new Date(tx.updatedAt).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        {(tx.status === 'failed' || tx.status === 'reverted') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRecover(tx.txId)}
                            disabled={recovering === tx.txId}
                            className="gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {recovering === tx.txId ? 'Recovering...' : 'Recover'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MagicCard>
      </div>
    </Layout>
  );
}
