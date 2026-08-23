"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/admins";
import { fetchPeers, queryKeys } from "@/lib/queries";
import type { Peer } from "@/types";

interface UsePeers {
  peers: Peer[];
  loading: boolean;
  error: string | null;
}

/**
 * The other accounts on the app, for the admin-only Peers tab.
 *
 * Reads the cache the boot gate warmed (it prefetches this only for an admin
 * session), so opening the tab issues no request. The `enabled` guard is the
 * same condition the gate used -- without it an ordinary user who reached
 * /peers by typing the URL would fire an RPC that can only come back as an
 * error. The authorisation itself is the function's, not this flag's.
 */
export function usePeers(): UsePeers {
  const { user } = useAuth();
  const admin = isAdmin(user?.email);

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.peers(user?.id ?? "anonymous"),
    queryFn: fetchPeers,
    enabled: Boolean(user?.id) && admin,
  });

  useEffect(() => {
    if (error) toast.error("Could not load peers: " + error.message);
  }, [error]);

  return {
    peers: data ?? [],
    loading: admin && isPending,
    error: error ? error.message : null,
  };
}
