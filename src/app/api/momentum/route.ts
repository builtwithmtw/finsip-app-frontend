import { NextResponse } from "next/server";
import { fetchMomentumIndex } from "@/lib/momentum";
import type { MomentumIndex } from "@/types";

// Scraped per request rather than prerendered, for the same reason /api/stocks
// is: a build-time snapshot would freeze whatever the page served during the
// deploy. The day cache below is what keeps that from meaning a scrape per view.
export const dynamic = "force-dynamic";

/**
 * The scrape is held for the calendar day, in Pakistan time.
 *
 * JSMFI is rebalanced monthly, so a day is already far more often than the
 * figures can change -- and the point of the cache is that opening the tab
 * doesn't hit someone else's website. The day is read in Asia/Karachi rather
 * than UTC so "today" means the same thing here as it does on the exchange the
 * index tracks.
 *
 * Module memory, so this is per server instance: a cold start or a second
 * instance will scrape again. It is a courtesy cache, not a quota -- the
 * Cache-Control below puts the CDN in front of it for the shared case.
 */
let cached: { day: string; data: MomentumIndex } | null = null;

const karachiDay = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

// Held for an hour at the edge, and served stale for a day while it revalidates
// underneath -- so a scrape that fails never leaves the tab with nothing.
const FRESH = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: Request) {
  // `?refresh=1` is the Rescrape button. It bypasses our own day cache and asks
  // the CDN not to answer from its copy either, or the button would appear to
  // work while changing nothing.
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const today = karachiDay();

  if (!refresh && cached?.day === today) {
    const res = NextResponse.json(cached.data);
    res.headers.set("Cache-Control", FRESH);
    res.headers.set("X-Momentum-Cache", "hit");
    return res;
  }

  try {
    const data = await fetchMomentumIndex();
    cached = { day: today, data };

    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", refresh ? "no-store" : FRESH);
    res.headers.set("X-Momentum-Cache", "miss");
    return res;
  } catch (err) {
    console.error("Failed to scrape the JS Momentum Factor Index", err);

    // A failed rescrape must not throw away a good snapshot: yesterday's weights
    // on a monthly index are still the right answer, and an empty table would
    // read as "the index has no constituents".
    if (cached) {
      const res = NextResponse.json(cached.data);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("X-Momentum-Cache", "stale");
      return res;
    }

    return NextResponse.json(
      { error: "Could not read the JS Momentum Factor Index" },
      { status: 502 },
    );
  }
}
