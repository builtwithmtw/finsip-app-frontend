"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchMomentum, queryKeys } from "@/lib/queries";
import type { MomentumIndex } from "@/types";

interface UseMomentum {
  index: MomentumIndex | null;
  loading: boolean;
  error: string | null;
  /** Go upstream now, past the route's day cache. */
  rescrape: () => Promise<void>;
  rescraping: boolean;
}

/**
 * The JS Momentum Factor Index, scraped through our own route.
 *
 * Reads the cache the boot gate warmed, so the tab opens with its table already
 * drawn -- and the route holds its scrape for the calendar day, so even a cold
 * cache costs JS Investments' page one request rather than one per visit.
 *
 * `rescrape` writes the fresh snapshot straight into the cache instead of
 * invalidating: an invalidation would refetch and put a populated table back
 * into a loading state, which is exactly what the rest of this app avoids.
 */
export function useMomentum(): UseMomentum {
  const queryClient = useQueryClient();
  const [rescraping, setRescraping] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.momentum,
    queryFn: () => fetchMomentum(),
  });

  useEffect(() => {
    if (error) toast.error("Could not read the momentum index: " + error.message);
  }, [error]);

  const rescrape = useCallback(async () => {
    setRescraping(true);
    try {
      const fresh = await fetchMomentum(true);
      queryClient.setQueryData(queryKeys.momentum, fresh);
      toast.success(`Momentum index updated — ${fresh.constituents.length} stocks`);
    } catch (err) {
      // The old snapshot stays in the cache: a monthly index's last known
      // weights beat an empty table.
      toast.error(
        "Rescrape failed: " + (err instanceof Error ? err.message : "unknown error"),
      );
    } finally {
      setRescraping(false);
    }
  }, [queryClient]);

  return {
    index: data ?? null,
    loading: isPending,
    error: error ? error.message : null,
    rescrape,
    rescraping,
  };
}
