type FreighterLike = {
  isConnected?: () => Promise<boolean> | boolean;
  getPublicKey?: () => Promise<string> | string;
  signTransaction?: (xdr: string) => Promise<string> | string;
};

function getFreighter(): FreighterLike | undefined {
  return (globalThis as any).freighter || (typeof window !== 'undefined' ? (window as any).freighter : undefined);
}

export const walletService = {
  async connect() {
    const freighter = getFreighter();
    if (!freighter) {
      throw new Error('Freighter wallet not available');
    }

    const isConnected = freighter.isConnected ? await freighter.isConnected() : true;
    const publicKey = freighter.getPublicKey ? await freighter.getPublicKey() : null;

    return {
      isConnected,
      publicKey,
    };
  },

  async disconnect() {
    return true;
  },

  async getBalance(publicKey: string) {
    return {
      publicKey,
      balances: [],
    };
  },
};

export default walletService;
