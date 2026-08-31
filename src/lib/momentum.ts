// Server-only: the JS Momentum Factor Index constituents, scraped from JS
// Investments' ETF page.
//
// There is no feed for this one. Unlike KMI 30 and KSE 30 -- which come off the
// Sarmaaya REST API as JSON -- JSMFI is published only as a table on a WordPress
// page, so the weights have to be read out of the markup. It is rebalanced
// monthly, which is why once a day is more than often enough (see the route).
//
// Parsed with regex rather than a DOM library: this is one table on one page,
// and the alternative was a parser dependency in the bundle for a single
// screen. The trade is that markup changes break it -- so it anchors on the
// heading text rather than on the table's id, falls back to finding any table
// whose header row reads Stock/Weight, and throws loudly rather than returning
// an empty index that would render as a page with no rows and no explanation.

import type { MomentumIndex } from "@/types";

const SOURCE_URL = "https://jsil.com/js-exchange-traded-fund/";

const REQUEST_TIMEOUT_MS = 15_000;

// WordPress serves the page differently to a client it doesn't recognise, and a
// bare fetch UA gets a challenge rather than the table.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

const cellsOf = (row: string): string[] =>
  [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    stripTags(m[1]),
  );

const rowsOf = (table: string): string[][] =>
  [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((m) => cellsOf(m[1]))
    .filter((cells) => cells.length >= 2);

/**
 * "18.7%" -> 18.7, and "9,6%" -> 9.6.
 *
 * The page is not consistent about its decimal separator -- at the time of
 * writing every row uses a dot except HBL, which uses a comma -- so a parser
 * that only stripped non-digits read that row as 96 and, once the weights were
 * normalised, handed one position most of the money. A comma is never a
 * thousands separator here: these are percentages of an index and cannot reach
 * four digits.
 */
const parseWeight = (raw: string): number => {
    const cleaned = String(raw).replace(/[^\d.,]/g, "");
    // Both present is a thousands-grouped figure that doesn't belong in this
    // table at all; take the dot as the decimal point and let the range check
    // below throw it out.
    const normalized = cleaned.includes(".")
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(",", ".");

    return Number(normalized);
};

/** A header row rather than a constituent -- "Stock | Weight". */
const isHeaderRow = (cells: string[]): boolean =>
  /^stock$/i.test(cells[0]) || /^weight$/i.test(cells[1]);

/**
 * The table under the "JS Momentum Factor Index (Month, Year)" heading.
 *
 * The page carries several tables in the same WordPress plugin's markup (Key
 * Facts is another), so picking the first one would read the wrong figures. The
 * heading names the table's id, which is the link between the two.
 */
const findLabelledTable = (html: string): { asOf: string; table: string } | null => {
  const heading = html.match(
    /<h\d[^>]*id="wdt-table-title-(\d+)"[^>]*>\s*JS Momentum Factor Index\s*\(([^)]*)\)\s*<\/h\d>/i,
  );
  if (!heading) return null;

  const table = html.match(
    new RegExp(`<table[^>]*id="wpdtSimpleTable-${heading[1]}"[\\s\\S]*?<\\/table>`, "i"),
  );
  if (!table) return null;

  return { asOf: heading[2].trim(), table: table[0] };
};

/**
 * Any table on the page whose first row reads Stock / Weight.
 *
 * The fallback for the heading having been reworded or the plugin having stopped
 * emitting ids: the shape of the table is the last thing likely to change, since
 * it is what the table is for.
 */
const findTableByShape = (html: string): string | null => {
  for (const match of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/gi)) {
    const rows = rowsOf(match[0]);
    if (rows.length > 1 && isHeaderRow(rows[0])) return match[0];
  }
  return null;
};

/**
 * Reads the current JSMFI constituents off the JS Investments page.
 *
 * Throws on anything it cannot make sense of. A caller that swallowed the error
 * and rendered nothing would be indistinguishable from an index with no
 * constituents, which is never a real answer.
 */
export async function fetchMomentumIndex(): Promise<MomentumIndex> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(SOURCE_URL, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      // Our own day cache decides when to go upstream; Next's fetch cache
      // deciding it separately would make "rescrape" a suggestion.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const labelled = findLabelledTable(html);
  const table = labelled?.table ?? findTableByShape(html);
  if (!table) throw new Error("Momentum index table not found on the page");

  const constituents = rowsOf(table)
    .filter((cells) => !isHeaderRow(cells))
    .map(([symbol, weight]) => ({
      symbol: symbol.toUpperCase().replace(/[^A-Z0-9.]/g, ""),
      weight: parseWeight(weight),
    }))
    // A weight that won't parse, or that isn't a possible share of an index, is
    // dropped rather than funded: `useAllocations` normalises across the rows it
    // is given, so one bad figure doesn't just misprice its own line -- it takes
    // money away from every other one.
    .filter(
      (c) =>
        c.symbol.length > 0 &&
        Number.isFinite(c.weight) &&
        c.weight > 0 &&
        c.weight <= 100,
    )
    // Heaviest first, the order every other index feed arrives in and the order
    // `useAllocations` funds down from.
    .sort((a, b) => b.weight - a.weight);

  if (constituents.length === 0) {
    throw new Error("Momentum index table had no readable rows");
  }

  return {
    asOf: labelled?.asOf ?? "",
    constituents,
    scrapedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
  };
}
