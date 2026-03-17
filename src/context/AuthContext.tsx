import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any; data?: any }>;
    signUp: (email: string, password: string, displayName: string) => Promise<{ error: any; data?: any }>;
    signOut: () => Promise<void>;
    updatePassword: (password: string) => Promise<{ error: any; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Optimized loading: only show loader if we detect a potential session
    const [loading, setLoading] = useState(() => {
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

    const signIn = async (email: string, password: string) => {
        setLoading(true);
        const res = await supabase.auth.signInWithPassword({ email, password });
        if (res.error) setLoading(false);
        return res;
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        setLoading(true);
        const res = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName
                },
                emailRedirectTo: `${window.location.origin}/`
            }
        });
        if (res.error) setLoading(false);
        return res;
    };

    const signOut = async () => {
        setUser(null);
        await supabase.auth.signOut();
    };

    const updatePassword = async (password: string) => {
        setLoading(true);
        const res = await supabase.auth.updateUser({ password });
        if (res.error) setLoading(false);
        return res;
    };



    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            signIn,
            signUp,
            signOut,
            updatePassword,
        }}>
            {loading ? (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-flex p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-2xl mb-6 animate-pulse">
                            <svg
                                className="text-white"
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                        </div>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Loading Portfolio...</p>
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
