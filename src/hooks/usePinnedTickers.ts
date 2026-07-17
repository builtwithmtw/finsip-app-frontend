"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "psx-screener:pinned";

/**
 * Tickers the user has starred, persisted across sessions.
 *
 * Starts empty on the server and on first paint, then hydrates from
 * localStorage in an effect — reading storage during render would produce
 * markup that doesn't match the server's.
 */
export function usePinnedTickers() {
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setPinned(
          new Set(parsed.filter((t): t is string => typeof t === "string")),
        );
      }
    } catch {
      // Corrupt or unavailable storage — start with no pins.
    }
    setHydrated(true);
  }, []);

  // Persist as an effect, not inside the updater: React may call a state
  // updater more than once, and it must stay side-effect free. Skipped until
  // hydration so the initial empty set can't overwrite saved pins.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned]));
    } catch {
      // Storage full or blocked — keep the in-memory pins anyway.
    }
  }, [pinned, hydrated]);

  const togglePin = useCallback((ticker: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (!next.delete(ticker)) next.add(ticker);
      return next;
    });
  }, []);

  return { pinned, togglePin };
}
