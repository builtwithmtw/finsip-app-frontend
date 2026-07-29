import { supabase } from "@/lib/supabase";
import type { IndexCompany, RememberedEntries, WatchlistItem } from "@/types";

/**
 * Query keys and fetchers shared by the boot gate and the hooks that read the
 * same data later.
 *
 * The gate warms every one of these before the app shell is shown, and the
 * hooks then read the warm cache. Both sides have to name the query identically
 * or the hook would miss the entry the gate just filled and fetch again on the
 * tab that mounts it -- which is the exact thing the gate exists to prevent. So
 * the key is built here, once, and never inline at a call site.
 */
export const queryKeys = {
  /** The screener universe from our own /api/stocks route. */
  stocks: ["stocks"] as const,
  watchlist: (userId: string) => ["watchlist", userId] as const,
  rememberedEntries: (userId: string) => ["remembered-entries", userId] as const,
  /**
   * Keyed by gateway as well as index: these feeds are only reachable through
   * the selected CORS proxy, so a result fetched through one is not an answer
   * for another. Without the id in the key, switching gateway after a failure
   * would hand the Allocation tab back the same cached failure it was trying to
   * get away from.
   */
  indexCompanies: (index: MarketIndex, proxyId: string) =>
    ["index-companies", index, proxyId] as const,
};

export type MarketIndex = "KMI30" | "ALLSHR";

/* -------------------------------------------------------------------------- */
/* Watchlist                                                                  */
/* -------------------------------------------------------------------------- */

const mapWatchlistRow = (r: {
  id: string;
  symbol: string;
  sector: string | null;
  created_at: string;
}): WatchlistItem => ({
  id: r.id,
  symbol: r.symbol,
  sector: r.sector,
  createdAt: r.created_at,
});

export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWatchlistRow);
}

/* -------------------------------------------------------------------------- */
/* Remembered entries                                                         */
/* -------------------------------------------------------------------------- */

export async function fetchRememberedEntries(
  userId: string,
): Promise<RememberedEntries> {
  const { data, error } = await supabase
    .from("remembered_entries")
    .select("entries")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.entries as RememberedEntries) ?? {};
}

/* -------------------------------------------------------------------------- */
/* Index companies                                                            */
/* -------------------------------------------------------------------------- */

const FEED_LIMITS: Record<MarketIndex, number> = {
  KMI30: 100,
  // The whole market: the price and logo source for the user's own symbols.
  ALLSHR: 1000,
};

const FETCH_TIMEOUT_MS = 10_000;

interface FeedRow {
  symbol?: string;
  weights?: number | string;
  curr?: number | string;
  logo?: string;
  sector_name?: string;
  company_name?: string;
}

const parseFeed = (json: unknown): FeedRow[] => {
  const data = (json as { response?: { data?: unknown } })?.response?.data;
  return Array.isArray(data) ? (data as FeedRow[]) : [];
};

const toCompany = (row: FeedRow): IndexCompany => ({
  name: (row.symbol ?? "").toString().toUpperCase().trim(),
  weight: Number(row.weights ?? 0) || 0,
  price: Number(row.curr ?? 0) || 0,
  logo: row.logo ?? "",
  sector: row.sector_name ?? "Unknown",
  companyName: row.company_name ?? "",
});

/**
 * Companies of a PSX index, with their index weight and last price, read through
 * the user's selected CORS gateway.
 *
 * Index feeds come back heaviest-first (that ordering is what the allocation
 * engine funds); ALLSHR comes back alphabetically, since it is only ever
 * searched by symbol.
 */
export async function fetchIndexCompanies(
  index: MarketIndex,
  proxyUrl: string,
): Promise<IndexCompany[]> {
  if (!proxyUrl) throw new Error("No gateway selected");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const targetUrl = `https://beta-restapi.sarmaaya.pk/api/indices/${index}/companies?page=1&limit=${FEED_LIMITS[index]}`;
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = parseFeed(await response.json());
    if (!rows.length) throw new Error("Empty response from the market feed");

    return rows
      .map(toCompany)
      .filter((c) => c.name)
      .sort((a, b) =>
        index === "ALLSHR" ? a.name.localeCompare(b.name) : b.weight - a.weight,
      );
  } finally {
    clearTimeout(timeout);
  }
}
