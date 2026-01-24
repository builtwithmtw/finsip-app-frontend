import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any }>;
    signUp: (email: string, password: string, displayName: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Quick local storage check for a faster first paint
    const [loading, setLoading] = useState(() => {
        const hasSession = Object.keys(localStorage).some(key => key.includes('auth-token'));
        return hasSession;
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
                }
            }
        });
        if (res.error) setLoading(false);
        return res;
    };

    const signOut = async () => {
        setUser(null);
        await supabase.auth.signOut();
    };



    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            signIn,
            signUp,
            signOut,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
