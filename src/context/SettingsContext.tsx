"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

/**
 * The user's own row: who they are, and how the app draws itself for them.
 *
 * A context rather than `useLocalStorage` at each call site, because these are read in
 * one place and changed in another: the nav bar draws the figures and the avatar, the
 * Settings page flips the switches, and both are mounted at once. Two independent hooks
 * on the same key hold two independent pieces of React state, so the bar would go on
 * showing the old answer until the next reload.
 *
 * All of it belongs to the account, not the browser -- `user_settings` in Supabase, one
 * row per user, so the answers follow the user from laptop to phone the way the ledger
 * does. The row is written the first time anything here is changed; until then the
 * account has no row and the defaults below are its answer.
 *
 * Email is deliberately absent. It is the login, Supabase Auth owns it, and changing it
 * is an account operation with a confirmation mail behind it rather than a profile
 * field -- so the Settings page shows `useAuth().user.email` read-only.
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

    /** What the user is called in the nav bar. Null falls back to the email's local part. */
    displayName: string | null;
    /** Uploaded picture. Null falls back to the identicon generated from the email. */
    avatarUrl: string | null;
    /**
     * Awaitable, unlike the switches: the Settings page holds its Save button in a
     * pending state while these are in flight, and needs to know whether the write
     * landed. Resolves false on failure, having already rolled back and raised a toast.
     */
    saveProfile: (patch: { displayName?: string | null; avatarUrl?: string | null }) => Promise<boolean>;

    /** Whether the Supabase read has come back, win or lose. The boot gate waits on it. */
    settingsLoaded: boolean;
}

const DEFAULTS = {
    /** The exact figure is the honest one; the bar is only short of room on the narrowest screens. */
    compactNavAmounts: false,
    /** The log is the ledger in the literal sense; the grid is a second reading of it. */
    showTransactionsLedger: true,
    /** Both null until the user says otherwise -- the app derives a name and a mark from the email. */
    displayName: null as string | null,
    avatarUrl: null as string | null,
};

type Settings = typeof DEFAULTS;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<Settings>(DEFAULTS);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    const userId = user?.id ?? null;

    useEffect(() => {
        if (!userId) {
            // Signed out: back to the defaults, so whoever signs in next in this tab
            // never inherits the last account's name or picture while their own row loads.
            setSettings(DEFAULTS);
            setSettingsLoaded(false);
            return;
        }

        let cancelled = false;

        (async () => {
            /*
             * `*` rather than a column list, and `maybeSingle` rather than `single`.
             *
             * No row at all is the normal state for an account that has never touched
             * Settings, which `single` would call an error. And naming the columns would
             * make the whole read fail against a database that has had
             * `add_user_settings.sql` run but not `add_user_profile.sql` -- taking the
             * display switches down over two profile columns that simply aren't there
             * yet. Selecting everything lets a missing column arrive as `undefined` and
             * fall through to its default, which is how the rest of the app treats a
             * migration it hasn't caught up with.
             */
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (cancelled) return;

            if (error) {
                // A database that hasn't had the migrations run, or a read that simply
                // failed. The defaults stand -- preferences are not worth an error
                // state, and the boot gate must not wait on a request that is never
                // coming back.
                console.error('Failed to load settings:', error.message);
            } else if (data) {
                // Column by column against the defaults, so a row written before a key
                // was added is filled in rather than leaving that setting undefined.
                setSettings({
                    compactNavAmounts: data.compact_nav_amounts ?? DEFAULTS.compactNavAmounts,
                    showTransactionsLedger: data.show_transactions_ledger ?? DEFAULTS.showTransactionsLedger,
                    displayName: data.display_name ?? null,
                    avatarUrl: data.avatar_url ?? null,
                });
            }

            setSettingsLoaded(true);
        })();

        return () => { cancelled = true; };
    }, [userId]);

    /**
     * Optimistic, in the same shape as the portfolio's own writes: the control moves
     * under the finger and a rejected write puts the old answer back with a toast.
     * The whole row goes up each time -- an upsert has to propose a complete row for
     * its insert half anyway.
     */
    const write = useCallback(async (patch: Partial<Settings>): Promise<boolean> => {
        if (!userId) return false;

        const previous = settings;
        const next = { ...settings, ...patch };
        setSettings(next);

        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                compact_nav_amounts: next.compactNavAmounts,
                show_transactions_ledger: next.showTransactionsLedger,
                display_name: next.displayName,
                avatar_url: next.avatarUrl,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) {
            setSettings(previous);
            toast.error('Could not save: ' + error.message);
            return false;
        }

        return true;
    }, [settings, userId]);

    const value = useMemo(
        () => ({
            compactNavAmounts: settings.compactNavAmounts,
            setCompactNavAmounts: (v: boolean) => { void write({ compactNavAmounts: v }); },
            showTransactionsLedger: settings.showTransactionsLedger,
            setShowTransactionsLedger: (v: boolean) => { void write({ showTransactionsLedger: v }); },
            displayName: settings.displayName,
            avatarUrl: settings.avatarUrl,
            saveProfile: write,
            settingsLoaded,
        }),
        [settings, write, settingsLoaded]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
