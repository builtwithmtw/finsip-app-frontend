import { NextResponse } from "next/server";
import { fetchAllStocks } from "@/lib/psx";

// Cache the assembled response for an hour; underlying PSX fetches are cached
// too. Regenerated at most once per hour, served stale meanwhile.
export const revalidate = 3600;

export async function GET() {
  try {
    const stocks = await fetchAllStocks();
    return NextResponse.json(stocks);
  } catch (err) {
    console.error("Failed to load PSX stocks", err);
    return NextResponse.json(
      { error: "Failed to load PSX data" },
      { status: 502 },
    );
  }
}
