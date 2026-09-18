"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any; data?: any }>;
    signUp: (email: string, password: string) => Promise<{ error: any; data?: any }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: any; data?: any }>;
    updatePassword: (password: string) => Promise<{ error: any; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Optimized loading: only show loader if we detect a potential session.
    // Client components still render on the server for the initial HTML, where
    // there is no localStorage -- and no session to find either, so the server
    // pass answers "no loader" and the effect below settles it for real.
    const [loading, setLoading] = useState(() => {
        if (typeof window === 'undefined') return false;

        // Check if there's any indication of an existing session
        const hasSession = Object.keys(localStorage).some(key =>
            key.includes('supabase') || key.includes('auth-token')
        );
        return hasSession; // Only show loader if session might exist
    });

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!isMounted) return;
                const currentUser = session?.user ?? null;
                setUser(currentUser);

            } catch (err) {
                console.error("Auth init error:", err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;

            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // `loading` gates the whole app behind a full-screen loader, so these must NOT set it:
    // doing so unmounts the login form (losing its error state) and the Toaster along with
    // it, which is why failed sign-ins used to report nothing at all. Callers track their
    // own in-flight state; a successful sign-in swaps the UI via onAuthStateChange.
    const signIn = async (email: string, password: string) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signUp = async (email: string, password: string) => {
        return supabase.auth.signUp({ email, password });
    };

    const signOut = async () => {
        setUser(null);
        await supabase.auth.signOut();
    };

    /**
     * Mails the recovery link. `redirectTo` is read off the live origin rather
     * than SITE_URL so a localhost run gets a localhost link instead of one that
     * lands on production -- both origins have to be listed under Supabase's
     * Authentication > URL Configuration > Redirect URLs, or the link falls back
     * to the project Site URL and the reset form never sees a token.
     *
     * Supabase answers the same way whether or not the address has an account,
     * and callers are expected to preserve that: reporting "no such user" would
     * turn this form into a way of asking which emails are registered.
     */
    const resetPassword = async (email: string) => {
        const redirectTo =
            typeof window === 'undefined'
                ? undefined
                : `${window.location.origin}/reset-password`;
        return supabase.auth.resetPasswordForEmail(email, { redirectTo });
    };

    const updatePassword = async (password: string) => {
        return supabase.auth.updateUser({ password });
    };



    // Renders children unconditionally. It used to swap in a full-screen loader
    // while `loading`, but this provider now sits at the root and would hold the
    // public screener hostage to an auth check it doesn't need -- and the server,
    // which has no localStorage, would render the children while the client
    // rendered the loader, which is a hydration mismatch. The loader moved to
    // ProtectedRoute, where it only covers pages that actually require a user.
    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            signIn,
            signUp,
            signOut,
            resetPassword,
            updatePassword,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};