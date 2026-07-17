"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, Mail, UserPlus, LogIn, Key, Eye, EyeOff, AlertCircle, LineChart } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
    const { signIn, signUp, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/dashboard');
        }
    }, [isAuthenticated, router]);

    // Auth Form State
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const signUpPaused = false;

    // Supabase surfaces the useful text on .message; .code is often undefined, which is
    // why failures used to show up blank.
    const describeError = (error: any): string => {
        const raw = error?.message || error?.error_description || '';
        const code = error?.code || error?.name || '';

        if (/invalid login credentials/i.test(raw)) return 'Incorrect email or password.';
        if (/email not confirmed/i.test(raw)) return 'This email is not confirmed yet.';
        if (/user already registered|already registered/i.test(raw)) return 'An account with this email already exists.';
        if (/password should be at least/i.test(raw)) return 'Password must be at least 6 characters.';
        if (/unable to validate email|invalid format/i.test(raw)) return 'That email address does not look valid.';
        if (/rate limit|too many requests/i.test(raw)) return 'Too many attempts. Please wait a moment and try again.';
        if (/fetch|network/i.test(raw)) return 'Could not reach the server. Check your connection.';

        return raw || code || 'Something went wrong. Please try again.';
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setFormError(null);

        try {
            const { error, data } = isRegisterMode
                ? await signUp(email, password)
                : await signIn(email, password);

            if (error) {
                console.error('Auth error:', error);
                const message = describeError(error);
                setFormError(message);
                toast.error(isRegisterMode ? 'Sign up failed' : 'Sign in failed', { description: message });
                setAuthLoading(false);
                return;
            }

            if (isRegisterMode) {
                if (data?.session) {
                    // Confirmation disabled: signUp already returned a session, we are logged in.
                    toast.success('Account created');
                    return;
                }

                // No session came back, so sign in with the credentials we already have.
                const { error: signInError } = await signIn(email, password);

                if (signInError) {
                    console.error('Post-signup sign in failed:', signInError);
                    const message = 'Account created, but this project still requires email confirmation. Disable it in Supabase to allow direct login.';
                    setFormError(message);
                    toast.error('Verification required', { description: message, duration: 10000 });
                    setAuthLoading(false);
                    return;
                }

                toast.success('Account created');
                return;
            }

            // Login successful - loading will be handled by auth state change
            toast.success('Welcome back');
        } catch (err: any) {
            console.error('Auth exception:', err);
            const message = describeError(err);
            setFormError(message);
            toast.error('Something went wrong', { description: message });
            setAuthLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-sm animate-in fade-in duration-500">

                {/* Brand */}
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.svg" alt="FinSIP" className="w-12 h-12 rounded-xl mb-3" />
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">FINSIP</h1>
                    <p className="text-xs text-slate-400 mt-1">
                        {isRegisterMode ? 'Create your account' : 'Sign in to your portfolio'}
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">

                    {/* Toggle */}
                    <div className="flex bg-slate-50 p-1 rounded-lg mb-6 border border-slate-100">
                        <button
                            onClick={() => { setIsRegisterMode(false); setFormError(null); }}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors",
                                !isRegisterMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <LogIn size={12} /> Sign In
                        </button>
                        {signUpPaused ? null : (
                            <button
                                onClick={() => { setIsRegisterMode(true); setFormError(null); }}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors",
                                    isRegisterMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <UserPlus size={12} /> Sign Up
                            </button>
                        )}
                    </div>

                    {formError && (
                        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-rose-50 border border-rose-100 rounded-md animate-in fade-in slide-in-from-top-1 duration-200">
                            <AlertCircle size={14} className="text-rose-500 mt-px shrink-0" />
                            <p className="text-xs text-rose-700 leading-snug">{formError}</p>
                        </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={15} />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-md pl-9 pr-3 text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                required
                            />
                        </div>

                        <div className="relative group">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={15} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-md pl-9 pr-10 text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {authLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isRegisterMode ? 'Create Account' : 'Sign In'}
                                    <ChevronRight size={14} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* The screener is public, so there is somewhere useful to go from
                    here without an account. Signed-out visitors reach this page by
                    asking for a protected route, which means the browser's Back
                    button returns them to whatever bounced them, not to the screener. */}
                <div className="mt-6 flex flex-col items-center gap-3">
                    <Link
                        href="/screener"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                    >
                        <LineChart size={13} />
                        Go to Screener
                        <span className="text-slate-300 normal-case tracking-normal font-medium">
                            — no account needed
                        </span>
                    </Link>

                    <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                        FinSIP
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;