import { useState, useCallback, useRef } from 'react';

export type OptimisticPhase =
  | 'idle'
  | 'optimistic'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'rolled_back';

export interface OptimisticTrade {
  id: string;
  type: 'buy' | 'sell';
  position: 'YES' | 'NO';
  amount: number;
  price: number;
  tokensReceived: string;
  fee: string;
  marketId: string;
  marketQuestion: string;
  timestamp: number;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'partial';
  partialFill?: {
    filledAmount: number;
    remainingAmount: number;
    fillRatio: number;
    requestedAmount: number;
  };
}

interface UseOptimisticTradeCallbacks {
  onSuccess?: (trade: OptimisticTrade) => void;
  onError?: (error: Error, trade: OptimisticTrade) => void;
  onSettled?: () => void;
}

export function useOptimisticTrade(callbacks?: UseOptimisticTradeCallbacks) {
  const [optimisticTrades, setOptimisticTrades] = useState<OptimisticTrade[]>([]);
  const [phase, setPhase] = useState<OptimisticPhase>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generateId = useCallback(() => {
    return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  const addOptimisticTrade = useCallback(
    (trade: Omit<OptimisticTrade, 'id' | 'timestamp' | 'status'> & { id?: string; timestamp?: number }) => {
      const id = trade.id || generateId();
      const optimisticTrade: OptimisticTrade = {
        ...trade,
        id,
        timestamp: trade.timestamp || Date.now(),
        status: 'pending',
      };
      setOptimisticTrades((prev) => [optimisticTrade, ...prev]);
      setActiveTradeId(id);
      setPhase('optimistic');
      setPhaseMessage('Order confirmed — finalizing on-chain...');
      return id;
    },
    [generateId]
  );

  const updateOptimisticTrade = useCallback((id: string, updates: Partial<OptimisticTrade>) => {
    setOptimisticTrades((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const confirmOptimisticTrade = useCallback(
    (id: string, updates: Partial<Omit<OptimisticTrade, 'id'>>) => {
      setOptimisticTrades((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...updates, status: updates.status || ('confirmed' as const) }
            : t
        )
      );
      setPhase('confirmed');
      setPhaseMessage('Order confirmed');
      const resolved = optimisticTrades.find((t) => t.id === id);
      if (resolved) {
        callbacks?.onSuccess?.(resolved);
      }
      callbacks?.onSettled?.();
    },
    [optimisticTrades, callbacks]
  );

  const rollbackOptimisticTrade = useCallback(
    (id: string, error: Error) => {
      setOptimisticTrades((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: 'failed' as const, txHash: undefined } : t
        )
      );
      setPhase('rolled_back');
      setPhaseMessage(error.message);
      const failedTrade = optimisticTrades.find((t) => t.id === id);
      if (failedTrade) {
        callbacks?.onError?.(error, failedTrade);
      }
      callbacks?.onSettled?.();
      setTimeout(() => {
        setOptimisticTrades((prev) => prev.filter((t) => t.id !== id || t.status !== 'failed'));
      }, 8000);
    },
    [optimisticTrades, callbacks]
  );

  const setTransactionPhase = useCallback(
    (newPhase: OptimisticPhase, message: string, hash?: string) => {
      setPhase(newPhase);
      setPhaseMessage(message);
      if (hash) setTxHash(hash);
    },
    []
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setPhaseMessage('');
    setTxHash(undefined);
    setActiveTradeId(null);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const isPending =
    phase === 'optimistic' ||
    phase === 'building' ||
    phase === 'signing' ||
    phase === 'submitting' ||
    phase === 'confirming';
  const isError = phase === 'failed' || phase === 'rolled_back';
  const isSuccess = phase === 'confirmed';

  return {
    optimisticTrades,
    phase,
    phaseMessage,
    txHash,
    activeTradeId,
    addOptimisticTrade,
    updateOptimisticTrade,
    confirmOptimisticTrade,
    rollbackOptimisticTrade,
    setTransactionPhase,
    reset,
    abortRef,
    isPending,
    isError,
    isSuccess,
    setOptimisticTrades,
  };
}
