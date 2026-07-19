import type { Metadata } from "next";
import { Providers } from "../providers";
import { Screener } from "@/components/screener/Screener";

export const metadata: Metadata = {
  // The root layout's template appends "| FinSIP".
  title: "Screener",
  description:
    "Screen Pakistan Stock Exchange tickers by Shariah and sector filters.",
  alternates: { canonical: "/screener" },
  openGraph: {
    url: "/screener",
    title: "FinSIP Screener",
    description:
      "Screen Pakistan Stock Exchange tickers by Shariah and sector filters.",
  },
};

/**
 * The public PSX screener. Readable without an account; the header offers the
 * way in. `screener-root` scopes the ported typography -- see globals.css.
 */
export default function ScreenerPage() {
  return (
    <Providers>
      <main className="screener-root flex min-h-0 flex-1 flex-col">
        <Screener />
      </main>
    </Providers>
  );
}
