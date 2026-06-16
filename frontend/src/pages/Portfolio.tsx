import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  PieChart,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  Clock,
  Circle,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';
import { Position } from '@/data/mockData';
import { MagicCard } from '@/components/magicui/magic-card';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TradeStatusFilter = 'all' | 'confirmed' | 'partially_filled' | 'pending' | 'failed' | 'cancelled';
type TradeTypeFilter = 'all' | 'buy' | 'sell';
type TokenTypeFilter = 'all' | 'yes' | 'no';
type ExportFormat = 'csv' | 'pdf';

interface TradeHistoryFilters {
  search: string;
  tradeType: TradeTypeFilter;
  tokenType: TokenTypeFilter;
  status: TradeStatusFilter;
  startDate: string;
  endDate: string;
}

interface TradeHistoryResponse {
  trades: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

const DEFAULT_TRADE_FILTERS: TradeHistoryFilters = {
  search: '',
  tradeType: 'all',
  tokenType: 'all',
  status: 'all',
  startDate: '',
  endDate: '',
};

const EMPTY_TRADE_HISTORY: TradeHistoryResponse = {
  trades: [],
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
  },
};

const TRADE_HISTORY_PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatAmount(value: number): string {
  return Number(value ?? 0).toFixed(4);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    dateStyle: 'medium',
  });
}

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPnL(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
}

function getTradeTimestamp(trade: any): string {
  return trade.timestamp || trade.createdAt || new Date().toISOString();
}

function getTradeMarketQuestion(trade: any): string {
  return trade.marketQuestion || trade.marketId?.question || trade.marketId || 'Prediction market';
}

function getTradeMarketCategory(trade: any): string {
  return trade.marketCategory || trade.marketId?.category || 'Uncategorized';
}

function getTradeStatusClass(status: string): string {
  if (status === 'confirmed') return 'text-success';
  if (status === 'partially_filled') return 'text-warning';
  if (status === 'failed' || status === 'cancelled') return 'text-destructive';
  return 'text-muted-foreground';
}

function escapeCsv(value: unknown): string {
  const normalized = String(value ?? '');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildExportFilename(walletAddress: string, extension: ExportFormat): string {
  const walletLabel = walletAddress.slice(0, 6);
  const dateLabel = new Date().toISOString().slice(0, 10);
  return `oryn-trades-${walletLabel}-${dateLabel}.${extension}`;
}

function buildTradeHistoryParams(filters: TradeHistoryFilters, page = 1, limit = TRADE_HISTORY_PAGE_SIZE) {
  return {
    page,
    limit,
    search: filters.search.trim() || undefined,
    tradeType: filters.tradeType === 'all' ? undefined : filters.tradeType,
    tokenType: filters.tokenType === 'all' ? undefined : filters.tokenType,
    status: filters.status,
    startDate: filters.startDate ? `${filters.startDate}T00:00:00.000` : undefined,
    endDate: filters.endDate ? `${filters.endDate}T23:59:59.999` : undefined,
  };
}

function areFiltersEqual(left: TradeHistoryFilters, right: TradeHistoryFilters): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getFilterValidationError(filters: TradeHistoryFilters): string | null {
  if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) {
    return 'End date must be on or after the start date.';
  }
  return null;
}

function describeFilters(filters: TradeHistoryFilters): string {
  const segments = [
    filters.search ? `Search: ${filters.search.trim()}` : 'Search: All markets',
    filters.tradeType === 'all' ? 'Trade type: All' : `Trade type: ${filters.tradeType.toUpperCase()}`,
    filters.tokenType === 'all' ? 'Position: All' : `Position: ${filters.tokenType.toUpperCase()}`,
    filters.status === 'all' ? 'Status: All' : `Status: ${formatStatusLabel(filters.status)}`,
    filters.startDate ? `From: ${formatDateOnly(filters.startDate)}` : 'From: Beginning',
    filters.endDate ? `To: ${formatDateOnly(filters.endDate)}` : 'To: Today',
  ];

  return segments.join(' | ');
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportTradesToCsv(trades: any[], filters: TradeHistoryFilters, walletAddress: string) {
  const headers = [
    'Timestamp',
    'Market',
    'Category',
    'Trade ID',
    'Trade Type',
    'Token Type',
    'Status',
    'Amount',
    'Price (cents)',
    'Total Cost (USD)',
    'Platform Fee (USD)',
    'Network Fee (XLM)',
    'Total Fees (USD)',
    'Current P&L (USD)',
    'Transaction Hash',
  ];

  const lines = [
    headers.join(','),
    ...trades.map((trade) => {
      const values = [
        formatDateTime(getTradeTimestamp(trade)),
        getTradeMarketQuestion(trade),
        getTradeMarketCategory(trade),
        trade.tradeId || trade._id || '',
        String(trade.tradeType || '').toUpperCase(),
        String(trade.tokenType || '').toUpperCase(),
        formatStatusLabel(trade.status || 'unknown'),
        formatAmount(trade.amount ?? 0),
        Math.round((trade.price ?? 0) * 100),
        Number(trade.totalCost ?? 0).toFixed(2),
        Number(trade.fees?.platformFee ?? 0).toFixed(2),
        Number(trade.fees?.stellarFee ?? 0).toFixed(5),
        Number(trade.fees?.total ?? 0).toFixed(2),
        trade.currentPnL === null || trade.currentPnL === undefined
          ? ''
          : Number(trade.currentPnL).toFixed(2),
        trade.stellarTransactionHash || '',
      ];

      return values.map(escapeCsv).join(',');
    }),
  ];

  downloadBlob(lines.join('\n'), buildExportFilename(walletAddress, 'csv'), 'text/csv;charset=utf-8;');
  toast.success(`CSV export ready for ${trades.length} trades`, {
    description: describeFilters(filters),
  });
}

async function exportTradesToPdf(trades: any[], filters: TradeHistoryFilters, walletAddress: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  doc.setFontSize(18);
  doc.text('Oryn Finance Trade Export', margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, margin, y);
  y += 14;

  const filterLines = doc.splitTextToSize(`Filters: ${describeFilters(filters)}`, contentWidth);
  doc.text(filterLines, margin, y);
  y += filterLines.length * 12 + 10;

  doc.setTextColor(20, 20, 20);

  trades.forEach((trade, index) => {
    const timestamp = formatDateTime(getTradeTimestamp(trade));
    const status = formatStatusLabel(trade.status || 'unknown');
    const marketLines = doc.splitTextToSize(getTradeMarketQuestion(trade), contentWidth);
    const summaryLine = `${String(trade.tradeType || '').toUpperCase()} ${String(trade.tokenType || '').toUpperCase()} | ${status} | ${timestamp}`;
    const valueLine = `Amount ${formatAmount(trade.amount ?? 0)} @ ${Math.round((trade.price ?? 0) * 100)}¢ | Total ${formatCurrency(trade.totalCost ?? 0)} | P&L ${formatPnL(trade.currentPnL)}`;
    const feeLine = `Fees ${formatCurrency(trade.fees?.total ?? 0)} total | Platform ${formatCurrency(trade.fees?.platformFee ?? 0)} | Network ${(trade.fees?.stellarFee ?? 0).toFixed(5)} XLM`;
    const idLine = `Trade ${trade.tradeId || trade._id || 'n/a'}${trade.stellarTransactionHash ? ` | Tx ${trade.stellarTransactionHash}` : ''}`;
    const idLines = doc.splitTextToSize(idLine, contentWidth);
    const blockHeight = 18 + (marketLines.length * 12) + 12 + 12 + (idLines.length * 12) + 18;

    addPageIfNeeded(blockHeight);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${summaryLine}`, margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(marketLines, margin, y);
    y += marketLines.length * 12;
    doc.text(valueLine, margin, y);
    y += 12;
    doc.text(feeLine, margin, y);
    y += 12;
    doc.text(idLines, margin, y);
    y += idLines.length * 12 + 8;

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  });

  doc.save(buildExportFilename(walletAddress, 'pdf'));
  toast.success(`PDF export ready for ${trades.length} trades`, {
    description: describeFilters(filters),
  });
}

export default function Portfolio() {
  const { isConnected, connect, publicKey, xlmBalance, usdcBalance } = useWallet();
  const [userPositions, setUserPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [tradeHistoryMeta, setTradeHistoryMeta] = useState(EMPTY_TRADE_HISTORY.pagination);
  const [draftTradeFilters, setDraftTradeFilters] = useState<TradeHistoryFilters>(DEFAULT_TRADE_FILTERS);
  const [appliedTradeFilters, setAppliedTradeFilters] = useState<TradeHistoryFilters>(DEFAULT_TRADE_FILTERS);
  const [userStats, setUserStats] = useState({
    totalTrades: 0,
    winRate: 0,
    totalProfitLoss: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    netPnL: 0
  });
  const [lpPositions, setLpPositions] = useState<any[]>([]);
  const [lpMetrics, setLpMetrics] = useState({
    totalPositions: 0,
    totalDeposited: 0,
    totalFeesEarned: 0,
    totalImpermanentLoss: 0,
    netReturn: 0
  });
  const [loading, setLoading] = useState(false);
  const [tradeHistoryLoading, setTradeHistoryLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryData = async () => {
    if (!publicKey || !isConnected) return;

    try {
      setLoading(true);
      setError(null);

      const [positionsData, statsData, profile] = await Promise.all([
        apiService.users.getUserPositions(publicKey, { status: 'active', limit: 50 }),
        apiService.users.getUserStats(publicKey, { timeframe: '30d' }),
        apiService.users.getUserByAddress(publicKey),
      ]);

      const mappedPositions: Position[] = (positionsData || []).map((position: any) => {
        const currentPrice = Number(position.currentPrice ?? position.averageEntryPrice ?? 0.5);
        const averageEntryPrice = Number(position.averageEntryPrice ?? 0.5);
        const shares = Number(position.availableShares ?? position.totalShares ?? 0);
        const tokenType = String(position.tokenType || 'yes').toUpperCase();

        return {
          marketId: position.marketId?.marketId || position.marketId,
          marketQuestion: position.marketId?.question || 'Prediction market',
          position: tokenType === 'YES' ? 'YES' : 'NO',
          amount: shares,
          avgPrice: averageEntryPrice,
          currentPrice,
          unrealizedPnL: Number(position.unrealizedPnL || 0)
        };
      });

      setUserPositions(mappedPositions);

      const winRatePercent = Number((profile?.statistics?.winRate || 0) * 100);

      setUserStats({
        totalTrades: Number(statsData?.trades?.totalTrades || 0),
        winRate: winRatePercent,
        totalProfitLoss: Number(statsData?.netPnL || 0),
        realizedPnL: Number(statsData?.positions?.totalRealizedPnL || 0),
        unrealizedPnL: Number(statsData?.positions?.totalUnrealizedPnL || 0),
        netPnL: Number(statsData?.netPnL || 0)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio data');
      console.error('Error fetching portfolio data:', err);
      setUserPositions([]);
      setUserStats({
        totalTrades: 0,
        winRate: 0,
        totalProfitLoss: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        netPnL: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTradeHistoryData = async (
    filters: TradeHistoryFilters,
    page = 1,
    limit = TRADE_HISTORY_PAGE_SIZE
  ): Promise<TradeHistoryResponse> => {
    if (!publicKey || !isConnected) return EMPTY_TRADE_HISTORY;

    try {
      setTradeHistoryLoading(true);
      setError(null);

      const response = await apiService.trades.getTradeHistory(
        publicKey,
        buildTradeHistoryParams(filters, page, limit)
      );

      const nextTradeHistory = {
        trades: response?.trades || [],
        pagination: response?.pagination || EMPTY_TRADE_HISTORY.pagination,
      };

      setTradeHistory(nextTradeHistory.trades);
      setTradeHistoryMeta(nextTradeHistory.pagination);

      return nextTradeHistory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trade history');
      console.error('Error fetching trade history:', err);
      setTradeHistory([]);
      setTradeHistoryMeta(EMPTY_TRADE_HISTORY.pagination);
      return EMPTY_TRADE_HISTORY;
    } finally {
      setTradeHistoryLoading(false);
    }
  };

  const fetchLpData = async () => {
    if (!publicKey || !isConnected) return;
    try {
      const [positions, metrics] = await Promise.all([
        apiService.liquidityPositions.getUserPositions(publicKey),
        apiService.liquidityPositions.getPortfolioMetrics(publicKey),
      ]);
      setLpPositions(positions || []);
      if (metrics) {
        setLpMetrics(metrics);
      }
    } catch (err) {
      console.error('Error fetching LP data:', err);
    }
  };

  const fetchPortfolioData = async (filters = appliedTradeFilters) => {
    await Promise.all([
      fetchSummaryData(),
      fetchTradeHistoryData(filters),
      fetchLpData(),
    ]);
  };

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchPortfolioData(appliedTradeFilters);
    }
  }, [isConnected, publicKey]);

  const validateAndApplyFilters = async (filters: TradeHistoryFilters) => {
    const validationError = getFilterValidationError(filters);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setAppliedTradeFilters(filters);
    return fetchTradeHistoryData(filters);
  };

  const handleApplyFilters = async () => {
    await validateAndApplyFilters({ ...draftTradeFilters });
  };

  const handleResetFilters = async () => {
    setDraftTradeFilters(DEFAULT_TRADE_FILTERS);
    await validateAndApplyFilters(DEFAULT_TRADE_FILTERS);
  };

  const fetchAllFilteredTrades = async (
    filters: TradeHistoryFilters,
    firstPageData?: TradeHistoryResponse
  ): Promise<any[]> => {
    if (!publicKey || !isConnected) return [];

    let initialPage = firstPageData;
    if (!initialPage) {
      const response = await apiService.trades.getTradeHistory(
        publicKey,
        buildTradeHistoryParams(filters, 1, EXPORT_PAGE_SIZE)
      );
      initialPage = {
        trades: response?.trades || [],
        pagination: response?.pagination || EMPTY_TRADE_HISTORY.pagination,
      };
    }

    const allTrades = [...initialPage.trades];
    const totalPages = Number(initialPage.pagination?.totalPages || 0);

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await apiService.trades.getTradeHistory(
        publicKey,
        buildTradeHistoryParams(filters, page, EXPORT_PAGE_SIZE)
      );
      allTrades.push(...(response?.trades || []));
    }

    return allTrades;
  };

  const handleExport = async (format: ExportFormat) => {
    if (!publicKey || !isConnected) return;

    try {
      setIsExporting(format);
      const nextFilters = { ...draftTradeFilters };
      const firstPageData = areFiltersEqual(nextFilters, appliedTradeFilters)
        ? {
            trades: tradeHistory,
            pagination: tradeHistoryMeta,
          }
        : await validateAndApplyFilters(nextFilters);

      if (!firstPageData) return;

      const tradesToExport = await fetchAllFilteredTrades(nextFilters, firstPageData);
      if (tradesToExport.length === 0) {
        toast.error('No trades match the current filters.');
        return;
      }

      if (format === 'csv') {
        exportTradesToCsv(tradesToExport, nextFilters, publicKey);
      } else {
        await exportTradesToPdf(tradesToExport, nextFilters, publicKey);
      }
    } catch (err) {
      console.error(`Error exporting ${format}:`, err);
      toast.error(`Failed to export ${format.toUpperCase()}`, {
        description: err instanceof Error ? err.message : 'Unexpected export error',
      });
    } finally {
      setIsExporting(null);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
            <p className="text-muted-foreground mb-8">
              Connect your Freighter wallet to view your portfolio, positions, and trading history.
            </p>
            <Button onClick={connect} className="btn-primary-gradient">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const totalValue = userPositions.reduce((sum, position) => sum + (position.amount * position.currentPrice), 0);
  const totalPnL = userStats.unrealizedPnL;
  const totalInvested = userPositions.reduce((sum, position) => sum + (position.amount * position.avgPrice), 0);
  const realizedRoi = totalInvested > 0 ? (userStats.netPnL / totalInvested) * 100 : 0;
  const performanceSeries = [...tradeHistory]
    .sort((left, right) => new Date(getTradeTimestamp(left)).getTime() - new Date(getTradeTimestamp(right)).getTime())
    .slice(-12)
    .reduce<Array<{ label: string; pnl: number; profit: number }>>((series, trade, index) => {
      const previous = series[series.length - 1]?.pnl || 0;
      const profit = Number(trade.currentPnL ?? trade.realizedPnL ?? 0);

      series.push({
        label: `T${index + 1}`,
        pnl: previous + profit,
        profit,
      });

      return series;
    }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Portfolio</h1>
            {isConnected && (
              <Button
                onClick={() => fetchPortfolioData(appliedTradeFilters)}
                disabled={loading || tradeHistoryLoading || !!isExporting}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${(loading || tradeHistoryLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            Connected: {publicKey || 'Not connected'}
          </p>
          {error && (
            <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              Error: {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">XLM Balance</p>
            <p className="text-2xl font-bold">{xlmBalance}</p>
          </MagicCard>
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">USDC Balance</p>
            <p className="text-2xl font-bold">{usdcBalance}</p>
          </MagicCard>
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </MagicCard>
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">Unrealized P&amp;L</p>
            <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </p>
          </MagicCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MagicCard className="glass-card p-5" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">Realized Gains</p>
            <p className={`text-xl font-bold ${userStats.realizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {userStats.realizedPnL >= 0 ? '+' : ''}{formatCurrency(userStats.realizedPnL)}
            </p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">Unrealized Gains</p>
            <p className={`text-xl font-bold ${userStats.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {userStats.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(userStats.unrealizedPnL)}
            </p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#262626">
            <p className="text-sm text-muted-foreground mb-1">Net P&amp;L</p>
            <p className={`text-xl font-bold ${userStats.netPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {userStats.netPnL >= 0 ? '+' : ''}{formatCurrency(userStats.netPnL)}
            </p>
          </MagicCard>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <PieChart className="w-5 h-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{userPositions.length}</p>
            <p className="text-xs text-muted-foreground">Active Positions</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <History className="w-5 h-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{userStats.totalTrades}</p>
            <p className="text-xs text-muted-foreground">Total Trades</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold">{userStats.winRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <TrendingDown className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{formatCurrency(totalInvested)}</p>
            <p className="text-xs text-muted-foreground">Total Invested</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{lpMetrics.totalPositions}</p>
            <p className="text-xs text-muted-foreground">LP Positions</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold">{formatCurrency(lpMetrics.netReturn)}</p>
            <p className="text-xs text-muted-foreground">LP Net Return</p>
          </div>

          <MagicCard className="glass-card p-6 md:col-span-2 xl:col-span-4" gradientColor="#262626">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-primary" />
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Trader performance profile</p>
                </div>
                <h2 className="text-2xl font-semibold">Evaluate your trading edge over time</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tracks win rate, return on invested capital, and a rolling P&amp;L curve so you can see how your decisions compound.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-muted-foreground">ROI</p>
                  <p className={`mt-1 text-lg font-semibold ${realizedRoi >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {realizedRoi >= 0 ? '+' : ''}{realizedRoi.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-muted-foreground">Win rate</p>
                  <p className="mt-1 text-lg font-semibold">{userStats.winRate.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-muted-foreground">Net P&amp;L</p>
                  <p className={`mt-1 text-lg font-semibold ${userStats.netPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {userStats.netPnL >= 0 ? '+' : ''}{formatCurrency(userStats.netPnL)}
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-muted-foreground">Risk load</p>
                  <p className="mt-1 text-lg font-semibold">{tradeHistory.length} trades</p>
                </div>
              </div>
            </div>

            <div className="mt-6 h-72">
              {performanceSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground">
                  Trade history will appear here once you start building a track record.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceSeries}>
                    <defs>
                      <linearGradient id="portfolioPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-yes))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--chart-yes))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value || 0))}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="hsl(var(--chart-yes))"
                      fill="url(#portfolioPnl)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </MagicCard>
        </div>

        <MagicCard className="glass-card p-6 mb-8" gradientColor="#262626">
          <h2 className="text-xl font-semibold mb-6">Active Positions</h2>
          <div className="space-y-4">
            {userPositions.map((position) => {
              const currentValue = position.amount * position.currentPrice;
              const pnlPercent = ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100;

              return (
                <Link
                  key={position.marketId}
                  to={`/market/${position.marketId}`}
                  className="block p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={position.position === 'YES'
                            ? 'bg-success/10 text-success border-success/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'}
                        >
                          {position.position}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {position.amount} tokens @ {Math.round(position.avgPrice * 100)}¢
                        </span>
                      </div>
                      <p className="font-medium line-clamp-1">{position.marketQuestion}</p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Current Value</p>
                        <p className="font-semibold">{formatCurrency(currentValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Unrealized P&amp;L</p>
                        <p className={`font-semibold ${position.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                          <span className="text-xs ml-1">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)</span>
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </MagicCard>

        <MagicCard className="glass-card p-6 mb-8" gradientColor="#262626">
          <h2 className="text-xl font-semibold mb-6">Liquidity Positions</h2>
          {lpPositions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active liquidity positions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lpPositions.map((position: any) => (
                <Link
                  key={position.positionId || position._id}
                  to={`/market/${position.marketId}`}
                  className="block p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-1 mb-1">{position.marketQuestion || position.marketId}</p>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>Deposited: {formatCurrency(position.depositedYesAmount + position.depositedNoAmount)}</span>
                        <span>Fees: {formatCurrency(position.totalFeesEarned)}</span>
                        {position.impermanentLoss !== 0 && (
                          <span className={position.impermanentLoss > 0 ? 'text-destructive' : 'text-success'}>
                            IL: {formatCurrency(position.impermanentLoss)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm text-muted-foreground">Share of Pool</p>
                        <p className="font-semibold">{(position.shareOfPool * 100).toFixed(2)}%</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </MagicCard>

        <MagicCard className="glass-card p-6" gradientColor="#262626">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Trade History</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Filter your activity, then export the matching trades as CSV or PDF.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  disabled={tradeHistoryLoading || !!isExporting}
                  className="flex items-center gap-2"
                >
                  {isExporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('pdf')}
                  disabled={tradeHistoryLoading || !!isExporting}
                  className="flex items-center gap-2"
                >
                  {isExporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="text-xs text-muted-foreground mb-2 block">Market search</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draftTradeFilters.search}
                    onChange={(event) => setDraftTradeFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))}
                    placeholder="Search by market question"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Trade type</label>
                <Select
                  value={draftTradeFilters.tradeType}
                  onValueChange={(value) => setDraftTradeFilters((current) => ({
                    ...current,
                    tradeType: value as TradeTypeFilter,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All trade types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All trades</SelectItem>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Position</label>
                <Select
                  value={draftTradeFilters.tokenType}
                  onValueChange={(value) => setDraftTradeFilters((current) => ({
                    ...current,
                    tokenType: value as TokenTypeFilter,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All positions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All positions</SelectItem>
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Status</label>
                <Select
                  value={draftTradeFilters.status}
                  onValueChange={(value) => setDraftTradeFilters((current) => ({
                    ...current,
                    status: value as TradeStatusFilter,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="partially_filled">Partially Filled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Start date</label>
                <Input
                  type="date"
                  value={draftTradeFilters.startDate}
                  onChange={(event) => setDraftTradeFilters((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">End date</label>
                <Input
                  type="date"
                  value={draftTradeFilters.endDate}
                  onChange={(event) => setDraftTradeFilters((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {tradeHistory.length} of {tradeHistoryMeta.totalItems} matching trades
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  disabled={tradeHistoryLoading || !!isExporting}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyFilters}
                  disabled={tradeHistoryLoading || !!isExporting}
                  className="flex items-center gap-2"
                >
                  {tradeHistoryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {tradeHistoryLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/20 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-muted/40" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/30 rounded w-3/4" />
                        <div className="h-3 bg-muted/20 rounded w-1/2" />
                      </div>
                      <div className="w-20 h-4 bg-muted/30 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tradeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No trades match the current filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {tradeHistory.map((trade: any, index: number) => (
                    <motion.div
                      key={trade.tradeId || trade._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
                    >
                      <Link
                        to={`/trade/${trade.tradeId || trade._id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group gap-4"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="relative">
                            <div className={`w-2 h-2 mt-2 rounded-full ${
                              trade.status === 'pending'
                                ? 'bg-yellow-500 animate-pulse'
                                : trade.tradeType === 'buy'
                                  ? 'bg-success'
                                  : 'bg-destructive'
                            }`} />
                            {trade.status === 'pending' && (
                              <div className="absolute inset-0 w-2 h-2 rounded-full bg-yellow-500/40 animate-ping" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{getTradeMarketQuestion(trade)}</p>
                            <p className="text-xs text-muted-foreground capitalize mt-1">
                              {trade.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 mr-2">
                                  <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
                                  <span className="text-yellow-500">Pending</span>
                                </span>
                              )}
                              {trade.tradeType} {trade.tokenType?.toUpperCase()} · {formatAmount(trade.amount ?? 0)} tokens · {formatDateTime(getTradeTimestamp(trade))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Fees {formatCurrency(trade.fees?.total ?? 0)} ·
                              <span className={`ml-1 ${getTradeStatusClass(trade.status)}`}>
                                P&amp;L {formatPnL(trade.currentPnL)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(trade.totalCost ?? 0)}
                            </p>
                            <p className={`text-xs ${getTradeStatusClass(trade.status)}`}>
                              {trade.status === 'pending' ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Confirming
                                </span>
                              ) : (
                                formatStatusLabel(trade.status || 'unknown')
                              )}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </MagicCard>
      </div>
    </Layout>
  );
}
