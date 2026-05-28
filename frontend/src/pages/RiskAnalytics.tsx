import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { MagicCard } from '@/components/magicui/magic-card';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa'];

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

export default function RiskAnalytics() {
  const { publicKey } = useWallet();
  const [exposure, setExposure] = useState<any>(null);
  const [diversification, setDiversification] = useState<any>(null);
  const [volatility, setVolatility] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (wallet: string) => {
    try {
      setLoading(true);
      const [expData, divData, volData] = await Promise.all([
        apiService.risk.getRiskExposure(wallet),
        apiService.risk.getDiversification(wallet),
        apiService.risk.getVolatility(wallet),
      ]);
      setExposure(expData);
      setDiversification(divData);
      setVolatility(volData);
    } catch {
      toast.error('Failed to load risk analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) fetchData(publicKey);
  }, [publicKey]);

  const exposureCards = exposure
    ? [
        { label: 'Total Exposure', value: `$${exposure.totalExposure.toFixed(2)}`, icon: BarChart3, color: 'text-blue-400' },
        { label: 'Risk Level', value: exposure.riskLevel.toUpperCase(), icon: AlertTriangle, color: RISK_BADGE[exposure.riskLevel] },
        { label: 'Total P&L', value: `$${exposure.totalPnL.toFixed(2)}`, icon: TrendingUp, color: exposure.totalPnL >= 0 ? 'text-green-400' : 'text-red-400' },
        { label: 'Positions', value: exposure.positionCount, icon: ShieldCheck, color: 'text-purple-400' },
      ]
    : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio Risk Analytics</h1>
            <p className="text-gray-400 mt-1">Exposure, diversification, and volatility indicators</p>
          </div>
          {publicKey && (
            <Button variant="outline" onClick={() => fetchData(publicKey)} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {!publicKey ? (
          <MagicCard className="p-12 text-center">
            <p className="text-gray-400">Connect your wallet to view risk analytics.</p>
          </MagicCard>
        ) : loading && !exposure ? (
          <div className="text-center py-20 text-gray-400">Loading risk data...</div>
        ) : (
          <>
            {/* Exposure Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {exposureCards.map(({ label, value, icon: Icon, color }) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Diversification Pie */}
              <MagicCard className="p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Portfolio Diversification</h2>
                {diversification && (
                  <p className="text-sm text-gray-400 mb-4">
                    Score: <span className="text-white font-bold">{diversification.diversificationScore}/100</span>
                    &nbsp;·&nbsp;{diversification.concentrationLevel}
                  </p>
                )}
                {diversification?.distribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={diversification.distribution}
                        dataKey="value"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, weight }) => `${category} (${(weight * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {diversification.distribution.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-center py-10">No active positions.</p>
                )}
              </MagicCard>

              {/* Volatility Panel */}
              <MagicCard className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Volatility Indicators</h2>
                {volatility ? (
                  <div className="space-y-4">
                    {[
                      { label: 'Volatility', value: volatility.volatility, desc: 'Overall price volatility' },
                      { label: 'Rolling Volatility (14d)', value: volatility.rollingVolatility, desc: '14-period rolling volatility' },
                      { label: 'Sharpe Ratio', value: volatility.sharpe, desc: 'Risk-adjusted return' },
                      { label: 'Mean Return', value: volatility.meanReturn, desc: 'Average trade return' },
                    ].map(({ label, value, desc }) => (
                      <div key={label} className="flex justify-between items-center border-b border-white/5 pb-3">
                        <div>
                          <p className="text-white font-medium">{label}</p>
                          <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                        <p className={`text-lg font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {value.toFixed(4)}
                        </p>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">Based on {volatility.sampleSize} trade returns</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-10">No trade history available.</p>
                )}
              </MagicCard>
            </div>

            {/* Exposure Breakdown Bar */}
            {exposure && (
              <MagicCard className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Yes vs No Exposure</h2>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={[{ name: 'Exposure', yes: exposure.yesExposure, no: exposure.noExposure }]} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `$${v}`} />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="yes" fill="#10b981" name="YES" radius={[4, 4, 4, 4]} />
                    <Bar dataKey="no" fill="#f43f5e" name="NO" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-2 text-sm">
                  <span className="text-green-400">● YES ${exposure.yesExposure.toFixed(2)}</span>
                  <span className="text-red-400">● NO ${exposure.noExposure.toFixed(2)}</span>
                  <span className="text-gray-400">Max Drawdown: {(exposure.avgMaxDrawdown * 100).toFixed(2)}%</span>
                </div>
              </MagicCard>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
