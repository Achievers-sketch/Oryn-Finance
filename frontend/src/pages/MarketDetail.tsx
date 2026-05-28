import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Market } from '@/data/mockData';
import { apiService } from '@/services/apiService';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { TradeConfirmationModal, PartialFillBanner, PartialFillResult } from '@/components/ui/ConfirmationModal';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { ResolutionPanel } from '@/components/ResolutionPanel';
import { OddsChart } from '@/components/OddsChart';
import { CreatorReputation } from '@/components/markets/CreatorReputation';
import MarketDepthChart from '@/components/markets/MarketDepthChart';
import { useMarketUpdates } from '@/contexts/WebSocketContext';
import { useOffline } from '@/hooks/useOffline';
import { useI18n } from '@/i18n';

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
  return `$${volume}`;
}

const PHASE_LABELS: Record<OptimisticPhase, string> = {
  idle: '',
  optimistic: 'Order placed — confirming on-chain',
  building: 'Building transaction...',
  signing: 'Awaiting wallet signature...',
  submitting: 'Submitting to Stellar network...',
  confirming: 'Awaiting network confirmation...',
  confirmed: 'Transaction confirmed',
  failed: 'Transaction failed',
  rolled_back: 'Order reverted — something went wrong',
};

const PHASE_PERCENT: Record<OptimisticPhase, number> = {
  idle: 0,
  optimistic: 15,
  building: 30,
  signing: 50,
  submitting: 70,
  confirming: 90,
  confirmed: 100,
  failed: 100,
  rolled_back: 0,
};

export default function MarketDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const { isConnected, connect, publicKey, signTransaction } = useWallet();
  const { marketData } = useMarketUpdates(id || '');
  const isOffline = useOffline();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [position, setPosition] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [partialFillResult, setPartialFillResult] = useState<PartialFillResult | null>(null);
  const [txProgress, setTxProgress] = useState<{
    phase: 'idle' | 'building' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';
    message: string;
    txHash?: string;
  }>({ phase: 'idle', message: '' });

  const {
    phase: optimisticPhase,
    phaseMessage,
    txHash: optimisticTxHash,
    activeTradeId,
    addOptimisticTrade,
    confirmOptimisticTrade,
    rollbackOptimisticTrade,
    setTransactionPhase,
    reset: resetOptimistic,
    isPending: isOptimisticPending,
    isError: isOptimisticError,
  } = useOptimisticTrade();

  const demoMarkets: { [key: string]: Market } = {
    '1': {
      id: '1',
      question: 'Will SpaceX land humans on Mars by 2030?',
      category: 'Technology',
      yesPrice: 0.25,
      noPrice: 0.75,
      volume: 31000,
      liquidity: 100000,
      expirationDate: '2030-12-31T23:59:59Z',
      status: 'Active',
      creator: 'GD...XYZ',
      createdAt: '2025-01-20T10:00:00Z',
      traders: 156,
      resolutionSource: 'SpaceX Official',
      description: 'Resolves YES if SpaceX successfully lands human crew on Mars surface by December 31, 2030.'
    },
    'openai-gpt5-2026': {
      id: 'openai-gpt5-2026',
      question: 'Will OpenAI release GPT-5 by December 2026?',
      category: 'Technology',
      yesPrice: 0.72,
      noPrice: 0.28,
      volume: 22000,
      liquidity: 80000,
      expirationDate: '2026-12-31T23:59:59Z',
      status: 'Active',
      creator: 'GA...ABC',
      createdAt: '2025-01-18T15:30:00Z',
      traders: 89,
      resolutionSource: 'OpenAI Official',
      description: 'Resolves YES if OpenAI officially releases a model named GPT-5 by December 31, 2026. This includes any publicly announced model with the official name GPT-5 from OpenAI.'
    },
    'spacex-mars-2030': {
      id: 'spacex-mars-2030',
      question: 'Will SpaceX land humans on Mars by 2030?',
      category: 'Technology',
      yesPrice: 0.25,
      noPrice: 0.75,
      volume: 31000,
      liquidity: 100000,
      expirationDate: '2030-12-31T23:59:59Z',
      status: 'Active',
      creator: 'GD...XYZ',
      createdAt: '2025-01-20T10:00:00Z',
      traders: 156,
      resolutionSource: 'SpaceX Official',
      description: 'Resolves YES if SpaceX successfully lands human crew on Mars surface by December 31, 2030.'
    }
  };

  const currentMarket = demoMarkets[id || ''] || demoMarkets['openai-gpt5-2026'];

  const [liveYesPrice, setLiveYesPrice] = useState(currentMarket.yesPrice);
  const [liveNoPrice, setLiveNoPrice] = useState(currentMarket.noPrice);
  const [liveLiquidity, setLiveLiquidity] = useState(currentMarket.liquidity);
  const [liveVolume, setLiveVolume] = useState(currentMarket.volume);

  useEffect(() => {
    if (!marketData) return;
    const rawYes = marketData.prices?.yes ?? marketData.currentYesPrice ?? marketData.yesPrice;
    if (rawYes != null) {
      setLiveYesPrice(rawYes);
      setLiveNoPrice(1 - rawYes);
    }
    if (marketData.liquidity != null) {
      setLiveLiquidity(marketData.liquidity);
    } else if (marketData.initialLiquidity != null) {
      setLiveLiquidity(marketData.initialLiquidity);
    }
    if (marketData.volume != null) {
      setLiveVolume(marketData.volume);
    } else if (marketData.totalVolume != null) {
      setLiveVolume(marketData.totalVolume);
    } else if (marketData.volume24h != null) {
      setLiveVolume(marketData.volume24h);
    }
  }, [marketData]);

  const imbalanceRatio = Math.max(liveYesPrice, liveNoPrice);
  const isImbalanced = imbalanceRatio >= 0.8;
  const imbalancedSide = liveYesPrice > liveNoPrice ? 'YES' : 'NO';

  const recentTrades = [
    {
      id: '1',
      type: 'Buy',
      position: 'YES',
      amount: 100,
      price: currentMarket.yesPrice,
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString()
    },
    {
      id: '2',
      type: 'Sell',
      position: 'NO',
      amount: 50,
      price: currentMarket.noPrice,
      timestamp: new Date(Date.now() - 600000).toLocaleTimeString()
    },
    {
      id: '3',
      type: 'Buy',
      position: 'YES',
      amount: 75,
      price: currentMarket.yesPrice - 0.05,
      timestamp: new Date(Date.now() - 900000).toLocaleTimeString()
    }
  ];

  const price = position === 'YES' ? liveYesPrice : liveNoPrice;
  const tokensReceived = amount ? (parseFloat(amount) / price).toFixed(2) : '0';
  const priceImpact = amount ? Math.min(parseFloat(amount) * 0.001, 2).toFixed(2) : '0';
  const estimatedFee = amount ? (parseFloat(amount) * 0.005).toFixed(4) : '0';

  const handleTradeStart = () => {
    if (isOffline) {
      toast.error('You are offline. Trading is disabled until connection is restored.');
      return;
    }
    if (!isConnected) {
      connect();
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setPartialFillResult(null);
    setIsConfirmModalOpen(true);
  };

  const handleTradeConfirm = async () => {
    setIsConfirmModalOpen(false);
    if (!publicKey) {
      toast.error('Wallet not connected properly');
      return;
    }

    const parsedAmount = parseFloat(amount);
    const optimisticId = addOptimisticTrade({
      type: tradeType,
      position,
      amount: parsedAmount,
      price,
      tokensReceived,
      fee: estimatedFee,
      marketId: currentMarket.id,
      marketQuestion: currentMarket.question,
    });

    setIsLoading(true);
    setPartialFillResult(null);

    const pollTransaction = async (txHash: string) => {
      const maxAttempts = 12;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = await apiService.network.getTransactionStatus(txHash);
        const status = String(result?.status || '').toUpperCase();

        if (status === 'SUCCESS') return result;
        if (status === 'FAILED' || status === 'NOT_FOUND') {
          throw new Error(`Transaction ${status.toLowerCase()}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new Error('Transaction confirmation timed out');
    };

    try {
      setTransactionPhase('building', 'Building transaction...');
      setTxProgress({ phase: 'building', message: 'Building transaction...' });
      toast.loading('Building transaction...', { id: 'trade-toast' });

      const transactionData = tradeType === 'buy'
        ? await apiService.transactions.buildBuyTokens({
            marketId: currentMarket.id,
            tokenType: position.toLowerCase() as 'yes' | 'no',
            amount: parsedAmount,
            maxSlippage: 1.0
          }, publicKey)
        : await apiService.transactions.buildSellTokens({
            marketId: currentMarket.id,
            tokenType: position.toLowerCase() as 'yes' | 'no',
            amount: parsedAmount,
            maxSlippage: 1.0
          }, publicKey);

      if (!transactionData?.xdr) {
        throw new Error('Failed to build transaction');
      }

      setTransactionPhase('signing', 'Please sign the transaction in your wallet...');
      setTxProgress({ phase: 'signing', message: 'Waiting for wallet signature...' });
      toast.loading('Please sign the transaction in your wallet...', { id: 'trade-toast' });

      const signedXdr = await signTransaction(transactionData.xdr);

      setTransactionPhase('submitting', 'Submitting to Stellar network...');
      setTxProgress({ phase: 'submitting', message: 'Submitting transaction to network...' });
      toast.loading('Submitting transaction to network...', { id: 'trade-toast' });

      const submitResult = await apiService.transactions.submitSignedTransaction({ signedXdr });

      const txHash = submitResult?.transactionHash;
      if (!txHash) {
        throw new Error('Transaction submitted but no hash returned');
      }

      setTransactionPhase('confirming', 'Awaiting network confirmation...', txHash);
      setTxProgress({ phase: 'confirming', message: 'Confirming transaction...', txHash });
      const confirmed = await pollTransaction(txHash);

      const tradeData = confirmed?.data?.trade ?? submitResult?.data?.trade;
      if (tradeData?.isPartial) {
        const pfResult: PartialFillResult = {
          isPartial: true,
          filledAmount: tradeData.filledAmount,
          remainingAmount: tradeData.remainingAmount,
          fillRatio: tradeData.fillRatio,
          requestedAmount: tradeData.requestedAmount ?? parsedAmount,
        };
        setPartialFillResult(pfResult);
        confirmOptimisticTrade(optimisticId, {
          status: 'partial',
          txHash,
          partialFill: {
            filledAmount: tradeData.filledAmount,
            remainingAmount: tradeData.remainingAmount,
            fillRatio: tradeData.fillRatio,
            requestedAmount: tradeData.requestedAmount ?? parsedAmount,
          },
        });
        setTxProgress({ phase: 'success', message: 'Order partially filled', txHash });
        toast.warning(
          `Partial fill: ${tradeData.filledAmount.toFixed(4)} of ${parsedAmount.toFixed(4)} ${position} filled`,
          { id: 'trade-toast', description: `${tradeData.remainingAmount.toFixed(4)} remaining — insufficient liquidity` }
        );
      } else {
        confirmOptimisticTrade(optimisticId, {
          status: 'confirmed',
          txHash,
        });
        setTxProgress({ phase: 'success', message: 'Transaction confirmed', txHash });
        toast.success(`${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} order successful!`, {
          id: 'trade-toast',
          description: `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${tokensReceived} ${position} tokens`
        });
      }

      setAmount('');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Transaction failed');
      console.error('Trade error:', err);

      rollbackOptimisticTrade(optimisticId, err);
      setTxProgress({
        phase: 'error',
        message: err.message
      });
      toast.error(err.message, { id: 'trade-toast' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissError = useCallback(() => {
    resetOptimistic();
    setTxProgress({ phase: 'idle', message: '' });
  }, [resetOptimistic]);

  const handleRetryTrade = useCallback(() => {
    resetOptimistic();
    setTxProgress({ phase: 'idle', message: '' });
    handleTradeConfirm();
  }, [resetOptimistic]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link to="/markets" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('market.back')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Header */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-primary border-primary/30">
                    {currentMarket.category}
                  </Badge>
                  {currentMarket.region && (
                    <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
                      {currentMarket.region.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Badge>
                  )}
                  {currentMarket.volatility && (
                    <Badge variant="outline" className={
                      currentMarket.volatility.badge === 'low' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                      currentMarket.volatility.badge === 'moderate' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                      currentMarket.volatility.badge === 'high' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                      'text-red-400 border-red-500/30 bg-red-500/10'
                    }>
                      Volatility: {currentMarket.volatility.badge}
                    </Badge>
                  )}
                </div>
                {currentMarket.status === 'Trending' && (
                  <Badge className="bg-gradient-to-r from-primary to-secondary">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {t('market.trending')}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-4">{currentMarket.question}</h1>
              <div className="flex flex-wrap gap-4 items-center mb-4">
                <CountdownTimer expiryDate={currentMarket.expirationDate} showLabels className="px-3 py-1.5 text-xs" />
                {isImbalanced && (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    {t('market.liquidityImbalance', { side: imbalancedSide })}
                  </Badge>
                )}
              </div>
              {currentMarket.description && (
                <p className="text-muted-foreground mb-4">{currentMarket.description}</p>
              )}

              {/* Current Prices */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="text-sm text-muted-foreground mb-1">{t('market.yesPrice')}</div>
                  <div className="text-3xl font-bold text-success">{Math.round(liveYesPrice * 100)}¢</div>
                </div>
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="text-sm text-muted-foreground mb-1">{t('market.noPrice')}</div>
                  <div className="text-3xl font-bold text-destructive">{Math.round(liveNoPrice * 100)}¢</div>
                </div>
              </div>
            </div>

            {/* Optimistic Trade Result Banner */}
            {optimisticPhase !== 'idle' && (
              <div
                className={`glass-card p-4 border ${
                  isOptimisticError
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-success/5 border-success/20'
                }`}
              >
                {isOptimisticPending ? (
                  <div className="flex items-start gap-3">
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">Order Submitted — Pending Confirmation</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tradeType === 'buy' ? 'Buy' : 'Sell'} {position} · {amount} USDC · {tokensReceived} tokens @ {Math.round(price * 100)}¢
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your order is being processed. You&apos;ll see the result here shortly.
                      </p>
                      <div className="w-full h-1.5 rounded-full bg-muted/50 mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isOptimisticError ? 'bg-red-500' : 'bg-gradient-to-r from-primary to-secondary'
                          }`}
                          style={{ width: `${PHASE_PERCENT[optimisticPhase]}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{PHASE_LABELS[optimisticPhase]}</p>
                      {optimisticTxHash && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all">
                          Tx: {optimisticTxHash}
                        </p>
                      )}
                    </div>
                  </div>
                ) : isOptimisticError ? (
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-400">Order Failed</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tradeType === 'buy' ? 'Buy' : 'Sell'} {position} · {amount} USDC · {tokensReceived} tokens @ {Math.round(price * 100)}¢
                      </p>
                      <p className="text-xs text-red-400/80 mt-1">{phaseMessage}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={handleDismissError} className="text-xs h-7">
                          Dismiss
                        </Button>
                        <Button size="sm" onClick={handleRetryTrade} className="text-xs h-7 btn-primary-gradient">
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-success">
                        {tradeType === 'buy' ? 'Bought' : 'Sold'} {tokensReceived} {position} @ {Math.round(price * 100)}¢
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {amount} USDC · Fee: {estimatedFee} USDC · Price impact: {priceImpact}%
                      </p>
                      {activeTradeId && partialFillResult && (
                        <div className="mt-2">
                          <PartialFillBanner result={partialFillResult} tokenType={position} />
                        </div>
                      )}
                      {optimisticTxHash && (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${optimisticTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          View on Explorer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        The page will update with the latest position data.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Odds Visualization */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('market.performance')}</h2>
              <OddsChart
                marketId={currentMarket.id}
                initialYesPrice={currentMarket.yesPrice}
                initialNoPrice={currentMarket.noPrice}
                initialVolume={currentMarket.volume}
              />
            </div>

            {/* Market Depth Visualization */}
            <MarketDepthChart
              marketId={currentMarket.id}
              tokenType={position.toLowerCase() as 'yes' | 'no'}
              className="glass-card"
            />

            {/* Recent Trades */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('market.recentTrades')}</h2>
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant={trade.type === 'Buy' ? 'default' : 'outline'} className={trade.type === 'Buy' ? 'bg-success/20 text-success' : ''}>
                        {trade.type}
                      </Badge>
                      <span className={trade.position === 'YES' ? 'text-success' : 'text-destructive'}>
                        {trade.position}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${trade.amount}</div>
                      <div className="text-xs text-muted-foreground">{trade.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ResolutionPanel marketId={id || ''} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CreatorReputation creatorAddress={currentMarket.creator} />

            {/* Trading Interface */}
            <div className="glass-card p-6 sticky top-24">
              <Tabs value={tradeType} onValueChange={(v) => setTradeType(v as 'buy' | 'sell')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="buy">{t('market.buy')}</TabsTrigger>
                  <TabsTrigger value="sell">{t('market.sell')}</TabsTrigger>
                </TabsList>

                <TabsContent value="buy" className="space-y-4">
                  {/* Position Selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={position === 'YES' ? 'default' : 'outline'}
                      className={position === 'YES' ? 'bg-success hover:bg-success/90' : 'hover:border-success hover:text-success'}
                      onClick={() => setPosition('YES')}
                    >
                      YES {Math.round(liveYesPrice * 100)}¢
                    </Button>
                    <Button
                      variant={position === 'NO' ? 'default' : 'outline'}
                      className={position === 'NO' ? 'bg-destructive hover:bg-destructive/90' : 'hover:border-destructive hover:text-destructive'}
                      onClick={() => setPosition('NO')}
                    >
                      NO {Math.round(liveNoPrice * 100)}¢
                    </Button>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{t('market.amount')}</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input-dark text-lg"
                    />
                  </div>

                  {/* Trade Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('market.receive')}</span>
                      <span className="font-medium">{tokensReceived} {position}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('market.pricePerToken')}</span>
                      <span>{Math.round(price * 100)}¢</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('market.priceImpact')}</span>
                      <span className="text-warning">{priceImpact}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('market.fee')}</span>
                      <span>{estimatedFee} USDC</span>
                    </div>
                    {partialFillResult && (
                      <>
                        <div className="border-t border-border/50 pt-2 mt-1" />
                        <div className="flex justify-between text-sm">
                          <span className="text-success">{t('market.filled')}</span>
                          <span className="font-medium text-success">{partialFillResult.filledAmount.toFixed(4)} {position}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-warning">{t('market.remaining')}</span>
                          <span className="font-medium text-warning">{partialFillResult.remainingAmount.toFixed(4)} {position}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-warning to-success"
                            style={{ width: `${(partialFillResult.fillRatio * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Trade Button */}
                  <Button
                    className="w-full btn-primary-gradient"
                    onClick={handleTradeStart}
                    disabled={isLoading || isOffline || isOptimisticPending}
                  >
                    {isLoading || isOptimisticPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('market.confirming')}
                      </>
                    ) : isOffline ? (
                      <>
                        <WifiOff className="w-4 h-4 mr-2" />
                        {t('market.tradingDisabled')}
                      </>
                    ) : !isConnected ? (
                      t('market.connectWallet')
                    ) : (
                      `Buy ${position}`
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {t('market.settlement')}
                  </p>

                  {txProgress.phase !== 'idle' && (
                    <div className={`p-3 rounded-lg border ${txProgress.phase === 'error' ? 'bg-red-500/10 border-red-500/20' : 'bg-primary/10 border-primary/20'}`}>
                      <p className="text-xs font-medium mb-1">{t('market.txStatus')}</p>
                      <p className="text-xs text-muted-foreground">{txProgress.message}</p>
                      <div className="w-full h-1.5 rounded bg-muted/50 mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${txProgress.phase === 'error' ? 'bg-red-500' : 'bg-primary'}`}
                          style={{
                            width:
                              txProgress.phase === 'building' ? '20%' :
                              txProgress.phase === 'signing' ? '40%' :
                              txProgress.phase === 'submitting' ? '65%' :
                              txProgress.phase === 'confirming' ? '85%' :
                              txProgress.phase === 'success' ? '100%' : '100%'
                          }}
                        />
                      </div>
                      {txProgress.txHash && (
                        <p className="text-[10px] text-muted-foreground mt-2 break-all">Hash: {txProgress.txHash}</p>
                      )}
                    </div>
                  )}

                  {partialFillResult && (
                    <PartialFillBanner result={partialFillResult} tokenType={position} />
                  )}
                </TabsContent>

                <TabsContent value="sell" className="space-y-4">
                  <p className="text-center text-muted-foreground py-8">
                    {t('market.sellPrompt')}
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Market Info */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="w-4 h-4" />
                {t('market.info')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t('market.volume')}
                  </span>
                  <span className="font-medium">{formatVolume(liveVolume)}</span>
                </div>
                <ConfidenceMeter
                  liquidity={liveLiquidity}
                  volume={liveVolume}
                />
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('market.traders')}
                  </span>
                  <span className="font-medium">{currentMarket.traders}</span>
                </div>
                {currentMarket.region && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Region
                    </span>
                    <span className="font-medium capitalize">{currentMarket.region.replace('_', ' ')}</span>
                  </div>
                )}
                {currentMarket.volatility && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Volatility
                    </span>
                    <span className={cn(
                      "font-medium capitalize",
                      currentMarket.volatility.badge === 'low' && 'text-green-400',
                      currentMarket.volatility.badge === 'moderate' && 'text-yellow-400',
                      currentMarket.volatility.badge === 'high' && 'text-orange-400',
                      currentMarket.volatility.badge === 'extreme' && 'text-red-400'
                    )}>
                      {currentMarket.volatility.badge} ({currentMarket.volatility.score})
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {t('market.created')}
                  </span>
                  <span className="font-medium">{new Date(currentMarket.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('market.expires')}
                  </span>
                  <div className="text-right">
                    <div className="font-medium">{new Date(currentMarket.expirationDate).toLocaleDateString()}</div>
                    <CountdownTimer expiryDate={currentMarket.expirationDate} className="mt-1" />
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">{t('market.resolutionSource')}</p>
                <p className="text-sm">{currentMarket.resolutionSource}</p>
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">{t('market.creator')}</p>
                <a href="#" className="text-sm text-primary flex items-center gap-1 hover:underline">
                  {currentMarket.creator}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TradeConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleTradeConfirm}
        isLoading={isLoading}
        tradeDetails={{
          type: tradeType,
          position: position,
          amount: amount,
          price: price,
          tokensReceived: tokensReceived,
          priceImpact: priceImpact,
          fee: estimatedFee,
          slippage: "1.0",
        }}
      />
    </Layout>
  );
}
