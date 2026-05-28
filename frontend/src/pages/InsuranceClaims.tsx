import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Shield, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MagicCard } from '@/components/magicui/magic-card';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

const INCIDENT_TYPES = ['oracle_failure', 'market_manipulation', 'smart_contract_bug', 'liquidity_drain', 'other'];

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  under_review: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  paid: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const DEFAULT_FORM = { policyId: '', incidentType: INCIDENT_TYPES[0], description: '', requestedAmount: '' };

export default function InsuranceClaims() {
  const { publicKey } = useWallet();
  const [claims, setClaims] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingPayout, setProcessingPayout] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [claimsData, statsData] = await Promise.all([
        apiService.insurance.listClaims(publicKey ? { walletAddress: publicKey } : undefined),
        apiService.insurance.getStats(),
      ]);
      setClaims(claimsData || []);
      setStats(statsData);
    } catch {
      toast.error('Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [publicKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return toast.error('Connect your wallet first');
    if (!form.policyId || !form.requestedAmount) return toast.error('Policy ID and amount are required');

    try {
      setSubmitting(true);
      await apiService.insurance.submitClaim({
        walletAddress: publicKey,
        policyId: form.policyId,
        incidentType: form.incidentType,
        description: form.description,
        requestedAmount: Number(form.requestedAmount),
      });
      toast.success('Claim submitted successfully');
      setForm(DEFAULT_FORM);
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayout = async (claimId: string) => {
    try {
      setProcessingPayout(claimId);
      await apiService.insurance.processPayout(claimId);
      toast.success('Payout processed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Payout failed');
    } finally {
      setProcessingPayout(null);
    }
  };

  const statCards = [
    { label: 'Total Claims', value: stats?.total ?? 0, icon: FileText, color: 'text-blue-400' },
    { label: 'Approved', value: stats?.byStatus?.approved ?? 0, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Rejected', value: stats?.byStatus?.rejected ?? 0, icon: XCircle, color: 'text-red-400' },
    { label: 'Total Paid Out', value: `$${(stats?.totalPaidOut ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-purple-400' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Insurance Claims</h1>
            <p className="text-gray-400 mt-1">Submit and track insurance claims for covered incidents</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowForm(v => !v)} className="gap-2">
              <Shield className="h-4 w-4" />
              {showForm ? 'Cancel' : 'New Claim'}
            </Button>
          </div>
        </div>

        {/* Stats */}
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

        {/* Submit Form */}
        {showForm && (
          <MagicCard className="p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Submit New Claim</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Policy ID</label>
                <Input
                  value={form.policyId}
                  onChange={e => setForm(f => ({ ...f, policyId: e.target.value }))}
                  placeholder="e.g. POL-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Incident Type</label>
                <select
                  value={form.incidentType}
                  onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white text-sm"
                >
                  {INCIDENT_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Requested Amount (USDC)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.requestedAmount}
                  onChange={e => setForm(f => ({ ...f, requestedAmount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the incident..."
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Claim'}
                </Button>
              </div>
            </form>
          </MagicCard>
        )}

        {/* Claims Table */}
        <MagicCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Your Claims</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No claims found. Submit your first claim above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 pr-4">Claim ID</th>
                    <th className="text-left py-2 pr-4">Policy</th>
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-left py-2 pr-4">Requested</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Submitted</th>
                    <th className="text-right py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.claimId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300 truncate max-w-[140px]">{c.claimId}</td>
                      <td className="py-3 pr-4 text-gray-300">{c.policyId}</td>
                      <td className="py-3 pr-4 text-gray-300 capitalize">{c.incidentType.replace(/_/g, ' ')}</td>
                      <td className="py-3 pr-4 text-white">${c.requestedAmount.toFixed(2)}</td>
                      <td className="py-3 pr-4">
                        <Badge className={STATUS_COLORS[c.status] || ''}>{c.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs">{new Date(c.submittedAt).toLocaleDateString()}</td>
                      <td className="py-3 text-right">
                        {c.status === 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => handlePayout(c.claimId)}
                            disabled={processingPayout === c.claimId}
                            className="gap-1"
                          >
                            <DollarSign className="h-3 w-3" />
                            {processingPayout === c.claimId ? 'Processing...' : 'Process Payout'}
                          </Button>
                        )}
                        {c.status === 'paid' && c.payoutTxHash && (
                          <span className="text-xs text-gray-400 font-mono">{c.payoutTxHash.slice(0, 12)}…</span>
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
