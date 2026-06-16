import { apiClient } from '@/lib/api-client';
import { ENDPOINTS } from '@/lib/api-config';
import { buildGovernanceProposals, type GovernanceProposal, type GovernanceVoteChoice } from '@/lib/governance';
import { apiService } from './apiService';

type SignTransactionFn = (xdr: string) => Promise<string>;

export class ContractService {
  private static async buildSignAndSubmit(
    buildTransaction: () => Promise<{ xdr: string }>,
    signTransaction: SignTransactionFn
  ) {
    const builtTransaction = await buildTransaction();
    const signedXdr = await signTransaction(builtTransaction.xdr);
    return apiService.transactions.submitSignedTransaction({ signedXdr });
  }

  static async testContractIntegration() {
    return apiService.health.getContractsHealth();
  }

  static async getNetworkInfo() {
    return apiService.network.getNetworkInfo();
  }

  static async getTransactionStatus(txHash: string) {
    return apiService.network.getTransactionStatus(txHash);
  }

  static async createMarket(
    marketData: {
      question: string;
      category: string;
      expiryTimestamp: number;
      initialLiquidity: number;
    },
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildCreateMarket(marketData, authToken),
      signTransaction
    );
  }

  static async buyTokens(
    marketId: string,
    tokenType: 'yes' | 'no',
    amount: number,
    _price: number,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildBuyTokens({ marketId, tokenType, amount }, authToken),
      signTransaction
    );
  }

  static async sellTokens(
    marketId: string,
    tokenType: 'yes' | 'no',
    amount: number,
    _price: number,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildSellTokens({ marketId, tokenType, amount }, authToken),
      signTransaction
    );
  }

  static async claimWinnings(
    marketContract: string,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildClaimWinnings({ marketContract }, authToken),
      signTransaction
    );
  }

  static async swapTokens(
    fromToken: string,
    toToken: string,
    amountIn: number,
    minAmountOut: number,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () =>
        apiService.transactions.buildSwap(
          { fromToken, toToken, amount: amountIn, maxSlippage: minAmountOut },
          authToken
        ),
      signTransaction
    );
  }

  static async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: number,
    amountB: number,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildAddLiquidity({ tokenA, tokenB, amountA, amountB }, authToken),
      signTransaction
    );
  }

  static async stakeTokens(
    amount: number,
    lockPeriod: number,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildStake({ amount, lockPeriod }, authToken),
      signTransaction
    );
  }

  static async voteOnProposal(
    proposalId: number | string,
    choice: GovernanceVoteChoice,
    signTransaction: SignTransactionFn,
    authToken: string
  ) {
    return this.buildSignAndSubmit(
      () => apiService.transactions.buildVote({ proposalId, choice }, authToken),
      signTransaction
    );
  }

  static async getMarketContractData(marketId: string) {
    return apiService.markets.getMarket(marketId);
  }

  static async getGovernanceProposals(limit = 250): Promise<GovernanceProposal[]> {
    try {
      const events = await apiService.analytics.getIndexedEvents({
        contractName: 'GOVERNANCE',
        limit,
      });

      const indexedProposals = buildGovernanceProposals(events);
      if (indexedProposals.length > 0) {
        return indexedProposals;
      }
    } catch {
      // Fall through to the static transaction endpoint below.
    }

    const fallbackProposals = await apiService.transactions.getGovernanceProposals();
    return (fallbackProposals || []).map((proposal: any) => ({
      id: String(proposal.proposalId ?? proposal.id),
      title: String(proposal.title ?? `Proposal #${proposal.proposalId ?? proposal.id}`),
      description: String(proposal.description ?? ''),
      proposer: proposal.proposer ?? null,
      createdAt: proposal.createdAt ?? null,
      deadline: proposal.deadline ?? null,
      executedAt: proposal.executedAt ?? null,
      status: (() => {
        const normalizedStatus = String(proposal.status || 'active').toLowerCase();
        if (normalizedStatus === 'pending') return 'active';
        if (normalizedStatus === 'active') return 'active';
        if (normalizedStatus === 'executed') return 'executed';
        return 'ended';
      })() as GovernanceProposal['status'],
      yesVotes: Number(proposal.forVotes ?? proposal.yesVotes ?? 0),
      noVotes: Number(proposal.againstVotes ?? proposal.noVotes ?? 0),
      abstainVotes: Number(proposal.abstainVotes ?? 0),
      totalVotes: Number(proposal.forVotes ?? proposal.yesVotes ?? 0) + Number(proposal.againstVotes ?? proposal.noVotes ?? 0) + Number(proposal.abstainVotes ?? 0),
      yesShare: 0,
      noShare: 0,
      abstainShare: 0,
      votes: [],
      simulation: proposal.simulation || {
        projectedOutcome: 'Unknown',
        confidence: 0,
        riskLevel: 'Unknown',
        quorumGap: 0,
        keyRisks: [],
      },
    })).map((proposal) => {
      const totalVotes = proposal.totalVotes;
      return {
        ...proposal,
        yesShare: totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 0,
        noShare: totalVotes > 0 ? (proposal.noVotes / totalVotes) * 100 : 0,
        abstainShare: totalVotes > 0 ? (proposal.abstainVotes / totalVotes) * 100 : 0,
      };
    });
  }

  static async buildTransaction(data: {
    contractName: string;
    functionName: string;
    args: unknown[];
  }) {
    const response = await apiClient.post<{ xdr: string }>(ENDPOINTS.BUILD_SWAP, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build transaction');
    }
    return response.data!;
  }

  static async submitTransaction(signedXDR: string, networkPassphrase?: string) {
    return apiService.transactions.submitTransaction({
      xdr: signedXDR,
      networkPassphrase,
    });
  }

  static async getContractState(contractId: string) {
    const endpoint = typeof ENDPOINTS.TRANSACTION_STATUS === 'function'
      ? ENDPOINTS.TRANSACTION_STATUS(contractId)
      : `/transactions/status/${contractId}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get contract state');
    }
    return response.data;
  }
}

export const contractService = ContractService;
export default ContractService;
