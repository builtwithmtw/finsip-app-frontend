// Server-only: fetches end-of-day prices from the PSX data portal and derives
// the performance returns shown in the screener table.
//
// Source (free, no key): https://dps.psx.com.pk/timeseries/eod/{TICKER}
//   -> { status: 1, data: [ [epochSeconds, close, volume, open], ... ] }  newest-first
//
// This feed only carries ~5 years of history, which covers 1M / 6M / YTD / 5Y.
// Longer horizons (10Y, 25Y) would need a deeper/licensed feed.

import type { Performance, Sector, Stock } from "./types";
import { isShariahSymbol } from "./shariah";
import { TICKERS } from "./seed";

const EOD_URL = (t: string) =>
  `https://dps.psx.com.pk/timeseries/eod/${encodeURIComponent(t)}`;

const COMPANY_URL = (t: string) =>
  `https://dps.psx.com.pk/company/${encodeURIComponent(t)}`;

const DAY = 86_400_000; // ms in a day
const EMPTY_PERF: Performance = {
  d1: null,
  m1: null,
  m6: null,
  ytd: null,
  y5: null,
};

type Point = { t: number; close: number };

async function fetchEod(ticker: string): Promise<Point[]> {
  const res = await fetch(EOD_URL(ticker), {
    // The portal rejects requests without a browser-like UA.
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`PSX ${ticker}: HTTP ${res.status}`);

  const json = (await res.json()) as {
    status?: number;
    data?: [number, number, number, number][];
  };
  if (json.status !== 1 || !Array.isArray(json.data)) {
    throw new Error(`PSX ${ticker}: unexpected payload`);
  }

  return json.data
    .map((r) => ({ t: r[0] * 1000, close: r[1] }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.t - b.t); // ascending by date
}

/**
 * Shares outstanding, scraped from the company page's Equity Profile:
 *   <div class="stats_label">Shares</div><div class="stats_value">1,800,554,652</div>
 *
 * The EOD feed carries no share count, and PSX exposes no JSON endpoint for it.
 * The page also prints its own "Market Cap", but we derive ours from this and
 * the latest close so it stays consistent with the Price column.
 */
async function fetchShares(ticker: string): Promise<number | null> {
  const res = await fetch(COMPANY_URL(ticker), {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    next: { revalidate: 86_400 }, // share counts move far more slowly than prices
  });
  if (!res.ok) throw new Error(`PSX ${ticker}: company HTTP ${res.status}`);

  const html = await res.text();
  const match = html.match(
    /stats_label">Shares<\/div>\s*<div class="stats_value">([\d,]+)</i,
  );
  if (!match) return null;

  const shares = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(shares) && shares > 0 ? shares : null;
}

/**
 * Close on or before `target`. If we have no data that far back but the
 * earliest point is within `tolDays` of the target, fall back to it — this
 * recovers e.g. a 5Y figure when history is a few days shy of a full 5 years.
 */
function priceAsOf(points: Point[], target: number, tolDays = 7): number | null {
  let base: number | null = null;
  for (const p of points) {
    if (p.t <= target) base = p.close;
    else break;
  }
  if (base === null && points.length > 0 && points[0].t - target <= tolDays * DAY) {
    base = points[0].close;
  }
  return base;
}

function pct(latest: number, base: number | null): number | null {
  if (base === null || base <= 0) return null;
  return Math.round((latest / base - 1) * 1000) / 10; // 1 decimal place
}

function computePerformance(points: Point[]): Performance {
  if (points.length === 0) return EMPTY_PERF;

  const last = points[points.length - 1];
  const now = last.t;
  const latest = last.close;
  const jan1 = Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  const prevClose = points.length >= 2 ? points[points.length - 2].close : null;

  return {
    d1: pct(latest, prevClose),
    m1: pct(latest, priceAsOf(points, now - 30 * DAY)),
    m6: pct(latest, priceAsOf(points, now - 182 * DAY)),
    ytd: pct(latest, priceAsOf(points, jan1)),
    y5: pct(latest, priceAsOf(points, now - Math.round(5 * 365.25) * DAY, 10)),
  };
}

async function buildStock({
  ticker,
  sector,
}: {
  ticker: string;
  sector: Sector;
}): Promise<Stock> {
  let perf = EMPTY_PERF;
  let price: number | null = null;
  let shares: number | null = null;

  // Settled, not all-or-nothing: a company page that fails to parse shouldn't
  // cost us the prices, and vice versa.
  const [eod, equity] = await Promise.allSettled([
    fetchEod(ticker),
    fetchShares(ticker),
  ]);

  if (eod.status === "fulfilled") {
    const points = eod.value;
    perf = computePerformance(points);
    price = points.length > 0 ? points[points.length - 1].close : null;
  }
  if (equity.status === "fulfilled") shares = equity.value;

  return {
    ticker,
    sector,
    isShariah: isShariahSymbol(ticker),
    price,
    marketCap: price !== null && shares !== null ? price * shares : null,
    perf,
  };
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/** Every ticker with live performance, fetched concurrently. */
export function fetchAllStocks(): Promise<Stock[]> {
  return mapPool(TICKERS, 8, buildStock);
}
