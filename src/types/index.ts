export interface Stock {
  id: string;
  symbol: string;
  sector: string;
  createdAt: string;
  /** Drag-to-rearrange order. Null on rows created before the position column existed. */
  position: number | null;
  /**
   * Target weight for the Allocation tab, relative to the other symbols rather than a
   * share of 100. Null until one is set.
   */
  allocationWeight: number | null;
}

/** A symbol the user is tracking on the Watchlist tab (not necessarily owned). */
export interface WatchlistItem {
  id: string;
  symbol: string;
  /** Sector captured when the item was added; the table prefers the live feed's sector when it has one. */
  sector: string | null;
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

/** A company as returned by an index feed. */
export interface IndexCompany {
  name: string;
  weight: number;
  price: number;
  logo: string;
  sector: string;
  companyName: string;
}
