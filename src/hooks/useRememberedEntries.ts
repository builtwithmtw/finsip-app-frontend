"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchRememberedEntries, queryKeys } from "@/lib/queries";
import type { RememberedEntries } from "@/types";
import { toast } from "sonner";

export type { RememberedEntries };

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
 *
 * The read is the boot gate's, not this hook's: the Monthly Entry tab mounts
 * against a cache that already holds the snapshot.
 */
export function useRememberedEntries(): UseRememberedEntries {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const userId = user?.id;

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.rememberedEntries(userId ?? "anonymous"),
    queryFn: () => fetchRememberedEntries(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (error) {
      toast.error("Could not load remembered entries: " + error.message);
    }
  }, [error]);

  const save = useCallback(
    async (entries: RememberedEntries): Promise<boolean> => {
      if (!userId) return false;

      setSaving(true);
      const { error: saveError } = await supabase
        .from("remembered_entries")
        .upsert(
          { user_id: userId, entries, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      setSaving(false);

      if (saveError) {
        toast.error("Could not save remembered entries: " + saveError.message);
        return false;
      }

      queryClient.setQueryData(queryKeys.rememberedEntries(userId), entries);
      return true;
    },
    [userId, queryClient],
  );

  return {
    remembered: data ?? {},
    loading: Boolean(userId) && isPending,
    saving,
    save,
  };
}
