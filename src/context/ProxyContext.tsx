"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

/** A CORS gateway the browser routes its market requests through. */
export interface Proxy {
    id: string;
    name: string;
    url: string;
}

/**
 * Stands in until the `proxies` read comes back, and stays put if it comes back empty.
 *
 * An empty `url` is already the app's signal for "no feed available" -- the boot gate
 * reads it that way, and both `PortfolioContext` and `useIndexCompanies` refuse to fetch
 * on it -- so there is no separate placeholder state to carry.
 */
const NO_PROXY: Proxy = { id: 'none', name: 'None', url: '' };

interface ProxyContextType {
    /**
     * The gateway every browser-side market request goes through.
     *
     * Chosen for the user rather than by them: the list is administered in Supabase, and
     * the picker that once let a user add their own or switch between them had been
     * hidden from the nav bar long before it was taken out.
     */
    selectedProxy: Proxy;
    /**
     * True once we know which gateway to route market requests through -- or that there
     * isn't one. The boot gate waits for this before pulling anything that goes through
     * a proxy, and treats an empty `selectedProxy.url` at that point as "no feed
     * available" rather than something still on its way.
     */
    proxiesSettled: boolean;
    /** Re-runs the live price sweep. Registered by `PortfolioContext`, which owns it. */
    retryFetch: () => void;
    setRetryFetch: (fn: () => void) => void;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

export const ProxyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedProxy, setSelectedProxy] = useState<Proxy>(NO_PROXY);
    const [proxiesSettled, setProxiesSettled] = useState(false);
    const [retryFetchFn, setRetryFetchFn] = useState<() => void>(() => () => { });

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const { data, error } = await supabase.from('proxies').select('id, name, url');
                if (error) throw error;
                if (cancelled) return;

                // The first row, which is what the selection resolved to anyway once the
                // saved choice was gone. Deliberately no ORDER BY: adding one now would
                // quietly move every browser onto a different gateway than the one it
                // has been running on.
                const first = data?.[0];
                if (first) setSelectedProxy({ id: first.id, name: first.name, url: first.url });
            } catch (err) {
                console.error('Failed to fetch proxies:', err);
            } finally {
                // Settled either way: a failed read means the app opens without a live
                // feed, and the boot gate must not wait on a request that is never
                // coming back.
                if (!cancelled) setProxiesSettled(true);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const value = useMemo(
        () => ({
            selectedProxy,
            proxiesSettled,
            retryFetch: retryFetchFn,
            setRetryFetch: setRetryFetchFn,
        }),
        [selectedProxy, proxiesSettled, retryFetchFn]
    );

    return <ProxyContext.Provider value={value}>{children}</ProxyContext.Provider>;
};

export const useProxy = () => {
    const context = useContext(ProxyContext);
    if (!context) throw new Error('useProxy must be used within ProxyProvider');
    return context;
};
