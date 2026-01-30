import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Proxy {
    id: string;
    name: string;
    url: string;
    isCustom?: boolean;
}

const DEFAULT_PROXIES: Proxy[] = [
    { id: 'corslol', name: 'API.CORS.LOL', url: 'https://api.cors.lol/?url=' },
    { id: 'corsproxy', name: 'CORSPROXY.IO', url: 'https://corsproxy.io/?' },
    { id: 'crossorigin', name: 'CROSSORIGIN.ME', url: 'https://crossorigin.me/' },
];

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
    const [proxies, setProxies] = useState<Proxy[]>(() => {
        const saved = localStorage.getItem('app_proxies');
        return saved ? JSON.parse(saved) : DEFAULT_PROXIES;
    });

    const [selectedProxy, setSelectedProxy] = useState<Proxy>(() => {
        const saved = localStorage.getItem('selected_proxy');
        if (saved) {
            const parsed = JSON.parse(saved);
            return proxies.find(p => p.id === parsed.id) || proxies[0];
        }
        return proxies[0];
    });

    const [showModal, setShowModal] = useState(false);
    const [retryFetchFn, setRetryFetchFn] = useState<() => void>(() => () => { });

    useEffect(() => {
        localStorage.setItem('app_proxies', JSON.stringify(proxies));
    }, [proxies]);

    useEffect(() => {
        localStorage.setItem('selected_proxy', JSON.stringify(selectedProxy));
    }, [selectedProxy]);

    const selectProxy = (proxy: Proxy) => {
        setSelectedProxy(proxy);
        setShowModal(false);
        // Delay slightly to ensure state is updated before retry
        setTimeout(() => retryFetchFn(), 100);
    };

    const addCustomProxy = (name: string, url: string) => {
        const newProxy: Proxy = {
            id: `custom-${Date.now()}`,
            name,
            url,
            isCustom: true
        };
        setProxies(prev => [...prev, newProxy]);
        selectProxy(newProxy);
    };

    const removeProxy = (id: string) => {
        if (proxies.find(p => p.id === id)?.isCustom) {
            setProxies(prev => prev.filter(p => p.id !== id));
            if (selectedProxy.id === id) {
                setSelectedProxy(proxies[0]);
            }
        }
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
