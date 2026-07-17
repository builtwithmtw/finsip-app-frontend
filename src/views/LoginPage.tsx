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
        <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-50 font-sans">
            {/* The landing page's header, in this page's light palette: same mark,
                wordmark and 14-unit bar, so being bounced here from a protected
                route still looks like the same site. It also carries the way to the
                screener, which used to be a stray text link under the card. */}
            <header className="shrink-0 border-b border-slate-200 bg-white">
                <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-70"
                    >
                        <img src="/logo.svg" alt="" className="size-8 shrink-0 rounded-lg" />
                        <div className="flex flex-col justify-center leading-none">
                            <span className="text-base font-black tracking-tight text-slate-900">FINSIP</span>
                            <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.28em] text-slate-400">
                                SIP Tracker
                            </span>
                        </div>
                    </Link>

                    {/* The screener needs no account, so it is the one useful place to
                        go from here. Back would only return whatever bounced you. */}
                    <Link
                        href="/screener"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                    >
                        <LineChart size={13} />
                        Screener
                    </Link>
                </div>
            </header>

            {/* pb-14 matches the header's h-14. Centring inside what the header
                leaves over would put the card half a header-height below the middle
                of the screen; a phantom header's worth of padding at the bottom
                balances the real one at the top, so it centres on the viewport. */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6 pb-14">
                {/* One soft pool of brand colour behind the card. Flat slate-50 across
                    a whole desktop viewport is what read as empty; this gives the card
                    something to sit on without competing with it. */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.07] blur-[110px]" />
                </div>

                <div className="relative w-full max-w-sm animate-in fade-in duration-500">

                    {/* Brand. `alt` is empty because the wordmark under it says the
                        same thing, and a screen reader shouldn't hear it twice. */}
                    <div className="flex flex-col items-center mb-8">
                        <img src="/logo.svg" alt="" className="w-12 h-12 rounded-xl mb-3" />
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">FINSIP</h1>
                        <p className="text-xs text-slate-400 mt-1">
                            {isRegisterMode ? 'Create your account' : 'Sign in to your portfolio'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xl shadow-slate-900/5 p-7">

                        {/* Toggle */}
                        <div className="flex bg-slate-50 p-1 rounded-lg mb-6 border border-slate-200/70">
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
                                    className="w-full h-11 bg-slate-50 border border-slate-200/70 rounded-lg pl-9 pr-3 text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
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
                                    className="w-full h-11 bg-slate-50 border border-slate-200/70 rounded-lg pl-9 pr-10 text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
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
                                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-600/20 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mt-5 disabled:opacity-50 disabled:pointer-events-none"
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

                </div>
            </div>
        </div>
    );
};

export default LoginPage;