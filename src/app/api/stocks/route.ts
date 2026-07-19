import { NextResponse } from "next/server";
import { fetchAllStocks } from "@/lib/sarmaaya";

// Rendered per request, not prerendered at build. `export const revalidate` made
// this a build-time snapshot: whatever the portal happened to serve while the
// build ran got frozen into the deploy, so a ticker the portal rate-limited
// during that one minute stayed blank on Netlify for an hour at a time while the
// same ticker was fine from a laptop. Caching still happens -- but below, per
// response, where it can look at how the fetch actually went.
export const dynamic = "force-dynamic";

// The feed is end-of-day, so a full result is good for a long time; the CDN
// serves it and revalidates underneath.
const FULL = "public, s-maxage=3600, stale-while-revalidate=86400";

// A partial result renders blank rows. Cache it briefly so it heals on the next
// request instead of being pinned for an hour, but not so briefly that a portal
// having a bad minute turns into a retry storm.
const DEGRADED = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
  try {
    const { stocks, missing } = await fetchAllStocks();

    if (missing.length > 0) {
      console.warn(`No feed row for ${missing.length} ticker(s):`, missing);
    }

    const res = NextResponse.json(stocks);
    res.headers.set("Cache-Control", missing.length > 0 ? DEGRADED : FULL);
    return res;
  } catch (err) {
    console.error("Failed to load PSX stocks", err);
    return NextResponse.json(
      { error: "Failed to load PSX data" },
      { status: 502 },
    );
  }
}
