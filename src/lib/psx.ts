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

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;

/** Worth asking again: rate limiting and the portal's own hiccups. */
const RETRIABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with retries.
 *
 * A single miss here is indistinguishable from a ticker having no history:
 * buildStock's allSettled turns it into nulls and the row renders blank. That is
 * survivable from a laptop, but this runs from a datacentre IP against a free
 * portal that rate-limits, and the whole run asks for 260 documents -- so misses
 * are normal, not exceptional, and retrying is what keeps a blip from reading as
 * missing data.
 *
 * Retries bypass the data cache. Next keys the cache on the response, not its
 * status, so a cached 429 would otherwise be replayed to every attempt and leave
 * the retry loop arguing with a cache entry instead of the portal.
 */
async function psxFetch(
  url: string,
  init: RequestInit & { next?: { revalidate: number } },
  label: string,
): Promise<Response> {
  let last: unknown = new Error(`${label}: no attempt made`);

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        url,
        attempt === 0 ? init : { ...init, cache: "no-store", next: undefined },
      );
      if (res.ok) return res;

      last = new Error(`${label}: HTTP ${res.status}`);
      // A 404 will say the same thing however many times we ask.
      if (!RETRIABLE.has(res.status)) break;
    } catch (err) {
      last = err;
    }

    // Exponential, with jitter so 130 tickers don't retry in lockstep and
    // recreate the burst that got us rate-limited in the first place.
    if (attempt < RETRY_ATTEMPTS - 1) {
      await sleep(RETRY_BASE_MS * 2 ** attempt + Math.random() * 100);
    }
  }

  throw last;
}

async function fetchEod(ticker: string): Promise<Point[]> {
  const res = await psxFetch(
    EOD_URL(ticker),
    {
      // The portal rejects requests without a browser-like UA.
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 3600 },
    },
    `PSX ${ticker} eod`,
  );

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
  const res = await psxFetch(
    COMPANY_URL(ticker),
    {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      next: { revalidate: 86_400 }, // share counts move far more slowly than prices
    },
    `PSX ${ticker} company`,
  );

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

const reason = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** A stock, plus whatever the portal refused to tell us about it. */
type Built = { stock: Stock; failures: string[] };

async function buildStock({
  ticker,
  sector,
}: {
  ticker: string;
  sector: Sector;
}): Promise<Built> {
  let perf = EMPTY_PERF;
  let price: number | null = null;
  let shares: number | null = null;
  const failures: string[] = [];

  // Settled, not all-or-nothing: a company page that fails to parse shouldn't
  // cost us the prices, and vice versa. What it must not do is stay quiet -- a
  // swallowed rejection is exactly how a healthy ticker renders as a blank row,
  // so each one is recorded and travels back up to the route.
  const [eod, equity] = await Promise.allSettled([
    fetchEod(ticker),
    fetchShares(ticker),
  ]);

  if (eod.status === "fulfilled") {
    const points = eod.value;
    perf = computePerformance(points);
    price = points.length > 0 ? points[points.length - 1].close : null;
  } else {
    failures.push(reason(eod.reason));
  }

  if (equity.status === "fulfilled") shares = equity.value;
  else failures.push(reason(equity.reason));

  return {
    stock: {
      ticker,
      sector,
      isShariah: isShariahSymbol(ticker),
      price,
      marketCap: price !== null && shares !== null ? price * shares : null,
      perf,
    },
    failures,
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

export type StocksResult = {
  stocks: Stock[];
  /** One entry per document the portal wouldn't give us, ticker named. */
  failures: string[];
};

/**
 * Every ticker with live performance, fetched concurrently.
 *
 * Reports what it couldn't fetch rather than only what it could: a partial run
 * still returns every stock, but the caller needs to know it was partial so it
 * doesn't cache the gaps (see the route's Cache-Control).
 */
export async function fetchAllStocks(): Promise<StocksResult> {
  const built = await mapPool(TICKERS, 8, buildStock);
  const failures = built.flatMap((b) => b.failures);

  if (failures.length > 0) {
    // The deploy log is the only window into which tickers the portal refused;
    // on a blank row this is the difference between "no history" and "we asked
    // and got a 429".
    console.warn(
      `PSX: ${failures.length} of ${TICKERS.length * 2} fetches failed -- ${failures.join("; ")}`,
    );
  }

  return { stocks: built.map((b) => b.stock), failures };
}
