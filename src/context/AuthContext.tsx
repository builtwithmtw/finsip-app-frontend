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

    const updatePassword = async (password: string) => {
        return supabase.auth.updateUser({ password });
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
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="flex flex-col items-center animate-in fade-in duration-500">
                        {/* Logo with a ring orbiting it */}
                        <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 animate-spin" />
                            <img
                                src="/logo.svg"
                                alt=""
                                className="absolute inset-0 m-auto w-9 h-9 rounded-lg animate-pulse"
                            />
                        </div>

                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                            Loading Portfolio
                        </p>

                        {/* Indeterminate progress sliver */}
                        <div className="w-40 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-blue-600 rounded-full animate-loader-sweep" />
                        </div>
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
