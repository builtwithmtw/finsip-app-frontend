"use client";

import { useMemo } from "react";
import { useStocks } from "./useStocks";
import { isShariahSymbol } from "@/lib/shariah";

/**
 * One answer to "is this symbol Shariah-compliant", shared by everything that
 * asks.
 *
 * It reads the same `/api/stocks` response the screener draws its 🕌 badges
 * from, so the two can't disagree: server-side that flag is live KMIALLSHR index
 * membership (see `lib/sarmaaya.ts`), and this hook rides its react-query cache
 * rather than issuing a second request.
 *
 * Two things fall back to the checked-in snapshot in `lib/shariah.ts`: a symbol
 * outside the screener's seed universe (which the route never reports on either
 * way), and a route that failed. Both are cases where the live source has no
 * opinion, and a stale answer beats silently marking everything non-compliant.
 */
export function useShariah() {
  const { data, isLoading } = useStocks();

  const live = useMemo(() => {
    if (!data) return null;
    const known = new Set<string>();
    const compliant = new Set<string>();
    data.forEach((stock) => {
      const key = stock.ticker.toUpperCase();
      known.add(key);
      if (stock.isShariah) compliant.add(key);
    });
    return { known, compliant };
  }, [data]);

  return useMemo(
    () => ({
      /** True once the live membership list is in hand. */
      isLive: live !== null,
      loading: isLoading,
      isShariah: (symbol: string) => {
        const key = symbol.toUpperCase();
        return live?.known.has(key)
          ? live.compliant.has(key)
          : isShariahSymbol(key);
      },
    }),
    [live, isLoading],
  );
}
