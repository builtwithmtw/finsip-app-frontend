"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../utils/formatters';

const STORAGE_KEY = 'finsip:amounts-hidden';
const MASK = '*******';

interface PrivacyContextValue {
    hidden: boolean;
    toggleHidden: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hidden, setHidden] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, String(hidden));
        } catch {
            // Private browsing / storage disabled: the toggle still works for this session.
        }
    }, [hidden]);

    const toggleHidden = useCallback(() => setHidden(prev => !prev), []);

    // Shift+H, so amounts can be killed without reaching for the mouse. Ignored while
    // typing, otherwise a capital H in any field would flip the whole app.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!e.shiftKey || e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey) return;

            const target = e.target as HTMLElement | null;
            const isTyping = target?.isContentEditable
                || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
            if (isTyping) return;

            e.preventDefault();
            toggleHidden();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggleHidden]);

    const value = useMemo(() => ({ hidden, toggleHidden }), [hidden, toggleHidden]);

    return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
};

export const usePrivacy = (): PrivacyContextValue => {
    const ctx = useContext(PrivacyContext);
    if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider');
    return ctx;
};

/**
 * Drop-in replacement for the bare formatCurrency import. Returns the mask while
 * amounts are hidden, so existing call sites that chain .split('.') or
 * .replace('Rs', '') on the result keep working untouched.
 */
export const useCurrency = (): ((amount: number) => string) => {
    const { hidden } = usePrivacy();
    return useCallback(
        (amount: number) => (hidden ? MASK : formatCurrency(amount)),
        [hidden]
    );
};

/**
 * For figures that aren't currency but still give the position away -- share counts,
 * per-share prices. Wrap whatever the call site already renders: mask(x.toFixed(2)).
 * Percentages stay visible: they describe the shape of the portfolio, not its size.
 */
export const useMask = (): ((text: string | number) => string) => {
    const { hidden } = usePrivacy();
    return useCallback(
        (text: string | number) => (hidden ? MASK : String(text)),
        [hidden]
    );
};

/**
 * Keeps the first character so a row stays identifiable while hidden. Used on input
 * surfaces like the entry form, where a fully masked symbol would make it impossible
 * to tell which stock you're typing shares into.
 */
export const usePartialMask = (): ((text: string) => string) => {
    const { hidden } = usePrivacy();
    return useCallback(
        (text: string) => (hidden && text ? `${text[0]}${'•'.repeat(Math.max(text.length - 1, 1))}` : text),
        [hidden]
    );
};