import { useEffect, useState } from 'react';
import { Bell, BellOff, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

const ALERT_TYPES = [
  { value: 'price_movement', label: 'Price Movement' },
  { value: 'liquidity_change', label: 'Liquidity Change' },
  { value: 'market_resolution', label: 'Market Resolution' },
];

interface Alert {
  id: string;
  marketId: string;
  alertType: string;
  threshold: number | null;
  active: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
}

export default function MarketAlerts() {
  const { isConnected, connect, publicKey } = useWallet();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [marketId, setMarketId] = useState('');
  const [alertType, setAlertType] = useState('price_movement');
  const [threshold, setThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = async () => {
    if (!publicKey) return;
    try {
      setLoading(true);
      const data = await apiService.marketAlerts.listAlerts();
      setAlerts(data);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) fetchAlerts();
  }, [publicKey]);

  const handleCreate = async () => {
    if (!marketId.trim()) { toast.error('Market ID required'); return; }
    try {
      setSubmitting(true);
      await apiService.marketAlerts.createAlert({
        marketId: marketId.trim(),
        alertType,
        threshold: threshold ? parseFloat(threshold) : undefined,
      });
      toast.success('Alert created');
      setMarketId('');
      setThreshold('');
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (alert: Alert) => {
    try {
      await apiService.marketAlerts.updateAlert(alert.id, { active: !alert.active });
      setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, active: !a.active } : a));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update alert');
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await apiService.marketAlerts.deleteAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success('Alert deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete alert');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Bell className="h-8 w-8 text-yellow-400" />
              Market Alerts
            </h1>
            <p className="text-gray-400 mt-1">Get notified on price movements, liquidity changes, and resolutions</p>
          </div>
          {publicKey && (
            <Button variant="outline" onClick={fetchAlerts} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {!isConnected ? (
          <MagicCard className="p-8 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to manage alerts</p>
            <Button onClick={connect}>Connect Wallet</Button>
          </MagicCard>
        ) : (
          <div className="space-y-6">
            {/* Create Alert */}
            <MagicCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-400" />
                New Alert
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Input
                  placeholder="Market ID"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <Select value={alertType} onValueChange={setAlertType}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Threshold % (optional)"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <Button onClick={handleCreate} disabled={submitting} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </div>
            </MagicCard>

            {/* Alert List */}
            <MagicCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">My Alerts ({alerts.length})</h2>
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-400">No alerts configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-white font-mono">{alert.marketId}</span>
                          <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">
                            {ALERT_TYPES.find((t) => t.value === alert.alertType)?.label ?? alert.alertType}
                          </Badge>
                          {alert.threshold !== null && (
                            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                              ≥{alert.threshold}%
                            </Badge>
                          )}
                          <Badge variant="outline" className={`text-xs ${alert.active ? 'text-green-400 border-green-500/30' : 'text-gray-400 border-gray-600'}`}>
                            {alert.active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        {alert.lastTriggeredAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(alert)} title={alert.active ? 'Pause' : 'Resume'}>
                          {alert.active ? <Bell className="h-4 w-4 text-yellow-400" /> : <BellOff className="h-4 w-4 text-gray-400" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
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
