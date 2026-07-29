"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchWatchlist, queryKeys } from "@/lib/queries";
import type { WatchlistItem } from "@/types";
import { toast } from "sonner";

interface UseWatchlist {
  items: WatchlistItem[];
  loading: boolean;
  /** True while an add is in flight, so the modal can disable its button. */
  adding: boolean;
  addItem: (symbol: string, sector: string | null) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
}

/**
 * The signed-in user's watchlist, backed by the `watchlist` Supabase table
 * (see supabase/add_watchlist.sql).
 *
 * Reads the react-query cache the boot gate filled, so opening the Watchlist tab
 * issues no request -- it used to fetch on mount, which meant a round trip and a
 * skeleton every time the tab was revisited. Adds and removes write straight into
 * that cache, so the table updates without one either.
 */
export function useWatchlist(): UseWatchlist {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const userId = user?.id;

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.watchlist(userId ?? "anonymous"),
    queryFn: () => fetchWatchlist(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (error) toast.error("Could not load your watchlist: " + error.message);
  }, [error]);

  const items = data ?? [];

  const write = useCallback(
    (next: WatchlistItem[]) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.watchlist(userId), next);
    },
    [queryClient, userId],
  );

  const addItem = useCallback(
    async (symbol: string, sector: string | null): Promise<boolean> => {
      if (!user) return false;
      const clean = symbol.trim().toUpperCase();
      if (!clean) return false;

      if (items.some((i) => i.symbol === clean)) {
        toast.error(`${clean} is already on your watchlist.`);
        return false;
      }

      setAdding(true);
      const { data: inserted, error: insertError } = await supabase
        .from("watchlist")
        .insert([{ symbol: clean, sector, user_id: user.id }])
        .select()
        .single();
      setAdding(false);

      if (insertError) {
        // The unique (user_id, symbol) constraint is the backstop for a race the
        // in-memory check above can't catch.
        toast.error("Could not add to watchlist: " + insertError.message);
        return false;
      }

      write([
        ...items,
        {
          id: inserted.id,
          symbol: inserted.symbol,
          sector: inserted.sector,
          createdAt: inserted.created_at,
        },
      ]);
      toast.success(`${clean} added to watchlist.`);
      return true;
    },
    [user, items, write],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user) return;

      // Optimistic: drop it now, put it back if the delete is rejected.
      const previous = items;
      write(items.filter((i) => i.id !== id));

      const { error: deleteError } = await supabase
        .from("watchlist")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        write(previous);
        toast.error("Could not remove from watchlist: " + deleteError.message);
      }
    },
    [user, items, write],
  );

  return {
    items,
    // A disabled query reports `isPending` forever, which would pin a signed-out
    // reader on the skeleton; only a real in-flight fetch counts as loading.
    loading: Boolean(userId) && isPending,
    adding,
    addItem,
    removeItem,
  };
}
