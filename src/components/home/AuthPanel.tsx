"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, AlertCircle, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { DISPLAY } from "@/utils/typography";

/**
 * Three states, not two: "forgot" is the same form with the password field
 * dropped, so it lives here rather than on a route of its own -- a separate page
 * would mean a second copy of this layout and a navigation away from a form the
 * visitor is one field into.
 */
type AuthMode = "signin" | "register" | "forgot";

/**
 * The sign-in / create-account / forgot-password form that shares the home page
 * with the pitch.
 *
 * This is the whole of what used to be `views/LoginPage.tsx`, minus its page
 * chrome: there is no separate login route any more, so signing in happens on
 * "/" and ProtectedRoute sends signed-out visitors here rather than rendering a
 * second copy of this form in place.
 *
 * The one client island on an otherwise server-rendered page -- the session
 * lives in localStorage, so this is the only part that cannot be decided on the
 * server.
 */
export function AuthPanel() {
    const { signIn, signUp, resetPassword, isAuthenticated, user, loading } = useAuth();
    const router = useRouter();

    const [mode, setMode] = useState<AuthMode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    /** The address the link went to, and the flag for the "check your inbox" panel. */
    const [resetSentTo, setResetSentTo] = useState<string | null>(null);

    const isRegisterMode = mode === "register";
    const isForgotMode = mode === "forgot";

    const signUpPaused = false;

    /** Every mode switch clears the last mode's error; none of them survive the move. */
    const goToMode = (next: AuthMode) => {
        setMode(next);
        setFormError(null);
        setResetSentTo(null);
    };

    /**
     * Set the moment a submission succeeds, and the only thing that triggers the
     * jump to the portfolio.
     *
     * The old login page redirected on `isAuthenticated` alone, which was right
     * for a page whose only purpose was logging in. On the home page it would
     * mean an already-signed-in visitor could never look at "/" -- they would be
     * bounced to the dashboard before the page finished painting. Signed-in
     * visitors get the panel below instead, and can leave when they choose.
     */
    const signedInHere = useRef(false);

    useEffect(() => {
        if (isAuthenticated && signedInHere.current) router.replace("/dashboard");
    }, [isAuthenticated, router]);

    // Supabase surfaces the useful text on .message; .code is often undefined, which is
    // why failures used to show up blank.
    const describeError = (error: any): string => {
        const raw = error?.message || error?.error_description || "";
        const code = error?.code || error?.name || "";

        if (/invalid login credentials/i.test(raw)) return "Incorrect email or password.";
        if (/email not confirmed/i.test(raw)) return "This email is not confirmed yet.";
        if (/user already registered|already registered/i.test(raw)) return "An account with this email already exists.";
        if (/password should be at least/i.test(raw)) return "Password must be at least 6 characters.";
        if (/unable to validate email|invalid format/i.test(raw)) return "That email address does not look valid.";
        // Supabase throttles recovery mail per address and spells the wait out in
        // the message ("...after 47 seconds"), which is worth keeping verbatim --
        // a generic "try later" leaves the visitor refreshing blind.
        if (/for security purposes|you can only request this after/i.test(raw)) return raw;
        if (/email rate limit|over_email_send_rate_limit/i.test(raw)) return "Too many emails requested. Please wait a few minutes and try again.";
        if (/rate limit|too many requests/i.test(raw)) return "Too many attempts. Please wait a moment and try again.";
        if (/fetch|network/i.test(raw)) return "Could not reach the server. Check your connection.";

        return raw || code || "Something went wrong. Please try again.";
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setFormError(null);

        try {
            if (isForgotMode) {
                const { error } = await resetPassword(email);

                if (error) {
                    console.error("Password reset request failed:", error);
                    const message = describeError(error);
                    setFormError(message);
                    toast.error("Could not send the link", { description: message });
                    setAuthLoading(false);
                    return;
                }

                // Deliberately the same answer for an address with no account as
                // for one with: anything else turns this into a way of testing
                // which emails are registered.
                setResetSentTo(email);
                toast.success("Reset link sent", { description: `Check ${email} for the link.` });
                setAuthLoading(false);
                return;
            }

            const { error, data } = isRegisterMode
                ? await signUp(email, password)
                : await signIn(email, password);

            if (error) {
                console.error("Auth error:", error);
                const message = describeError(error);
                setFormError(message);
                toast.error(isRegisterMode ? "Sign up failed" : "Sign in failed", { description: message });
                setAuthLoading(false);
                return;
            }

            if (isRegisterMode) {
                if (data?.session) {
                    // Confirmation disabled: signUp already returned a session, we are logged in.
                    signedInHere.current = true;
                    toast.success("Account created");
                    return;
                }

                // No session came back, so sign in with the credentials we already have.
                const { error: signInError } = await signIn(email, password);

                if (signInError) {
                    console.error("Post-signup sign in failed:", signInError);
                    const message = "Account created, but this project still requires email confirmation. Disable it in Supabase to allow direct login.";
                    setFormError(message);
                    toast.error("Verification required", { description: message, duration: 10000 });
                    setAuthLoading(false);
                    return;
                }

                signedInHere.current = true;
                toast.success("Account created");
                return;
            }

            signedInHere.current = true;
            toast.success("Welcome back");
        } catch (err: any) {
            console.error("Auth exception:", err);
            const message = describeError(err);
            setFormError(message);
            toast.error("Something went wrong", { description: message });
            setAuthLoading(false);
        }
    };

    /**
     * The form is set a good step larger than the app's own controls. It is the
     * only thing on this half of the page, so it can afford the room, and at the
     * app's usual 11-unit input height it read as a widget parked in a lot of
     * white space rather than as the point of the screen.
     */
    const inputClass =
        "h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5";

    const labelClass =
        "mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400";

    const buttonClass =
        "mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50";

    /** The inline "switch to the other mode" link, shared by every footer sentence. */
    const linkClass =
        "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900";

    // Already signed in and just visiting: the way on, not a form asking for
    // credentials they have already given.
    if (isAuthenticated && !loading) {
        return (
            <div className="w-full max-w-md animate-in fade-in duration-500">
                <h2
                    className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                    style={DISPLAY}
                >
                    You&rsquo;re signed in
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                    {user?.email ? (
                        <>as <span className="font-medium text-slate-700">{user.email}</span>.</>
                    ) : null}{" "}
                    Your portfolio is where you left it.
                </p>

                <Link href="/dashboard" style={DISPLAY} className={buttonClass}>
                    Open Portfolio
                    <ArrowRight size={15} />
                </Link>
            </div>
        );
    }

    // The link is out. Replacing the form rather than annotating it is the point:
    // the next step is in an inbox, not on this page, and leaving a live Send
    // button under the message invites a second request into Supabase's throttle.
    if (resetSentTo) {
        return (
            <div className="w-full max-w-md animate-in fade-in duration-500">
                <div className="mb-7 inline-flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                    <MailCheck size={20} className="text-slate-700" />
                </div>
                <h2
                    className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                    style={DISPLAY}
                >
                    Check your inbox
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                    If an account exists for{" "}
                    <span className="font-medium text-slate-700">{resetSentTo}</span>, a link to set
                    a new password is on its way. It expires in an hour.
                </p>
                <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
                    Nothing after a minute or two? Check the spam folder before asking for another
                    &mdash; each request invalidates the link before it.
                </p>

                <button
                    type="button"
                    onClick={() => goToMode("signin")}
                    style={DISPLAY}
                    className={buttonClass}
                >
                    Back to Sign In
                </button>

                <p className="mt-7 text-center text-[15px] text-slate-500">
                    Wrong address?{" "}
                    <button
                        type="button"
                        onClick={() => goToMode("forgot")}
                        className={linkClass}
                    >
                        Try another
                    </button>
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md animate-in fade-in duration-500">
            <h2
                className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                style={DISPLAY}
            >
                {isForgotMode
                    ? "Reset your password"
                    : isRegisterMode
                      ? "Create your account"
                      : "Welcome back"}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                {isForgotMode
                    ? "Give us the email on the account and we'll send a link to set a new password."
                    : isRegisterMode
                      ? "A few seconds, and the first instalment is yours to log."
                      : "Sign in to pick up where your portfolio left off."}
            </p>

            {formError && (
                <div className="mt-7 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle size={16} className="mt-px shrink-0 text-rose-500" />
                    <p className="text-[13px] leading-snug text-rose-700">{formError}</p>
                </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-8">
                <div>
                    <label htmlFor="email" className={labelClass} style={DISPLAY}>
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        required
                    />
                </div>

                {/* Unmounted rather than hidden in forgot mode, so its `required`
                    cannot block a submit the visitor can't see a field for. */}
                {!isForgotMode && (
                    <div className="mt-6">
                        <div className="flex items-baseline justify-between gap-4">
                            <label htmlFor="password" className={labelClass} style={DISPLAY}>
                                Password
                            </label>
                            {/* Only on sign-in: on the create-account form there is no
                                password to have forgotten yet. */}
                            {!isRegisterMode && (
                                <button
                                    type="button"
                                    onClick={() => goToMode("forgot")}
                                    className="mb-2.5 text-[13px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-900"
                                >
                                    Forgot?
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${inputClass} pr-12`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={authLoading}
                    style={DISPLAY}
                    className={buttonClass}
                >
                    {authLoading ? (
                        <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                        <>
                            {isForgotMode
                                ? "Send Reset Link"
                                : isRegisterMode
                                  ? "Create Account"
                                  : "Sign In"}
                            <ArrowRight size={15} />
                        </>
                    )}
                </button>
            </form>

            {/* A sentence rather than a segmented control: there are two modes, one of
                them is the answer 95% of the time, and the other only needs to be
                findable.

                Forgot mode gets its own way back, and gets it whether or not sign-up
                is paused -- it is a dead end otherwise, and the "Forgot?" link that
                leads here is on the sign-in form, which exists either way. */}
            {isForgotMode ? (
                <p className="mt-7 text-center text-[15px] text-slate-500">
                    Remembered it?{" "}
                    <button type="button" onClick={() => goToMode("signin")} className={linkClass}>
                        Back to sign in
                    </button>
                </p>
            ) : signUpPaused ? null : (
                <p className="mt-7 text-center text-[15px] text-slate-500">
                    {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => goToMode(isRegisterMode ? "signin" : "register")}
                        className={linkClass}
                    >
                        {isRegisterMode ? "Sign in" : "Create one"}
                    </button>
                </p>
            )}
        </div>
    );
}
