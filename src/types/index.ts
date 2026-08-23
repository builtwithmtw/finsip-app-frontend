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

/**
 * A saved set of per-symbol quantities the user can recall into a fresh month.
 * Lives here rather than beside its hook so `lib/queries.ts` can type the
 * fetcher without importing a hook.
 */
export type RememberedEntries = Record<
  string,
  { shares: string; type: "buy" | "sell" }
>;

/** A company as returned by an index feed. */
export interface IndexCompany {
  name: string;
  weight: number;
  price: number;
  logo: string;
  sector: string;
  companyName: string;
}

/**
 * Another account, as the admin-only Peers tab sees it: who they are, plus their
 * whole ledger so every figure on that screen is derived by `utils/holdings.ts`
 * rather than by a second implementation of the same arithmetic in SQL.
 *
 * Only the admin can ever hold one of these -- the two RPCs behind it refuse
 * anyone else (see supabase/add_admin_peers.sql).
 */
export interface Peer {
  userId: string;
  email: string;
  /** The name they chose, if any; the table falls back to the address. */
  displayName: string | null;
  avatarUrl: string | null;
  /** When the account was created. */
  createdAt: string;
  transactions: Transaction[];
  /** Booked profits, from the peer's `realized_pnl` rows. */
  realized: RealizedProfit[];
}
