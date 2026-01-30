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

    // 2. Custom Proxies (Local Storage)
    const [customProxies, setCustomProxies] = useState<Proxy[]>(() => {
        const saved = localStorage.getItem('custom_proxies');
        return saved ? JSON.parse(saved) : [];
    });

    // Combined list
    const proxies = [...dbProxies, ...customProxies];

    // 3. Selected Proxy (Local Storage)
    // We defer the "validity check" until we have proxies loaded, but we try to load from LS first.
    const [selectedProxy, setSelectedProxy] = useState<Proxy>(() => {
        const saved = localStorage.getItem('selected_proxy');
        if (saved) {
            return JSON.parse(saved);
        }
        // Fallback placeholder until DB loads
        return { id: 'loading', name: 'Loading...', url: '' };
    });

    const [showModal, setShowModal] = useState(false);
    const [retryFetchFn, setRetryFetchFn] = useState<() => void>(() => () => { });

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

    return (
        <ProxyContext.Provider value={{
            selectedProxy,
            proxies,
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
