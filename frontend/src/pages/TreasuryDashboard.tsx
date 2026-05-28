import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { apiService } from '@/services/apiService';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, History, RefreshCw, ArrowRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function TreasuryDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [inflows, setInflows] = useState<any[]>([]);
  const [outflows, setOutflows] = useState<any[]>([]);
  const [govActions, setGovActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ov, inf, outf, gov] = await Promise.all([
        apiService.treasury.getOverview().catch(() => null),
        apiService.treasury.getInflows({ limit: 10 }).catch(() => []),
        apiService.treasury.getOutflows({ limit: 10 }).catch(() => []),
        apiService.treasury.getGovernanceActions({ limit: 10 }).catch(() => []),
      ]);
      setOverview(ov);
      setInflows(inf?.data || inf || []);
      setOutflows(outf?.data || outf || []);
      setGovActions(gov?.data || gov || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              Treasury Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Protocol fee collection, distributions, and governance actions</p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <MagicCard className="glass-card p-6" gradientColor="#262626">
              <DollarSign className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-bold">{fmt(overview.totalBalance || 0)}</p>
            </MagicCard>
            <MagicCard className="glass-card p-6" gradientColor="#262626">
              <TrendingUp className="w-5 h-5 text-success mb-2" />
              <p className="text-sm text-muted-foreground">Total Inflows</p>
              <p className="text-2xl font-bold">{fmt(overview.totalInflows || 0)}</p>
            </MagicCard>
            <MagicCard className="glass-card p-6" gradientColor="#262626">
              <TrendingDown className="w-5 h-5 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">Total Outflows</p>
              <p className="text-2xl font-bold">{fmt(overview.totalOutflows || 0)}</p>
            </MagicCard>
            <MagicCard className="glass-card p-6" gradientColor="#262626">
              <History className="w-5 h-5 text-warning mb-2" />
              <p className="text-sm text-muted-foreground">Governance Actions</p>
              <p className="text-2xl font-bold">{overview.totalGovernanceActions || 0}</p>
            </MagicCard>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" /> Recent Inflows
            </h2>
            {inflows.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No inflows recorded</p>
            ) : (
              <div className="space-y-3">
                {inflows.slice(0, 5).map((tx: any, i: number) => (
                  <div key={tx._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type || 'Fee'}</p>
                      <p className="text-xs text-muted-foreground">{tx.source || 'trading'}</p>
                    </div>
                    <span className="text-sm font-semibold text-success">+{fmt(tx.amount || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" /> Recent Outflows
            </h2>
            {outflows.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No outflows recorded</p>
            ) : (
              <div className="space-y-3">
                {outflows.slice(0, 5).map((tx: any, i: number) => (
                  <div key={tx._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type || 'Distribution'}</p>
                      <p className="text-xs text-muted-foreground">{tx.recipient || tx.description || ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">-{fmt(tx.amount || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-warning" /> Governance Actions
            </h2>
            {govActions.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No governance actions</p>
            ) : (
              <div className="space-y-3">
                {govActions.slice(0, 5).map((action: any, i: number) => (
                  <div key={action._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{action.type || 'Proposal'}</p>
                      <p className="text-xs text-muted-foreground">{action.description || action.status || ''}</p>
                    </div>
                    <Badge variant="outline" className={
                      action.status === 'executed' ? 'text-green-400 border-green-500/30' :
                      action.status === 'pending' ? 'text-yellow-400 border-yellow-500/30' :
                      'text-muted-foreground'
                    }>
                      {action.status || 'unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </MagicCard>
        </div>

        <div className="mt-8 text-center">
          <Link to="/admin">
            <Button variant="outline">
              View Full Admin Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
