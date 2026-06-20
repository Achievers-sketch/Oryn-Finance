import { describe, it, expect, beforeEach, vi } from 'vitest';

interface PortfolioMetrics {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  allocation: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  historicalData: Array<{
    date: string;
    value: number;
    profitLoss: number;
  }>;
  performanceMetrics: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function calculatePortfolioMetrics(positions: any, stats: any): PortfolioMetrics {
  const allocation: PortfolioMetrics['allocation'] = [];
  let totalValue = 0;
  let totalInvested = 0;
  let totalProfitLoss = 0;

  if (positions && Array.isArray(positions)) {
    positions.forEach((position, index) => {
      const value = position.currentValue || 0;
      const invested = position.amountInvested || 0;
      const profitLoss = value - invested;

      totalValue += value;
      totalInvested += invested;
      totalProfitLoss += profitLoss;

      allocation.push({
        name: position.marketQuestion || `Position ${index + 1}`,
        value,
        percentage: 0,
        color: COLORS[index % COLORS.length],
      });
    });
  }

  const profitLossPercentage =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  allocation.forEach((item) => {
    item.percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
  });

  return {
    totalValue: Math.max(0, totalValue),
    totalInvested: Math.max(0, totalInvested),
    totalProfitLoss,
    profitLossPercentage,
    allocation: allocation.filter((item) => item.value > 0),
    historicalData: [],
    performanceMetrics: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
  };
}

describe('Portfolio Analytics Metrics Calculation', () => {
  describe('Portfolio Value Calculation', () => {
    it('should calculate total portfolio value correctly', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Bitcoin Price' },
        { currentValue: 500, amountInvested: 400, marketQuestion: 'Ethereum Price' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalValue).toBe(1500);
    });

    it('should return zero when no positions exist', () => {
      const metrics = calculatePortfolioMetrics([], {});

      expect(metrics.totalValue).toBe(0);
    });

    it('should handle null or undefined positions', () => {
      const metrics = calculatePortfolioMetrics(null, {});

      expect(metrics.totalValue).toBe(0);
    });

    it('should filter out zero-value positions from allocation', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Bitcoin' },
        { currentValue: 0, amountInvested: 100, marketQuestion: 'Empty Position' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation).toHaveLength(1);
      expect(metrics.allocation[0].name).toBe('Bitcoin');
    });
  });

  describe('Profit and Loss Calculation', () => {
    it('should calculate total profit correctly', () => {
      const positions = [
        { currentValue: 1200, amountInvested: 1000, marketQuestion: 'Market A' },
        { currentValue: 600, amountInvested: 500, marketQuestion: 'Market B' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalProfitLoss).toBe(300);
    });

    it('should calculate total loss correctly', () => {
      const positions = [
        { currentValue: 800, amountInvested: 1000, marketQuestion: 'Market A' },
        { currentValue: 400, amountInvested: 500, marketQuestion: 'Market B' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalProfitLoss).toBe(-300);
    });

    it('should calculate profit/loss percentage correctly', () => {
      const positions = [
        { currentValue: 1100, amountInvested: 1000, marketQuestion: 'Market A' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.profitLossPercentage).toBeCloseTo(10, 1);
    });

    it('should handle zero invested amount', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 0, marketQuestion: 'Market A' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.profitLossPercentage).toBe(0);
    });
  });

  describe('Asset Allocation Calculation', () => {
    it('should calculate allocation percentages that sum to approximately 100%', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Asset A' },
        { currentValue: 500, amountInvested: 400, marketQuestion: 'Asset B' },
        { currentValue: 500, amountInvested: 300, marketQuestion: 'Asset C' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      const totalPercentage = metrics.allocation.reduce((sum, item) => sum + item.percentage, 0);

      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('should assign correct colors to allocation items', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Asset A' },
        { currentValue: 500, amountInvested: 400, marketQuestion: 'Asset B' },
        { currentValue: 500, amountInvested: 300, marketQuestion: 'Asset C' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation[0].color).toBe(COLORS[0]);
      expect(metrics.allocation[1].color).toBe(COLORS[1]);
      expect(metrics.allocation[2].color).toBe(COLORS[2]);
    });

    it('should handle single position allocation', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Single Asset' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation).toHaveLength(1);
      expect(metrics.allocation[0].percentage).toBeCloseTo(100, 1);
    });

    it('should exclude positions with zero current value from allocation', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Active' },
        { currentValue: 0, amountInvested: 500, marketQuestion: 'Inactive' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation).toHaveLength(1);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should prevent negative portfolio values', () => {
      const positions = [
        { currentValue: -1000, amountInvested: 800, marketQuestion: 'Negative' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalValue).toBe(0);
    });

    it('should handle empty positions array', () => {
      const metrics = calculatePortfolioMetrics([], {});

      expect(metrics.totalValue).toBe(0);
      expect(metrics.totalInvested).toBe(0);
      expect(metrics.totalProfitLoss).toBe(0);
      expect(metrics.profitLossPercentage).toBe(0);
      expect(metrics.allocation).toHaveLength(0);
    });

    it('should handle positions with missing marketQuestion', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800 },
        { currentValue: 500, amountInvested: 400 },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation[0].name).toBe('Position 1');
      expect(metrics.allocation[1].name).toBe('Position 2');
    });

    it('should handle very large portfolio values', () => {
      const positions = [
        { currentValue: 1e10, amountInvested: 9e9, marketQuestion: 'Large Position' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalValue).toBe(1e10);
      expect(metrics.totalInvested).toBe(9e9);
      expect(metrics.profitLossPercentage).toBeCloseTo(11.11, 1);
    });

    it('should handle very small decimal values', () => {
      const positions = [
        { currentValue: 0.001, amountInvested: 0.0009, marketQuestion: 'Tiny Position' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalValue).toBeCloseTo(0.001, 5);
      expect(metrics.totalProfitLoss).toBeCloseTo(0.0001, 5);
    });
  });

  describe('Performance Metrics', () => {
    it('should return zero performance metrics by default', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Market' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.performanceMetrics.daily).toBe(0);
      expect(metrics.performanceMetrics.weekly).toBe(0);
      expect(metrics.performanceMetrics.monthly).toBe(0);
    });

    it('should include empty historical data', () => {
      const positions = [
        { currentValue: 1000, amountInvested: 800, marketQuestion: 'Market' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(Array.isArray(metrics.historicalData)).toBe(true);
    });
  });

  describe('Multiple Positions Scenario', () => {
    it('should correctly aggregate metrics for complex portfolio', () => {
      const positions = [
        { currentValue: 5000, amountInvested: 4000, marketQuestion: 'BTC' },
        { currentValue: 3000, amountInvested: 3500, marketQuestion: 'ETH' },
        { currentValue: 2000, amountInvested: 1500, marketQuestion: 'SOL' },
        { currentValue: 1000, amountInvested: 2000, marketQuestion: 'ADA' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.totalValue).toBe(11000);
      expect(metrics.totalInvested).toBe(11000);
      expect(metrics.totalProfitLoss).toBe(0);
      expect(metrics.allocation).toHaveLength(4);
    });

    it('should calculate correct allocation percentages for diverse portfolio', () => {
      const positions = [
        { currentValue: 6000, amountInvested: 4000, marketQuestion: 'Large' },
        { currentValue: 3000, amountInvested: 3000, marketQuestion: 'Medium' },
        { currentValue: 1000, amountInvested: 1000, marketQuestion: 'Small' },
      ];

      const metrics = calculatePortfolioMetrics(positions, {});

      expect(metrics.allocation[0].percentage).toBeCloseTo(60, 1);
      expect(metrics.allocation[1].percentage).toBeCloseTo(30, 1);
      expect(metrics.allocation[2].percentage).toBeCloseTo(10, 1);
    });
  });
});

describe('Currency Formatting', () => {
  it('should format numbers as currency', () => {
    const value = 1234.56;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    expect(formatted).toBe('$1,234.56');
  });

  it('should format zero correctly', () => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);

    expect(formatted).toBe('$0.00');
  });

  it('should format large numbers correctly', () => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1000000);

    expect(formatted).toBe('$1,000,000.00');
  });
});

describe('Percentage Formatting', () => {
  it('should format positive percentages', () => {
    const value = 5.25;
    const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    expect(formatted).toBe('+5.25%');
  });

  it('should format negative percentages', () => {
    const value = -3.5;
    const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    expect(formatted).toBe('-3.50%');
  });

  it('should format zero percentage', () => {
    const value = 0;
    const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    expect(formatted).toBe('+0.00%');
  });
});
