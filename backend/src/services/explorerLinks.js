/**
 * Explorer Deep-Linking Service
 * Issue #83: Link contracts and transactions to Stellar Explorer
 *
 * Generates deep-links to Stellar Explorer (and Stellar.expert) so users
 * can inspect deployed contracts and transaction hashes directly from the UI.
 */

const contractConfig = require('../config/contracts');
const logger = require('../config/logger');

// Explorer base URLs per network
const EXPLORER_BASES = {
  testnet: {
    stellarExpert: 'https://stellar.expert/explorer/testnet',
    stellarLaboratory: 'https://laboratory.stellar.org/#explorer',
    horizonApi: 'https://horizon-testnet.stellar.org',
  },
  mainnet: {
    stellarExpert: 'https://stellar.expert/explorer/public',
    stellarLaboratory: 'https://laboratory.stellar.org/#explorer',
    horizonApi: 'https://horizon.stellar.org',
  },
};

class ExplorerLinksService {
  constructor() {
    this.network = contractConfig.CURRENT_NETWORK || 'testnet';
    this.bases = EXPLORER_BASES[this.network] || EXPLORER_BASES.testnet;
  }

  /**
   * Build a deep-link to a deployed contract on Stellar Expert.
   * @param {string} contractAddress - Soroban contract address (C...)
   * @returns {{ url: string, label: string, openInNewTab: boolean }}
   */
  buildContractLink(contractAddress) {
    if (!contractAddress) {
      throw new Error('Contract address is required');
    }
    const url = `${this.bases.stellarExpert}/contract/${contractAddress}`;
    return {
      url,
      label: `View on Stellar Expert`,
      openInNewTab: true,
      network: this.network,
    };
  }

  /**
   * Build a deep-link to a transaction hash on Stellar Expert.
   * @param {string} txHash - Stellar transaction hash
   * @returns {{ url: string, label: string, openInNewTab: boolean }}
   */
  buildTransactionLink(txHash) {
    if (!txHash) {
      throw new Error('Transaction hash is required');
    }
    const url = `${this.bases.stellarExpert}/tx/${txHash}`;
    return {
      url,
      label: `View Transaction on Stellar Expert`,
      openInNewTab: true,
      network: this.network,
    };
  }

  /**
   * Build a deep-link to an account/wallet on Stellar Expert.
   * @param {string} accountAddress - Stellar account address (G...)
   * @returns {{ url: string, label: string, openInNewTab: boolean }}
   */
  buildAccountLink(accountAddress) {
    if (!accountAddress) {
      throw new Error('Account address is required');
    }
    const url = `${this.bases.stellarExpert}/account/${accountAddress}`;
    return {
      url,
      label: `View Account on Stellar Expert`,
      openInNewTab: true,
      network: this.network,
    };
  }

  /**
   * Build a deep-link to a ledger on Stellar Expert.
   * @param {number} ledgerSequence
   * @returns {{ url: string, label: string, openInNewTab: boolean }}
   */
  buildLedgerLink(ledgerSequence) {
    if (!ledgerSequence) {
      throw new Error('Ledger sequence is required');
    }
    const url = `${this.bases.stellarExpert}/ledger/${ledgerSequence}`;
    return {
      url,
      label: `View Ledger ${ledgerSequence} on Stellar Expert`,
      openInNewTab: true,
      network: this.network,
    };
  }

  /**
   * Generate deep-links for ALL deployed contracts.
   * Returns a map of contractName -> link object.
   */
  getAllContractLinks() {
    const contracts = contractConfig.DEPLOYED_CONTRACTS;
    const links = {};

    for (const [name, address] of Object.entries(contracts)) {
      if (!address) {
        links[name] = { url: null, label: 'Not deployed', openInNewTab: false, network: this.network };
        continue;
      }

      try {
        // Validate it looks like a contract address before linking
        if (contractConfig.validateContractAddress(address)) {
          links[name] = this.buildContractLink(address);
          links[name].contractAddress = address;
          links[name].contractName = name;
        } else {
          links[name] = {
            url: null,
            label: 'Invalid address',
            openInNewTab: false,
            network: this.network,
            contractAddress: address,
            contractName: name,
          };
        }
      } catch (err) {
        logger.warn(`Could not build explorer link for ${name}:`, err.message);
        links[name] = {
          url: null,
          label: 'Link unavailable',
          openInNewTab: false,
          network: this.network,
          contractName: name,
        };
      }
    }

    return links;
  }

  /**
   * Get a single contract's explorer link by contract name key.
   * @param {string} contractName - e.g. 'MARKET_FACTORY'
   */
  getContractLinkByName(contractName) {
    const contracts = contractConfig.DEPLOYED_CONTRACTS;
    const address = contracts[contractName.toUpperCase()];

    if (!address) {
      return {
        contractName,
        url: null,
        label: 'Contract not deployed',
        openInNewTab: false,
        network: this.network,
      };
    }

    const link = this.buildContractLink(address);
    return {
      ...link,
      contractName,
      contractAddress: address,
    };
  }

  /**
   * Build a Horizon API link for a transaction (raw API endpoint).
   * Useful for developers who want the raw JSON.
   * @param {string} txHash
   */
  buildHorizonTransactionLink(txHash) {
    if (!txHash) {
      throw new Error('Transaction hash is required');
    }
    return {
      url: `${this.bases.horizonApi}/transactions/${txHash}`,
      label: 'View on Horizon API',
      openInNewTab: true,
      network: this.network,
    };
  }

  /**
   * Get the current network's explorer base URLs.
   */
  getExplorerBases() {
    return {
      network: this.network,
      ...this.bases,
    };
  }
}

module.exports = new ExplorerLinksService();
