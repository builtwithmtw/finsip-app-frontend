import type { Stock } from "./types";

/**
 * Client-side data-access point for the screener.
 *
 * Hits our own `/api/stocks` route handler, which fetches end-of-day prices
 * from the PSX data portal server-side (avoiding browser CORS) and derives the
 * performance returns. See `lib/psx.ts` for the computation.
 */
export async function fetchStocks(): Promise<Stock[]> {
  const res = await fetch("/api/stocks");
  if (!res.ok) throw new Error(`Failed to load stocks: ${res.status}`);
  return (await res.json()) as Stock[];
}
