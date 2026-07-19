import type { Stock } from "./types";

/**
 * Client-side data-access point for the screener.
 *
 * Hits our own `/api/stocks` route handler, which reads the Sarmaaya feed
 * server-side (avoiding browser CORS) and maps it onto our seed universe.
 * See `lib/sarmaaya.ts`.
 */
export async function fetchStocks(): Promise<Stock[]> {
  const res = await fetch("/api/stocks");
  if (!res.ok) throw new Error(`Failed to load stocks: ${res.status}`);
  return (await res.json()) as Stock[];
}
