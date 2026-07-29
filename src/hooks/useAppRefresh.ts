"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePortfolio } from "@/context/PortfolioContext";
import { useProxy } from "@/context/ProxyContext";

/**
 * Re-pulls every source the app reads, in place.
 *
 * This is the counterpart to the boot gate: because nothing refetches on its own
 * any more -- no staleTime expiry, no refetch on mount or focus (see
 * `app/providers.tsx`) -- there has to be one deliberate way to say "get me
 * current numbers", and it has to cover all of it, not just the live feed.
 *
 * Nothing here raises a loading flag or empties a table. Supabase reads go
 * through the silent path, and react-query serves the previous result while it
 * refetches, so the tab the user is on keeps its numbers until new ones land and
 * then swaps them. The spinning icon is the only thing that says it's working.
 */
export function useAppRefresh() {
    const { refreshData } = usePortfolio();
    const { retryFetch } = useProxy();
    const queryClient = useQueryClient();

    const [refreshing, setRefreshing] = useState(false);

    const refreshAll = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);

        try {
            await Promise.allSettled([
                // stocks / transactions / realized P&L
                refreshData(),
                // Everything in the query cache: /api/stocks, the watchlist,
                // remembered entries, and both index feeds. No filter, because
                // the tabs the user isn't on are exactly the ones that would
                // otherwise still be serving this morning's numbers when they
                // get there.
                queryClient.refetchQueries(),
            ]);
        } finally {
            setRefreshing(false);
        }

        // Live prices, kicked off last and not awaited: it is the one source
        // that refreshes itself every 30 seconds anyway, and it resolves through
        // context state rather than a promise this could wait on.
        retryFetch();
    }, [refreshing, refreshData, queryClient, retryFetch]);

    return { refreshAll, refreshing };
}
