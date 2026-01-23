export interface Stock {
  id: string;
  symbol: string;
  name?: string;
  sector: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  month: string; // YYYY-MM
  symbol: string;
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  type: 'buy' | 'sell';
  createdAt: number;
}

export interface CashEntry {
  id: string;
  date: string; // YYYY-MM
  amount: number;
  description: string;
  createdAt: number;
}

export interface Payout {
  id: string;
  stockSymbol: string;
  date: string; // YYYY-MM-DD
  amount: number;
  createdAt: number;
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
  totalInvested: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  totalInvested: number;
  transactionCount: number;
}
