export interface Stock {
  id: string;
  symbol: string;
  sector: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  month: string; // YYYY-MM
  symbol: string;
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  type: "buy" | "sell";
  createdAt: string;
}


export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalShares: number;
}

export interface Holding {
  symbol: string;
  totalShares: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  totalInvested: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  totalInvested: number;
  transactionCount: number;
}

export interface RealizedProfit {
  id: string;
  symbol: string;
  quantitySold: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  realizedProfit: number;
  sellDate: string; // YYYY-MM-DD
  createdAt: string;
}
