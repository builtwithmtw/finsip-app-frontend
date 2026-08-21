"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * The user's own preferences about how the app presents itself.
 *
 * A context rather than `useLocalStorage` at each call site, because a setting is read
 * in one place and changed in another: the nav bar draws the figures, the Settings page
 * flips the switch, and both are mounted at once. Two independent `useLocalStorage`
 * hooks on the same key hold two independent pieces of React state, so the bar would go
 * on showing the old format until the next reload.
 *
 * Nothing here is account data. It is per-browser by design -- these are answers about
 * this screen, not about this portfolio -- which is why it lives in localStorage rather
 * than in Supabase beside the ledger.
 */
interface SettingsContextType {
    /** Abbreviate Worth and Cost in the nav bar: "Rs 272k" rather than "Rs 272,000". */
    compactNavAmounts: boolean;
    setCompactNavAmounts: (value: boolean) => void;
    /**
     * Which of its two readings the Ledger opens on. On: the transaction log with
     * Returns and Activity beside it. Off: the symbol-by-month grid. Never both --
     * each wants the whole page, which is the choice this setting is.
     */
    showTransactionsLedger: boolean;
    setShowTransactionsLedger: (value: boolean) => void;
}

const STORAGE_KEY = 'finsip:settings';

const DEFAULTS = {
    /** The bar is the one place in the app short of room for seven digits. */
    compactNavAmounts: true,
    /** The log is the ledger in the literal sense; the grid is a second reading of it. */
    showTransactionsLedger: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState(DEFAULTS);

    /*
     * Read after mount rather than in the initialiser. The server has no localStorage,
     * so seeding state from it during render would make the first client render
     * disagree with the HTML and hydrate as a mismatch. The defaults are what the server
     * draws, and the stored answer replaces them a tick later.
     */
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const parsed = JSON.parse(stored) as Partial<typeof DEFAULTS>;
            // Spread over the defaults so a settings file written by an older version --
            // one that predates a key added since -- is filled in rather than rejected.
            setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {
            // A browser with storage blocked, or a corrupt value. The defaults stand;
            // preferences are not worth an error state.
        }
    }, []);

    const write = useCallback((patch: Partial<typeof DEFAULTS>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch };

            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Storage refused the write; the change still stands for this session.
            }

            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            compactNavAmounts: settings.compactNavAmounts,
            setCompactNavAmounts: (v: boolean) => write({ compactNavAmounts: v }),
            showTransactionsLedger: settings.showTransactionsLedger,
            setShowTransactionsLedger: (v: boolean) => write({ showTransactionsLedger: v }),
        }),
        [settings.compactNavAmounts, settings.showTransactionsLedger, write]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
