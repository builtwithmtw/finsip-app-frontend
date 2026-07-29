"use client";

import { useQuery } from "@tanstack/react-query";
import { useProxy } from "../context/ProxyContext";
import { fetchIndexCompanies, queryKeys, type MarketIndex } from "@/lib/queries";
import type { IndexCompany } from "../types";

export type { MarketIndex };

/**
 * Companies of a PSX index, with their index weight and last price.
 *
 * Both feeds (KMI30 and ALLSHR) are pulled by the boot gate, so the Allocation
 * tab and its sub-tabs render from cache: no fetch on mount, no five-minute TTL
 * that could expire mid-session and drop the user back onto a skeleton. The
 * cache is held for the whole session and only refilled when `refetch` is called
 * -- the Retry button on the error state, or a gateway change.
 */
export function useIndexCompanies(index: MarketIndex) {
  const { selectedProxy } = useProxy();

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.indexCompanies(index, selectedProxy.id),
    queryFn: () => fetchIndexCompanies(index, selectedProxy.url),
    // The gateway list loads from Supabase; until it arrives there is nothing to
    // fetch through, and a request fired at an empty prefix would resolve against
    // our own origin and 404.
    enabled: Boolean(selectedProxy.url),
  });

  const companies: IndexCompany[] = data ?? [];

  return {
    companies,
    loading: isFetching && companies.length === 0,
    error: error as Error | null,
    refetch: () => refetch(),
  };
}
