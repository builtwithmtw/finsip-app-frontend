"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchSipDeposits, queryKeys, type SipDeposit } from "@/lib/queries";
import { toast } from "sonner";

interface UseSipDeposits {
  deposits: SipDeposit[];
  loading: boolean;
  /** True while a write is in flight, so a form can hold its button. */
  saving: boolean;
  addDeposit: (date: string, amount: number, kind?: SipDeposit['kind'], note?: string) => Promise<boolean>;
  /** Amount only. The date and kind are what an entry *is*; the amount is what it says. */
  updateAmount: (id: string, amount: number) => Promise<boolean>;
  removeDeposit: (id: string) => Promise<void>;
}

/**
 * The money the user says they put in, which XIRR is scored on.
 *
 * Writes go straight into the react-query cache rather than invalidating, like the
 * watchlist: the app is configured never to refetch on its own, and an invalidation
 * would drop a populated screen back into a loading state for a row it already has.
 */
export function useSipDeposits(): UseSipDeposits {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const userId = user?.id;

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.sipDeposits(userId ?? "anonymous"),
    queryFn: () => fetchSipDeposits(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (error) toast.error("Could not load your deposits: " + error.message);
  }, [error]);

  const deposits = data ?? [];

  const write = useCallback(
    (next: SipDeposit[]) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.sipDeposits(userId), next);
    },
    [queryClient, userId],
  );

  const addDeposit = useCallback(
    async (
      date: string,
      amount: number,
      kind: SipDeposit['kind'] = 'deposit',
      note?: string,
    ): Promise<boolean> => {
      if (!userId) return false;
      // Zero moves nothing; a reconciliation may legitimately be negative.
      if (!Number.isFinite(amount) || amount === 0) return false;
      if (kind !== 'reconciliation' && amount < 0) return false;

      setSaving(true);
      const { data: inserted, error: insertError } = await supabase
        .from("sip_deposits")
        .insert([{ user_id: userId, deposit_date: date, kind, amount, note: note ?? null }])
        .select()
        .single();
      setSaving(false);

      if (insertError) {
        toast.error("Could not save the deposit: " + insertError.message);
        return false;
      }

      // Re-sorted rather than appended: the list is a cashflow series in date order and
      // a deposit is often entered for a month already past.
      write(
        [
          ...deposits,
          {
            kind,
            id: inserted.id as string,
            date: String(inserted.deposit_date).slice(0, 10),
            amount: Number(inserted.amount) || 0,
            note: (inserted.note as string | null) ?? null,
          },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      );

      return true;
    },
    [userId, deposits, write],
  );

  const updateAmount = useCallback(
    async (id: string, amount: number): Promise<boolean> => {
      if (!userId) return false;

      const existing = deposits.find((d) => d.id === id);
      if (!existing) return false;

      // Same rules the form applies: nothing moves zero, and only a correction may be
      // negative. Checked here too because this is the other door into the same table.
      if (!Number.isFinite(amount) || amount === 0) return false;
      if (existing.kind !== 'reconciliation' && amount < 0) return false;

      // Optimistic, with the old list kept to restore on a rejected write.
      const previous = deposits;
      write(deposits.map((d) => (d.id === id ? { ...d, amount } : d)));

      const { error: updateError } = await supabase
        .from('sip_deposits')
        .update({ amount })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) {
        write(previous);
        toast.error('Could not update the amount: ' + updateError.message);
        return false;
      }

      return true;
    },
    [userId, deposits, write],
  );

  const removeDeposit = useCallback(
    async (id: string) => {
      if (!userId) return;

      // Optimistic, with the old list kept to restore on a rejected delete.
      const previous = deposits;
      write(deposits.filter((d) => d.id !== id));

      const { error: deleteError } = await supabase
        .from("sip_deposits")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        write(previous);
        toast.error("Could not remove the deposit: " + deleteError.message);
      }
    },
    [userId, deposits, write],
  );

  return {
    deposits,
    // A disabled query reports `isPending` forever, which would pin a signed-out reader
    // on a skeleton; only a real in-flight fetch counts as loading.
    loading: Boolean(userId) && isPending,
    saving,
    addDeposit,
    updateAmount,
    removeDeposit,
  };
}
