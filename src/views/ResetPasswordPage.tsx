"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { DISPLAY } from '../utils/typography';

/**
 * Where the emailed recovery link lands.
 *
 * `checking` is the honest starting state and the whole reason this page was
 * rewritten. It used to derive validity from AuthContext's `isAuthenticated`,
 * which starts false and only becomes true once Supabase has parsed the token
 * out of the URL -- so a signed-out visitor, which is every visitor arriving
 * from their inbox, saw "link is invalid" for the tick before the perfectly
 * good token resolved. Nothing here reads `isAuthenticated` any more; the
 * session is established once, explicitly, below.
 */
type LinkState = 'checking' | 'ready' | 'invalid';

/**
 * Supabase has sent recovery links in two shapes over the years and a project's
 * email template decides which one arrives, so both are handled:
 *
 *  - `#access_token=...&type=recovery` -- the implicit flow. The client picks
 *    this up on its own (`detectSessionInUrl` is on by default), which is why
 *    there is no branch for it: `getSession()` below awaits that same
 *    initialisation and returns the session it established.
 *  - `?token_hash=...&type=recovery` -- the newer template. Nothing consumes it
 *    automatically; it has to be handed to `verifyOtp`.
 */
const readRecoveryParams = () => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const pick = (key: string) => hashParams.get(key) ?? queryParams.get(key);

    return {
        errorCode: pick('error_code') ?? pick('error'),
        errorDescription: pick('error_description'),
        tokenHash: pick('token_hash'),
    };
};

/** Turns Supabase's wording into something a person can act on. */
const describeError = (raw: string): string => {
    if (/expired/i.test(raw)) return 'That link has expired. Reset links are good for one hour.';
    if (/already been used|invalid|not found/i.test(raw)) return 'That link is no longer valid. It may already have been used, or replaced by a newer one.';
    if (/session missing|session_not_found/i.test(raw)) return 'This link did not carry a valid session. Please request a fresh one.';
    if (/should be different|same as the old/i.test(raw)) return 'That is already your password. Please choose a different one.';
    if (/at least/i.test(raw)) return 'Password must be at least 6 characters.';
    if (/fetch|network/i.test(raw)) return 'Could not reach the server. Check your connection.';
    return raw || 'Something went wrong. Please try again.';
};

const ResetPasswordPage: React.FC = () => {
    const { updatePassword } = useAuth();
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [linkState, setLinkState] = useState<LinkState>('checking');
    const [linkError, setLinkError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    /**
     * A recovery token is single-use, and StrictMode runs this effect twice on the
     * same instance in development -- the second `verifyOtp` would be redeeming a
     * token the first one already spent, and the page would call a perfectly good
     * link invalid. The ref survives the double-invoke (it is one instance, not
     * two), so the exchange happens exactly once.
     */
    const startedRef = React.useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const settle = (state: LinkState, message?: string) => {
            setLinkState(state);
            if (message) setLinkError(message);
        };

        const establishSession = async () => {
            const { errorCode, errorDescription, tokenHash } = readRecoveryParams();

            // Supabase redirects here with the failure spelled out when it rejects
            // the token itself -- an expired link never reaches getSession().
            if (errorCode) {
                settle('invalid', describeError(errorDescription ?? errorCode));
                return;
            }

            if (tokenHash) {
                const { error } = await supabase.auth.verifyOtp({
                    type: 'recovery',
                    token_hash: tokenHash,
                });

                if (error) {
                    settle('invalid', describeError(error.message));
                    return;
                }

                settle('ready');
                return;
            }

            // getSession() awaits the client's own initialisation, and that is
            // where the `#access_token` fragment is consumed -- so by the time
            // this resolves there is either a session or there was never a token.
            const { data: { session } } = await supabase.auth.getSession();

            settle(
                session ? 'ready' : 'invalid',
                session ? undefined : 'This page needs a recovery link to work. Request one from the sign-in form.',
            );
        };

        establishSession()
            .catch((err: any) => {
                console.error('Recovery link check failed:', err);
                settle('invalid', describeError(err?.message ?? ''));
            })
            .finally(() => {
                // The token is a credential and has no business sitting in the
                // address bar or the back-forward history once it is spent.
                if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
            });
    }, []);

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (password.length < 6) {
            setFormError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setFormError('The two passwords do not match.');
            return;
        }

        setSaving(true);

        try {
            const { error } = await updatePassword(password);

            if (error) {
                console.error('Password reset error:', error);
                const message = describeError(error.message ?? '');
                setFormError(message);
                toast.error('Could not update password', { description: message });
                setSaving(false);
                return;
            }

            // The recovery link signed them in, so there is nothing left to do but
            // let them in. `replace`, not `push`: this page is spent and must not
            // come back on the back button.
            toast.success('Password updated', { description: 'You are signed in with the new password.' });
            router.replace('/dashboard');
        } catch (err: any) {
            console.error('Reset exception:', err);
            const message = describeError(err?.message ?? '');
            setFormError(message);
            toast.error('Something went wrong', { description: message });
            setSaving(false);
        }
    };

    // Matches the sign-in form on "/" -- this page is the far end of a journey
    // that starts there, and the app is light-only.
    const inputClass =
        "h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5";

    const labelClass =
        "mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400";

    const buttonClass =
        "mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50";

    const shell = (children: React.ReactNode) => (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
            <div className="w-full max-w-md animate-in fade-in duration-500">{children}</div>
        </main>
    );

    if (linkState === 'checking') {
        return shell(
            <div className="flex flex-col items-center gap-4 text-center">
                <span className="size-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                <p className="text-[13px] text-slate-400">Checking your reset link&hellip;</p>
            </div>,
        );
    }

    if (linkState === 'invalid') {
        return shell(
            <>
                <div className="mb-7 inline-flex size-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50">
                    <AlertCircle size={20} className="text-rose-500" />
                </div>
                <h1
                    className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                    style={DISPLAY}
                >
                    This link won&rsquo;t work
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                    {linkError ?? 'The reset link is no longer valid.'}
                </p>

                {/* "/" rather than /dashboard: whoever is reading this is signed out,
                    and the dashboard would only bounce them back here via
                    ProtectedRoute. The sign-in form, and the "Forgot?" link that
                    sends a fresh email, are both on "/". */}
                <Link href="/" style={DISPLAY} className={buttonClass}>
                    Back to Sign In
                    <ArrowRight size={15} />
                </Link>
            </>,
        );
    }

    return shell(
        <>
            <div className="mb-7 inline-flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <KeyRound size={20} className="text-slate-700" />
            </div>
            <h1
                className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                style={DISPLAY}
            >
                Set a new password
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                Choose something at least 6 characters long. You&rsquo;ll be signed in straight
                after.
            </p>

            {formError && (
                <div className="mt-7 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle size={16} className="mt-px shrink-0 text-rose-500" />
                    <p className="text-[13px] leading-snug text-rose-700">{formError}</p>
                </div>
            )}

            <form onSubmit={handleResetSubmit} className="mt-8">
                <div>
                    <label htmlFor="new-password" className={labelClass} style={DISPLAY}>
                        New password
                    </label>
                    <div className="relative">
                        <input
                            id="new-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`${inputClass} pr-12`}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors hover:text-slate-600"
                        >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                </div>

                <div className="mt-6">
                    <label htmlFor="confirm-password" className={labelClass} style={DISPLAY}>
                        Confirm password
                    </label>
                    <div className="relative">
                        <input
                            id="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`${inputClass} pr-12`}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors hover:text-slate-600"
                        >
                            {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                </div>

                <button type="submit" disabled={saving} style={DISPLAY} className={buttonClass}>
                    {saving ? (
                        <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                        <>
                            Update Password
                            <ArrowRight size={15} />
                        </>
                    )}
                </button>
            </form>
        </>,
    );
};

export default ResetPasswordPage;
