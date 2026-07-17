"use client";

import { useMemo, useState } from "react";
import { useStocks } from "@/hooks/useStocks";
import { usePinnedTickers } from "@/hooks/usePinnedTickers";
import { BLUECHIP_MIN_MARKET_CAP, type Filters } from "@/lib/types";
import { Header } from "./Header";
import { FilterSidebar } from "./FilterSidebar";
import { StockTable } from "./StockTable";

const INITIAL_FILTERS: Filters = {
  shariahOnly: true,
  pinnedFirst: true,
  bluechipOnly: false,
  sectors: [],
};

export function Screener() {
  const { data, isLoading, isError, refetch } = useStocks();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const { pinned, togglePin } = usePinnedTickers();

  const filtered = useMemo(() => {
    const stocks = data ?? [];
    return stocks.filter((s) => {
      if (filters.shariahOnly && !s.isShariah) return false;
      // Unknown market cap can't clear the bar, so it fails the filter.
      if (
        filters.bluechipOnly &&
        (s.marketCap === null || s.marketCap < BLUECHIP_MIN_MARKET_CAP)
      )
        return false;
      if (filters.sectors.length > 0 && !filters.sectors.includes(s.sector))
        return false;
      return true;
    });
  }, [data, filters]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <Header />

      <div className="scrollbar-thin mx-auto flex w-full max-w-350 min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:overflow-hidden">
        {isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
            <p className="mb-3 text-destructive">Failed to load stocks.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch">
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              pinnedCount={pinned.size}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <StockTable
                data={filtered}
                isLoading={isLoading}
                showShariahBadge={!filters.shariahOnly}
                pinned={pinned}
                pinnedFirst={filters.pinnedFirst}
                onTogglePin={togglePin}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
