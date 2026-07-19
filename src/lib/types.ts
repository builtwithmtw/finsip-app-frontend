// Domain types for the PSX stock screener.

export const SECTORS = [
  "COMMERCIAL BANKS",
  "OIL & GAS EXPLORATION COMPANIES",
  "FERTILIZER",
  "CEMENT",
  "FOOD & PERSONAL CARE PRODUCTS",
  "INV. BANKS / INV. COS. / SECURITIES COS.",
  "AUTOMOBILE ASSEMBLER",
  "TECHNOLOGY & COMMUNICATION",
  "POWER GENERATION & DISTRIBUTION",
  "PHARMACEUTICALS",
  "TEXTILE COMPOSITE",
  "OIL & GAS MARKETING COMPANIES",
  "CHEMICAL",
  "REFINERY",
  "TRANSPORT",
  "ENGINEERING",
  "LEATHER & TANNERIES",
  "PAPER & BOARD",
  "REAL ESTATE INVESTMENT TRUST",
  "GLASS & CERAMICS",
  "CABLE & ELECTRICAL GOODS",
  "PROPERTY",
  "TEXTILE WEAVING",
  "MISCELLANEOUS",
] as const;

export type Sector = (typeof SECTORS)[number];

export type Stock = {
  ticker: string;
  sector: Sector;
  isShariah: boolean;
  /** Latest end-of-day close, in PKR. `null` when the feed has no price. */
  price: number | null;
  /** Shares outstanding × latest close, in PKR. `null` if the feed omits it. */
  marketCap: number | null;
  /**
   * Same-day percentage change vs the previous close. `0` is a real value (a
   * flat day); `null` means the feed had no reading for this ticker.
   *
   * The only horizon we carry. 1M/6M/YTD/5Y went away with the per-ticker EOD
   * scrape -- the Sarmaaya feed that replaced it has no history endpoint, so
   * there is nothing to compute them from. See lib/sarmaaya.ts.
   */
  d1: number | null;
  /** Highest close in the trailing 52 weeks, in PKR. */
  high52: number | null;
  /** Lowest close in the trailing 52 weeks, in PKR. */
  low52: number | null;
  /** Shares traded on the latest session. */
  volume: number | null;
};

/**
 * A "blue chip" is any ticker whose market cap clears this bar (in PKR).
 * Tune here — it's the only definition the screener uses.
 */
export const BLUECHIP_MIN_MARKET_CAP = 100e9;

/** Filter state shared between the sidebar and the table. */
export type Filters = {
  shariahOnly: boolean;
  /** Float pinned tickers to the top of the table. Not a filter — nothing is hidden. */
  pinnedFirst: boolean;
  bluechipOnly: boolean;
  sectors: Sector[]; // empty = all sectors
};
