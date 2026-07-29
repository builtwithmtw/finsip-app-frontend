"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface Proxy {
    id: string;
    name: string;
    url: string;
    isCustom?: boolean;
}

interface ProxyContextType {
    selectedProxy: Proxy;
    proxies: Proxy[];
    /**
     * True once we know which gateway to route market requests through -- or that
     * there isn't one. The boot gate waits for this before pulling anything that
     * goes through a proxy, and treats an empty `selectedProxy.url` at that point
     * as "no feed available" rather than something still on its way.
     */
    proxiesSettled: boolean;
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    selectProxy: (proxy: Proxy) => void;
    addCustomProxy: (name: string, url: string) => void;
    removeProxy: (id: string) => void;
    retryFetch: () => void;
    setRetryFetch: (fn: () => void) => void;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

export const ProxyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Database Proxies (System)
    const [dbProxies, setDbProxies] = useState<Proxy[]>([]);

    // These initializers run during the server render too, where localStorage
    // doesn't exist. Reading through a guarded helper keeps the server pass on
    // the same defaults a first-time visitor gets, and a corrupt entry no longer
    // takes the whole provider down with a parse error.
    const readStored = <T,>(key: string, fallback: T): T => {
        if (typeof window === 'undefined') return fallback;
        try {
            const saved = localStorage.getItem(key);
            return saved ? (JSON.parse(saved) as T) : fallback;
        } catch {
            return fallback;
        }
    };

    // 2. Custom Proxies (Local Storage)
    const [customProxies, setCustomProxies] = useState<Proxy[]>(() =>
        readStored<Proxy[]>('custom_proxies', [])
    );

    // Combined list
    const proxies = [...dbProxies, ...customProxies];

    // 3. Selected Proxy (Local Storage)
    // We defer the "validity check" until we have proxies loaded, but we try to load from LS first.
    const [selectedProxy, setSelectedProxy] = useState<Proxy>(() =>
        // Fallback placeholder until DB loads
        readStored<Proxy>('selected_proxy', { id: 'loading', name: 'Loading...', url: '' })
    );

    const [showModal, setShowModal] = useState(false);
    const [retryFetchFn, setRetryFetchFn] = useState<() => void>(() => () => { });

    // Whether the Supabase read has come back, win or lose.
    const [proxiesFetched, setProxiesFetched] = useState(false);

    // Fetch System Proxies from Supabase
    useEffect(() => {
        const fetchProxies = async () => {
            try {
                const { data, error } = await supabase.from('proxies').select('*');
                if (error) throw error;

                if (data) {
                    const formatted: Proxy[] = data.map(p => ({
                        id: p.id,
                        name: p.name,
                        url: p.url,
                        isCustom: false
                    }));
                    setDbProxies(formatted);
                }
            } catch (err) {
                console.error("Failed to fetch proxies:", err);
                // Fallback if DB fails?
                // For now, we just rely on what we have or custom ones.
            } finally {
                // Settled either way: a failed read means we go with whatever the
                // saved selection and the custom list give us, and the boot gate
                // must not wait on a request that is never coming back.
                setProxiesFetched(true);
            }
        };

        fetchProxies();
    }, []);

    // Sync Custom Proxies to LocalStorage
    useEffect(() => {
        localStorage.setItem('custom_proxies', JSON.stringify(customProxies));
    }, [customProxies]);

    // Sync Selected Proxy to LocalStorage
    useEffect(() => {
        if (selectedProxy.id !== 'loading') {
            localStorage.setItem('selected_proxy', JSON.stringify(selectedProxy));
        }
    }, [selectedProxy]);

    // Ensure selectedProxy is valid once DB proxies are loaded
    useEffect(() => {
        if (dbProxies.length > 0) {
            // If currently selected is 'loading', or invalid, pick the first one
            // We check if the selected proxy ID exists in our combined list (db + custom)
            // Note: Since customProxies is stable(ish), we mostly care about when DB loads.

            const allProxies = [...dbProxies, ...customProxies];
            const exists = allProxies.find(p => p.id === selectedProxy.id);

            if (!exists || selectedProxy.id === 'loading') {
                // Determine a safe default: either the one from LS if it matches now, or just the first DB proxy
                const saved = localStorage.getItem('selected_proxy');
                let candidate: Proxy | undefined;

                if (saved) {
                    const parsed = JSON.parse(saved);
                    candidate = allProxies.find(p => p.id === parsed.id);
                }

                if (candidate) {
                    setSelectedProxy(candidate);
                } else {
                    setSelectedProxy(dbProxies[0]);
                }
            }
        }
    }, [dbProxies, customProxies]);
    // Note: We deliberately exclude selectedProxy from dep array to avoid loops, 
    // we only want to run this re-evaluation when the *lists* change or load.

    const selectProxy = (proxy: Proxy) => {
        setSelectedProxy(proxy);
        setShowModal(false);
        setTimeout(() => retryFetchFn(), 100);
    };

    const addCustomProxy = (name: string, url: string) => {
        const newProxy: Proxy = {
            id: `custom-${Date.now()}`,
            name,
            url,
            isCustom: true
        };
        setCustomProxies(prev => [...prev, newProxy]);
        selectProxy(newProxy);
        toast.success('Custom Gateway Added');
    };

    const removeProxy = (id: string) => {
        setCustomProxies(prev => prev.filter(p => p.id !== id));
        if (selectedProxy.id === id) {
            // Revert to first DB proxy if available
            if (dbProxies.length > 0) setSelectedProxy(dbProxies[0]);
        }
        toast.success('Gateway Removed');
    };

    // The placeholder id survives until the effect above picks a real gateway, so
    // it -- not the fetch flag alone -- is what says the selection is resolved.
    // With no DB rows there is nothing left to resolve to, and waiting further
    // would hang the boot gate on a list that will stay empty.
    const proxiesSettled = proxiesFetched && (selectedProxy.id !== 'loading' || dbProxies.length === 0);

    return (
        <ProxyContext.Provider value={{
            selectedProxy,
            proxies,
            proxiesSettled,
            showModal,
            setShowModal,
            selectProxy,
            addCustomProxy,
            removeProxy,
            retryFetch: retryFetchFn,
            setRetryFetch: setRetryFetchFn
        }}>
            {children}
        </ProxyContext.Provider>
    );
};

export const useProxy = () => {
    const context = useContext(ProxyContext);
    if (!context) throw new Error('useProxy must be used within ProxyProvider');
    return context;
};