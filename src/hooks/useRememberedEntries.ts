"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/** A saved set of per-symbol quantities the user can recall into a fresh month. */
export type RememberedEntries = Record<string, { shares: string; type: "buy" | "sell" }>;

interface UseRememberedEntries {
  remembered: RememberedEntries;
  loading: boolean;
  saving: boolean;
  /** Replace the saved snapshot with `entries`. Resolves true on success. */
  save: (entries: RememberedEntries) => Promise<boolean>;
}

/**
 * The user's single remembered-quantities snapshot, backed by the
 * `remembered_entries` Supabase table (see supabase/add_remembered_entries.sql).
 * One row per user, stored as jsonb, so recall is one read and remember is one
 * upsert.
 */
export function useRememberedEntries(): UseRememberedEntries {
  const { user } = useAuth();
  const [remembered, setRemembered] = useState<RememberedEntries>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setRemembered({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("remembered_entries")
        .select("entries")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        toast.error("Could not load remembered entries: " + error.message);
      } else {
        setRemembered((data?.entries as RememberedEntries) ?? {});
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(
    async (entries: RememberedEntries): Promise<boolean> => {
      if (!user) return false;

      setSaving(true);
      const { error } = await supabase
        .from("remembered_entries")
        .upsert(
          { user_id: user.id, entries, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      setSaving(false);

      if (error) {
        toast.error("Could not save remembered entries: " + error.message);
        return false;
      }

      setRemembered(entries);
      return true;
    },
    [user],
  );

  return { remembered, loading, saving, save };
}
