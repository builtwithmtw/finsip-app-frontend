"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * One cache for the whole signed-in app, deliberately configured to never
 * refetch on its own.
 *
 * The boot gate fills every query before the app shell is shown (see
 * `components/AppBootGate.tsx`), and from then on a tab switch is a cache read.
 * Anything that re-fetched in the background -- on mount, on focus, on reconnect,
 * or because a staleTime elapsed -- would put a tab back into a loading state
 * some time after the user had already been shown its data, which is the exact
 * thing the gate exists to prevent. Refreshes are explicit instead: the nav bar's
 * refresh control, a Retry button, or a mutation writing to the cache.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: Infinity,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
