import { useEffect, useState } from 'react';
import { GitBranch, RefreshCw, CheckCircle2, AlertTriangle, History } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

interface ContractVersion {
  contractName: string;
  version: string;
  address: string;
  deployedAt: string;
  network: string;
  changelog: string;
  historyCount: number;
}

interface AuditResult {
  minimumVersion: string;
  totalContracts: number;
  upToDate: number;
  outdated: number;
  contracts: Array<{
    contractName: string;
    currentVersion: string;
    minimumVersion: string;
    isUpToDate: boolean;
    address: string;
  }>;
}

interface CompareResult {
  result: number;
  versionA: string;
  versionB: string;
  interpretation: string;
}

export default function ContractVersions() {
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditMin, setAuditMin] = useState('1.0.0');

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const data = await apiService.contracts.getVersions();
      setVersions(data.contracts ?? []);
    } catch {
      toast.error('Failed to load contract versions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const data = await apiService.contracts.getVersionAudit(auditMin);
      setAudit(data);
    } catch {
      toast.error('Failed to run audit');
    }
  };

  const handleCompare = async () => {
    if (!compareA.trim() || !compareB.trim()) { toast.error('Enter both versions'); return; }
    try {
      const data = await apiService.contracts.compareVersions(compareA.trim(), compareB.trim());
      setCompareResult(data);
    } catch {
      toast.error('Failed to compare versions');
    }
  };

  useEffect(() => { fetchVersions(); }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-8 w-8 text-indigo-400" />
              Contract Version Management
            </h1>
            <p className="text-gray-400 mt-1">Track deployed versions, compare releases, plan migrations</p>
          </div>
          <Button variant="outline" onClick={fetchVersions} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-6">
          {/* Deployed Versions */}
          <MagicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Deployed Contracts ({versions.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-2 pr-4">Contract</th>
                    <th className="pb-2 pr-4">Version</th>
                    <th className="pb-2 pr-4">Network</th>
                    <th className="pb-2 pr-4">Deployed</th>
                    <th className="pb-2">History</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.contractName} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-white font-medium">{v.contractName}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 font-mono">
                          v{v.version}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-400">{v.network}</td>
                      <td className="py-2 pr-4 text-gray-400">
                        {new Date(v.deployedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-1 text-gray-400">
                          <History className="h-3 w-3" />
                          {v.historyCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MagicCard>

          {/* Version Audit */}
          <MagicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Version Audit</h2>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Minimum version (e.g. 1.0.0)"
                value={auditMin}
                onChange={(e) => setAuditMin(e.target.value)}
                className="w-48 bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={fetchAudit} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Run Audit
              </Button>
            </div>
            {audit && (
              <div>
                <div className="flex gap-4 mb-3 text-sm">
                  <span className="text-green-400">{audit.upToDate} up-to-date</span>
                  <span className="text-red-400">{audit.outdated} outdated</span>
                  <span className="text-gray-400">of {audit.totalContracts} total</span>
                </div>
                <div className="space-y-1">
                  {audit.contracts.map((c) => (
                    <div key={c.contractName} className="flex items-center gap-3 text-sm">
                      {c.isUpToDate
                        ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                      <span className="text-white w-40">{c.contractName}</span>
                      <span className="font-mono text-gray-400">v{c.currentVersion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MagicCard>

          {/* Version Compare */}
          <MagicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Compare Releases</h2>
            <div className="flex gap-2 items-center flex-wrap">
              <Input
                placeholder="Version A (e.g. 1.0.0)"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-40 bg-gray-800 border-gray-700 text-white"
              />
              <span className="text-gray-400">vs</span>
              <Input
                placeholder="Version B (e.g. 1.1.0)"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-40 bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={handleCompare} className="gap-2">
                <GitBranch className="h-4 w-4" />
                Compare
              </Button>
            </div>
            {compareResult && (
              <div className="mt-4 p-3 rounded bg-gray-800 text-sm">
                <span className="font-mono text-indigo-400">v{compareResult.versionA}</span>
                <span className="text-gray-400 mx-2">vs</span>
                <span className="font-mono text-indigo-400">v{compareResult.versionB}</span>
                <span className="ml-3 text-white">{compareResult.interpretation}</span>
              </div>
            )}
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
}
