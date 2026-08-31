import { supabase } from "@/lib/supabase";
import type {
  IndexCompany,
  MomentumIndex,
  Peer,
  RealizedProfit,
  RememberedEntries,
  Transaction,
  WatchlistItem,
} from "@/types";

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
  /**
   * Every other account and its ledger, for the admin-only Peers tab. Keyed by
   * the viewer so the entry cannot outlive a sign-out into a different account
   * -- the data in it belongs to nobody who could legitimately read it there.
   */
  peers: (userId: string) => ["peers", userId] as const,
  /** The scraped JS Momentum Factor Index, for the Allocation tab. */
  momentum: ["momentum"] as const,
};

export type MarketIndex = "KMI30" | "KSE30" | "ALLSHR";

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
  KSE30: 100,
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

/* -------------------------------------------------------------------------- */
/* Peers (admin only)                                                         */
/* -------------------------------------------------------------------------- */

interface PeerRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PeerRealizedRow {
  id: string;
  user_id: string;
  symbol: string;
  quantity_sold: number | string;
  avg_buy_price: number | string;
  avg_sell_price: number | string;
  realized_profit: number | string;
  sell_date: string;
  created_at: string;
}

interface PeerTransactionRow {
  id: string;
  user_id: string;
  month: string;
  symbol: string;
  shares: number | string;
  price_per_share: number | string;
  total_amount: number | string;
  type: string;
  created_at: string;
}

/**
 * Every account except the admin's own, each with its full ledger.
 *
 * Two RPCs rather than a table read: RLS pins every table in this app to
 * `auth.uid()`, and the admin list in `lib/admins.ts` is a badge the client
 * draws, not a permission. The functions check the caller's JWT themselves and
 * throw for anyone else, so this fetcher is safe to call from anywhere -- an
 * ordinary user gets an error, never someone else's rows.
 *
 * The ledgers come back in one call and are grouped here, so opening a peer's
 * portfolio costs no request: the transactions the modal computes from are the
 * ones the table already counted.
 */
export async function fetchPeers(): Promise<Peer[]> {
  const [peers, ledger, realized] = await Promise.all([
    supabase.rpc("admin_peers"),
    supabase.rpc("admin_peer_transactions"),
    supabase.rpc("admin_peer_realized"),
  ]);

  if (peers.error) throw new Error(peers.error.message);
  if (ledger.error) throw new Error(ledger.error.message);
  if (realized.error) throw new Error(realized.error.message);

  const byUser = new Map<string, Transaction[]>();
  for (const t of (ledger.data ?? []) as PeerTransactionRow[]) {
    const list = byUser.get(t.user_id) ?? [];
    list.push({
      id: t.id,
      symbol: t.symbol,
      shares: Number(t.shares) || 0,
      pricePerShare: Number(t.price_per_share) || 0,
      totalAmount: Number(t.total_amount) || 0,
      type: t.type === "sell" ? "sell" : "buy",
      month: t.month,
      createdAt: t.created_at,
    });
    byUser.set(t.user_id, list);
  }

  const bankedByUser = new Map<string, RealizedProfit[]>();
  for (const r of (realized.data ?? []) as PeerRealizedRow[]) {
    const list = bankedByUser.get(r.user_id) ?? [];
    list.push({
      id: r.id,
      symbol: r.symbol,
      quantitySold: Number(r.quantity_sold) || 0,
      avgBuyPrice: Number(r.avg_buy_price) || 0,
      avgSellPrice: Number(r.avg_sell_price) || 0,
      realizedProfit: Number(r.realized_profit) || 0,
      sellDate: r.sell_date,
      createdAt: r.created_at,
    });
    bankedByUser.set(r.user_id, list);
  }

  return ((peers.data ?? []) as PeerRow[]).map((p) => ({
    userId: p.user_id,
    email: p.email ?? "",
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    createdAt: p.created_at,
    transactions: byUser.get(p.user_id) ?? [],
    realized: bankedByUser.get(p.user_id) ?? [],
  }));
}

/* -------------------------------------------------------------------------- */
/* Momentum index                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The JS Momentum Factor Index constituents, through our own route.
 *
 * The route scrapes JS Investments' page server-side -- the browser could not
 * read that HTML itself, and this is not a feed we should be hitting on every
 * view -- and holds the result for the calendar day. `force` is the Rescrape
 * button: it asks the route to go upstream now rather than answer from that
 * day cache.
 */
export async function fetchMomentum(force = false): Promise<MomentumIndex> {
  const res = await fetch(force ? "/api/momentum?refresh=1" : "/api/momentum", {
    // The day cache lives on the server, where it is shared. A browser cache in
    // front of it would only make "rescrape" mean "re-read what I already had".
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load the momentum index: ${res.status}`);
  return (await res.json()) as MomentumIndex;
}
