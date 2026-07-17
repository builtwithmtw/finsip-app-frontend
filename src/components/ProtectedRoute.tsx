"use client";

import React, { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../views/LoginPage';

interface ProtectedRouteProps {
    children: ReactNode;
}

/** The loader AuthProvider used to show while it resolved the session. */
const AuthLoader: React.FC = () => (
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
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    // The session lives in localStorage, so the server can never know who this
    // is. Rather than let the server guess and mismatch on hydration, the server
    // pass and the client's first render both show the loader; only once mounted
    // do we render what the session actually says. This is also where the loader
    // belongs -- it used to sit in AuthProvider and block the public screener too.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted || loading) {
        return <AuthLoader />;
    }

    // There is no /login route: signed-out visitors get the login form in place
    // of whatever protected page they asked for, and land on it once they
    // authenticate. The public pages -- "/" and /screener -- sit outside the
    // (app) group and never reach this.
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
