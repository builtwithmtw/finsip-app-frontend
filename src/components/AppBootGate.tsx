"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { usePortfolio } from "../context/PortfolioContext";
import { useProxy } from "../context/ProxyContext";
import { useSettings } from "../context/SettingsContext";
import { fetchStocks } from "../lib/api";
import { isAdmin } from "../lib/admins";
import {
    fetchIndexCompanies,
    fetchPeers,
    fetchRememberedEntries,
    fetchWatchlist,
    queryKeys,
} from "../lib/queries";
import BootLoader, { type BootStep } from "./BootLoader";

/**
 * How long the loader is allowed to hold the app before we give up waiting and
 * let the user in anyway.
 *
 * Every source behind the gate is a third-party feed reached through a public
 * CORS gateway; any of them can be slow or simply down. A gate with no ceiling
 * would turn one dead feed into an app that never opens, so past this point the
 * shell renders and whatever landed is what the tabs draw. Comfortably longer
 * than the 10-15s timeouts on the individual fetches, so this only fires when
 * something is stuck rather than merely slow.
 */
const BOOT_TIMEOUT_MS = 20_000;

/**
 * Holds the signed-in app behind one full-screen load until every request it
 * needs has come back.
 *
 * The app used to fetch per tab: Watchlist read Supabase on mount, Allocation
 * pulled its index feeds on mount, Monthly Entry loaded its remembered
 * quantities on mount, and each one showed a skeleton while it did -- every
 * time the tab was opened, because the views unmount on navigation. This gate
 * moves all of it in front of Overview and warms the react-query cache, which is
 * configured never to refetch on its own (see `app/providers.tsx`). After the
 * gate opens, switching tabs is a cache read and the data is simply there.
 *
 * What it waits on:
 *  - the Supabase session
 *  - the user's display preferences, which the nav bar draws its figures by
 *  - the CORS gateway list, since three of the fetches below route through it
 *  - stocks / transactions / realized P&L (PortfolioContext fetches these itself)
 *  - the first live-price sweep
 *  - /api/stocks, the watchlist, remembered entries, and the index feeds
 *
 * It does not gate the public pages -- it sits inside ProtectedRoute, so "/" and
 * /screener never reach it.
 */
const AppBootGate: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const { proxiesSettled, selectedProxy } = useProxy();
    const { settingsLoaded } = useSettings();
    const {
        stocksLoading,
        transactionsLoading,
        realizedLoading,
        marketLoading,
    } = usePortfolio();
    const queryClient = useQueryClient();

    const userId = user?.id ?? null;
    // Peers is an admin-only tab, and its two RPCs would only come back as an
    // error for anyone else -- so it is warmed for the accounts that have it and
    // for no one else.
    const admin = isAdmin(user?.email);

    const [prefetchDone, setPrefetchDone] = useState(false);
    const [timedOut, setTimedOut] = useState(false);

    /**
     * The user whose boot has completed. Latching on the id rather than a bare
     * boolean is what keeps the loader from coming back: `refreshData()` and the
     * 30-second price sweep both flip the flags below to "loading" again, and a
     * gate that only read the current flags would throw the user back to a
     * full-screen loader mid-session. Signing into a different account is the one
     * thing that legitimately re-gates.
     */
    const [bootedFor, setBootedFor] = useState<string | null>(null);
    const prefetchedFor = useRef<string | null>(null);

    // PortfolioContext fetches its own three tables and the live feed; these are
    // the queries nothing else would ask for until the user opened the tab that
    // needs them.
    useEffect(() => {
        if (!userId || !proxiesSettled) return;
        if (prefetchedFor.current === userId) return;

        prefetchedFor.current = userId;
        setPrefetchDone(false);

        const proxyUrl = selectedProxy.url;

        const warm = [
            queryClient.prefetchQuery({
                queryKey: queryKeys.stocks,
                queryFn: fetchStocks,
            }),
            queryClient.prefetchQuery({
                queryKey: queryKeys.watchlist(userId),
                queryFn: () => fetchWatchlist(userId),
            }),
            queryClient.prefetchQuery({
                queryKey: queryKeys.rememberedEntries(userId),
                queryFn: () => fetchRememberedEntries(userId),
            }),
        ];

        if (admin) {
            warm.push(
                queryClient.prefetchQuery({
                    queryKey: queryKeys.peers(userId),
                    queryFn: fetchPeers,
                }),
            );
        }

        // The index feeds all go through the gateway. With none resolved there is
        // nothing to route through, and the Allocation tab will offer its own
        // Retry rather than the gate hanging on a request it cannot make.
        if (proxyUrl) {
            const proxyId = selectedProxy.id;
            warm.push(
                queryClient.prefetchQuery({
                    queryKey: queryKeys.indexCompanies("KMI30", proxyId),
                    queryFn: () => fetchIndexCompanies("KMI30", proxyUrl),
                }),
                queryClient.prefetchQuery({
                    queryKey: queryKeys.indexCompanies("KSE30", proxyId),
                    queryFn: () => fetchIndexCompanies("KSE30", proxyUrl),
                }),
                queryClient.prefetchQuery({
                    queryKey: queryKeys.indexCompanies("ALLSHR", proxyId),
                    queryFn: () => fetchIndexCompanies("ALLSHR", proxyUrl),
                }),
            );
        }

        // allSettled: one feed being down must not strand the gate. prefetchQuery
        // already absorbs rejections, but this does not depend on that.
        Promise.allSettled(warm).then(() => setPrefetchDone(true));
    }, [userId, admin, proxiesSettled, selectedProxy.url, selectedProxy.id, queryClient]);

    // Losing the user returns the gate to its starting state, so whoever signs in
    // next loads from scratch rather than inheriting the last session's progress.
    // Emptying the cache on that transition is `QueryCacheReset`'s job, not this
    // one's -- on sign-out ProtectedRoute unmounts this component before an
    // effect here could run.
    useEffect(() => {
        if (userId) return;
        prefetchedFor.current = null;
        setPrefetchDone(false);
        setBootedFor(null);
        setTimedOut(false);
    }, [userId]);

    useEffect(() => {
        if (!userId || bootedFor === userId) return;
        const id = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
        return () => clearTimeout(id);
    }, [userId, bootedFor]);

    /**
     * With a gateway list that came back empty there is no feed to wait for, and
     * `marketLoading` stays true forever because the fetch never runs. Treat that
     * as settled rather than burning the full timeout on it.
     */
    const marketReady = !marketLoading || (proxiesSettled && !selectedProxy.url);

    const steps: BootStep[] = [
        { label: "Session", done: !authLoading && Boolean(user) },
        // Ahead of the shell rather than beside it: the nav bar's figures are drawn
        // by `compactNavAmounts`, so letting it render first would have Worth switch
        // format a tick after the app opened.
        { label: "Preferences", done: settingsLoaded },
        { label: "Gateway", done: proxiesSettled },
        {
            label: "Holdings",
            done: !stocksLoading && !transactionsLoading && !realizedLoading,
        },
        { label: "Live prices", done: marketReady },
        { label: "Market data", done: prefetchDone },
    ];

    const ready = steps.every((s) => s.done);

    useEffect(() => {
        if (!userId || bootedFor === userId) return;
        if (ready || timedOut) setBootedFor(userId);
    }, [userId, bootedFor, ready, timedOut]);

    if (!userId || bootedFor !== userId) {
        return <BootLoader steps={steps} />;
    }

    return <>{children}</>;
};

export default AppBootGate;
