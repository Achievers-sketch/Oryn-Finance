import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  FileJson,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { apiService } from '@/services/apiService';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { API_CONFIG } from '@/lib/api-config';

const CATEGORIES = ['', 'authentication', 'transaction', 'admin', 'treasury', 'system'];
const STATUSES = ['', 'success', 'failure'];

function categoryColor(category: string) {
  switch (category) {
    case 'authentication':
      return 'bg-sky-500/15 text-sky-400';
    case 'transaction':
      return 'bg-emerald-500/15 text-emerald-400';
    case 'admin':
      return 'bg-purple-500/15 text-purple-400';
    case 'treasury':
      return 'bg-amber-500/15 text-amber-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatTimestamp(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US');
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState<any>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<{ category: string; status: string; page: number }>({
    category: '',
    status: '',
    page: 1,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        apiService.audit
          .getLogs({
            category: filters.category || undefined,
            status: filters.status || undefined,
            page: filters.page,
            limit: 25,
          })
          .catch(() => null),
        apiService.audit.getStats().catch(() => null),
      ]);
      setLogs(logsResult?.logs || []);
      setPagination(logsResult?.pagination || { page: 1, pages: 1, total: 0 });
      setStats(statsResult);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export reuses the same auth header the api-client set, then triggers a
  // browser download of the returned file.
  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const url = `${API_CONFIG.BASE_URL}${apiService.audit.getExportUrl(format, {
        category: filters.category || undefined,
        status: filters.status || undefined,
      })}`;

      // The backend accepts the wallet address directly as a bearer token
      // (matching the rest of the app) in addition to the httpOnly auth cookie.
      const token = localStorage.getItem('walletAddress');
      const response = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error(`Export failed (${response.status})`);

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `audit-logs.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Audit log export failed', error);
    } finally {
      setExporting(false);
    }
  };

  const metrics = [
    { label: 'Total Events', value: stats?.total ?? 0, icon: Activity, color: 'text-primary' },
    { label: 'Last 24h', value: stats?.events24h ?? 0, icon: RefreshCw, color: 'text-sky-400' },
    { label: 'Successful', value: stats?.byStatus?.success ?? 0, icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'Failures', value: stats?.byStatus?.failure ?? 0, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Centralized record of critical platform actions for compliance and security monitoring
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => handleExport('json')} disabled={exporting} variant="outline" size="sm">
              <FileJson className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button onClick={() => handleExport('csv')} disabled={exporting} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <MagicCard key={label} className="glass-card p-6" gradientColor="#262626">
              <Icon className={`w-5 h-5 mb-2 ${color}`} />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </MagicCard>
          ))}
        </div>

        <MagicCard className="glass-card p-6" gradientColor="#262626">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c || 'all'} value={c}>
                  {c ? c.charAt(0).toUpperCase() + c.slice(1) : 'All categories'}
                </option>
              ))}
            </select>
            <select
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All statuses'}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground ml-auto">
              {pagination.total} event{pagination.total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Actor</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {loading ? 'Loading audit logs…' : 'No audit logs found'}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.eventId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className={categoryColor(log.category)} variant="secondary">
                          {log.category}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{log.action}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {log.actor?.walletAddress
                          ? `${log.actor.walletAddress.slice(0, 10)}…`
                          : 'system'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant="secondary"
                          className={
                            log.status === 'failure'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 max-w-md truncate" title={log.description}>
                        {log.description || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1 || loading}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= pagination.pages || loading}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </MagicCard>
      </div>
    </Layout>
  );
}
