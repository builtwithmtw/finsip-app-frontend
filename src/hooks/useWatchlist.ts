"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
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

const mapRow = (r: {
  id: string;
  symbol: string;
  sector: string | null;
  created_at: string;
}): WatchlistItem => ({
  id: r.id,
  symbol: r.symbol,
  sector: r.sector,
  createdAt: r.created_at,
});

/**
 * The signed-in user's watchlist, backed by the `watchlist` Supabase table
 * (see supabase/add_watchlist.sql). Self-contained: it fetches on mount and
 * keeps the local list in sync with each add/remove so the table updates
 * without a round trip.
 */
export function useWatchlist(): UseWatchlist {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Could not load your watchlist: " + error.message);
    } else {
      setItems((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
      const { data, error } = await supabase
        .from("watchlist")
        .insert([{ symbol: clean, sector, user_id: user.id }])
        .select()
        .single();
      setAdding(false);

      if (error) {
        // The unique (user_id, symbol) constraint is the backstop for a race the
        // in-memory check above can't catch.
        toast.error("Could not add to watchlist: " + error.message);
        return false;
      }

      setItems((prev) => [...prev, mapRow(data)]);
      toast.success(`${clean} added to watchlist.`);
      return true;
    },
    [user, items],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user) return;

      // Optimistic: drop it now, put it back if the delete is rejected.
      const previous = items;
      setItems((prev) => prev.filter((i) => i.id !== id));

      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        setItems(previous);
        toast.error("Could not remove from watchlist: " + error.message);
      }
    },
    [user, items],
  );

  return { items, loading, adding, addItem, removeItem };
}
