import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, RefreshCw, Shield } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

interface DashboardData {
  myDelegation: { delegate: string; delegatedAt: string } | null;
  delegatedToMe: Array<{ delegator: string; votingPower: number; delegatedAt: string }>;
  totalDelegatedPower: number;
  effectiveVotingPower: number;
}

export default function GovernanceDelegation() {
  const { isConnected, connect, publicKey } = useWallet();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [delegateInput, setDelegateInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboard = async () => {
    if (!publicKey) return;
    try {
      setLoading(true);
      const data = await apiService.governanceDelegation.getDashboard();
      setDashboard(data);
    } catch {
      toast.error('Failed to load delegation dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) fetchDashboard();
  }, [publicKey]);

  const handleDelegate = async () => {
    if (!delegateInput.trim()) return;
    try {
      setSubmitting(true);
      await apiService.governanceDelegation.delegate(delegateInput.trim());
      toast.success('Voting power delegated successfully');
      setDelegateInput('');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delegate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setSubmitting(true);
      await apiService.governanceDelegation.revoke();
      toast.success('Delegation revoked');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Shield className="h-8 w-8 text-purple-400" />
              Governance Delegation
            </h1>
            <p className="text-gray-400 mt-1">Delegate your voting power to trusted representatives</p>
          </div>
          {publicKey && (
            <Button variant="outline" onClick={fetchDashboard} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {!isConnected ? (
          <MagicCard className="p-8 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to manage governance delegation</p>
            <Button onClick={connect}>Connect Wallet</Button>
          </MagicCard>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Effective Voting Power', value: dashboard?.effectiveVotingPower ?? '—', icon: Shield, color: 'text-purple-400' },
                { label: 'Delegated to Me', value: dashboard?.delegatedToMe.length ?? '—', icon: Users, color: 'text-blue-400' },
                { label: 'Total Delegated Power', value: dashboard?.totalDelegatedPower ?? '—', icon: UserCheck, color: 'text-green-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <MagicCard key={label} className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${color}`} />
                    <div>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-xl font-bold text-white">{value}</p>
                    </div>
                  </div>
                </MagicCard>
              ))}
            </div>

            {/* Current Delegation */}
            <MagicCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">My Delegation</h2>
              {dashboard?.myDelegation ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Delegated to</p>
                    <p className="text-white font-mono text-sm">{dashboard.myDelegation.delegate}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Since {new Date(dashboard.myDelegation.delegatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleRevoke} disabled={submitting} className="gap-2">
                    <UserX className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">You have not delegated your voting power.</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Delegate address (Stellar public key)"
                      value={delegateInput}
                      onChange={(e) => setDelegateInput(e.target.value)}
                      className="flex-1 bg-gray-800 border-gray-700 text-white"
                    />
                    <Button onClick={handleDelegate} disabled={submitting || !delegateInput.trim()} className="gap-2">
                      <UserCheck className="h-4 w-4" />
                      Delegate
                    </Button>
                  </div>
                </div>
              )}
            </MagicCard>

            {/* Delegators */}
            <MagicCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Delegated to Me</h2>
              {!dashboard?.delegatedToMe.length ? (
                <p className="text-sm text-gray-400">No one has delegated to you yet.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.delegatedToMe.map((d) => (
                    <div key={d.delegator} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <span className="font-mono text-sm text-gray-300">{d.delegator}</span>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        +{d.votingPower} power
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </MagicCard>
          </div>
        )}
      </div>
    </Layout>
  );
}
