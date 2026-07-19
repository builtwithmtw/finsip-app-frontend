// Server-only: builds the screener's rows from Sarmaaya's REST feed.
//
// Replaces the per-ticker dps.psx.com.pk EOD scrape. That approach issued one
// request per ticker (130 of them), which is why it needed a retry pool, shared
// backpressure and a repair pass -- the portal rate-limits per IP and a run that
// tripped it came back with holes. This is two requests plus a small top-up.
//
// Sources (free, no key, undocumented):
//   /api/indices/ALLSHR/companies    -> price, mcap, 1D, 52w, volume (450 cos.)
//   /api/indices/KMIALLSHR/companies -> Shariah membership           (290 cos.)
//   /api/stocks/{SYMBOL}             -> same minus mcap, for the 4 ALLSHR omits
//
// The long-horizon returns (1M/6M/YTD/5Y) are gone with the EOD feed: this API
// carries same-day change and nothing further back, and there is no endpoint
// that serves the others (probed: /performance, /returns, /historical, /chart
// -- all 404).

import type { Sector, Stock } from "./types";
import { SHARIAH_SYMBOLS } from "./shariah";
import { TICKERS } from "./seed";

const BASE = "https://beta-restapi.sarmaaya.pk/api";

/** Every listed company, with market cap. Our primary source. */
const ALLSHR_URL = `${BASE}/indices/ALLSHR/companies?page=1&limit=500`;

/** The Shariah-compliant subset. Membership here *is* the compliance flag. */
const KMI_URL = `${BASE}/indices/KMIALLSHR/companies?page=1&limit=500`;

/**
 * Per-symbol lookup for the handful of seed tickers ALLSHR omits -- FSWL, JUBS,
 * PPVC and SUHJ are listed and trading but are not constituents, so without
 * this they render as empty rows.
 *
 * The bulk /api/stocks list also covers them, but only with price and change;
 * this endpoint additionally carries high52/low52/volume, which is why it is
 * worth N small requests instead of one big one. N is 4 today and is bounded by
 * the seed list, not by the exchange.
 *
 * Market cap is the one field it does not return, so these tickers still show
 * "—" in that column.
 */
const symbolURL = (t: string) => `${BASE}/stocks/${encodeURIComponent(t)}`;

const REQUEST_TIMEOUT_MS = 15_000;

type IndexRow = {
  symbol: string;
  curr: number;
  changePercent: number;
  marketCap: number;
  high52: number;
  low52: number;
  volume: number;
};

/** Same figures as IndexRow under different names, minus market cap. */
type SymbolRow = {
  symbol: string;
  close: number;
  change_percentage: number;
  high52: number;
  low52: number;
  volume: number;
};

/**
 * The feed reports "no data" as 0, not null -- a genuinely zero price or market
 * cap is impossible, so 0 means the row is stale (GEMPACRA is one). Coercing it
 * here keeps the "—" placeholder in the table honest instead of printing 0.00.
 */
const nullIfZero = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : null;

/**
 * For the 1D change specifically, 0 is a real reading -- a flat day. Only a
 * missing or non-numeric value is unknown, so this cannot use nullIfZero or
 * every unchanged ticker would render "—" instead of 0.00%.
 */
const asNumber = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

/**
 * Fallback CORS-proxy prefix, same `prefix + encodeURIComponent(target)` shape
 * the client-side ProxyContext uses. Not needed on the happy path -- this
 * module runs server-side, where there is no CORS to work around -- so it is
 * only ever reached after a direct request has already failed.
 *
 * It covers the case where Sarmaaya answers a laptop but refuses Netlify's
 * datacenter IPs. The proxy list the UI offers lives in Supabase and
 * localStorage and cannot be read from here, so this is the server's own single
 * equivalent; override it with SARMAAYA_PROXY_URL without a redeploy.
 */
const PROXY_PREFIX =
  process.env.SARMAAYA_PROXY_URL?.trim() ||
  "https://finsip.muhammadtalhawaseem.workers.dev/?url=";

const requestJSON = (url: string) =>
  fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // These are end-of-day figures behind our own route's cache; asking Next
    // not to layer another cache underneath keeps the freshness story in one
    // place (the Cache-Control the route sets).
    cache: "no-store",
    headers: { accept: "application/json" },
  });

async function getJSON<T>(url: string, unwrap: (body: unknown) => T): Promise<T> {
  let res: Response;
  try {
    res = await requestJSON(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  } catch (direct) {
    // A blocked origin looks like either a non-OK status or a thrown network
    // error, so both paths land here.
    console.warn(`Direct fetch failed for ${url}, retrying via proxy`, direct);
    res = await requestJSON(PROXY_PREFIX + encodeURIComponent(url));
    if (!res.ok) throw new Error(`proxied ${url} -> ${res.status}`);
  }
  return unwrap(await res.json());
}

const asIndexRows = (body: unknown): IndexRow[] => {
  const data = (body as { response?: { data?: unknown } })?.response?.data;
  if (!Array.isArray(data)) throw new Error("unexpected index payload");
  return data as IndexRow[];
};

const asSymbolRow = (body: unknown): SymbolRow => {
  const data = (body as { response?: unknown })?.response;
  if (!data || typeof data !== "object") {
    throw new Error("unexpected symbol payload");
  }
  return data as SymbolRow;
};

const bySymbol = <T extends { symbol: string }>(rows: T[]): Map<string, T> =>
  new Map(rows.map((r) => [r.symbol.toUpperCase(), r]));

export type FetchResult = {
  stocks: Stock[];
  /** Seed tickers no source could price. Drives the route's cache policy. */
  missing: string[];
};

export async function fetchAllStocks(): Promise<FetchResult> {
  // Independent requests, so pay for the slowest rather than the sum. Only
  // ALLSHR is load-bearing; the other two degrade rather than fail the run.
  const [allshr, kmi] = await Promise.all([
    getJSON(ALLSHR_URL, asIndexRows),
    getJSON(KMI_URL, asIndexRows).catch(() => null),
  ]);

  const index = bySymbol(allshr);

  // Only now do we know which seed tickers the index left out, so the per-symbol
  // top-up has to come after. Failures resolve to null: one unreachable ticker
  // should cost that row its figures, not fail the whole table.
  const strays = TICKERS.map((t) => t.ticker).filter(
    (t) => !index.has(t.toUpperCase()),
  );
  const topUps = await Promise.all(
    strays.map((t) =>
      getJSON(symbolURL(t), asSymbolRow).catch(() => null),
    ),
  );
  const extra = new Map<string, SymbolRow>();
  strays.forEach((t, i) => {
    const row = topUps[i];
    if (row) extra.set(t.toUpperCase(), row);
  });

  // KMIALLSHR membership is the live truth. When that call fails we fall back
  // to the checked-in set rather than letting every row go non-compliant --
  // silently clearing the badge is worse than serving a slightly stale list,
  // because nothing about the UI would signal the flag had stopped working.
  const shariah: ReadonlySet<string> = kmi
    ? new Set(kmi.map((r) => r.symbol.toUpperCase()))
    : SHARIAH_SYMBOLS;

  const missing: string[] = [];

  // Driven by TICKERS, not by the feed: the screener's universe is our 130
  // seed tickers in their assigned sectors. A ticker the feed drops becomes a
  // blank row here, which is visible, instead of vanishing from the table.
  const stocks = TICKERS.map(({ ticker, sector }): Stock => {
    const key = ticker.toUpperCase();
    const row = index.get(key);
    const alt = extra.get(key);

    if (!row && !alt) missing.push(ticker);

    return {
      ticker,
      sector: sector as Sector,
      isShariah: shariah.has(key),
      price: row ? nullIfZero(row.curr) : nullIfZero(alt?.close),
      // The only field the per-symbol endpoint cannot supply, so the tickers
      // ALLSHR omits show "—" here and are filled everywhere else.
      marketCap: nullIfZero(row?.marketCap),
      high52: nullIfZero(row?.high52 ?? alt?.high52),
      low52: nullIfZero(row?.low52 ?? alt?.low52),
      // Zero volume is a real reading -- an untraded session -- but the feed
      // also uses 0 for its stale rows, and there is no way to tell the two
      // apart from this payload. Treating it as unknown is the safer read.
      volume: nullIfZero(row?.volume ?? alt?.volume),
      d1: row ? asNumber(row.changePercent) : asNumber(alt?.change_percentage),
    };
  });

  return { stocks, missing };
}
