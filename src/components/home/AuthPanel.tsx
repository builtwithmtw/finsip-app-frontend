"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { DISPLAY } from "@/utils/typography";

/**
 * The sign-in / create-account form that shares the home page with the pitch.
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
    const { signIn, signUp, isAuthenticated, user, loading } = useAuth();
    const router = useRouter();

    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const signUpPaused = false;

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
        if (/rate limit|too many requests/i.test(raw)) return "Too many attempts. Please wait a moment and try again.";
        if (/fetch|network/i.test(raw)) return "Could not reach the server. Check your connection.";

        return raw || code || "Something went wrong. Please try again.";
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

    return (
        <div className="w-full max-w-md animate-in fade-in duration-500">
            <h2
                className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-slate-900"
                style={DISPLAY}
            >
                {isRegisterMode ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                {isRegisterMode
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

                <div className="mt-6">
                    <label htmlFor="password" className={labelClass} style={DISPLAY}>
                        Password
                    </label>
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
                            {isRegisterMode ? "Create Account" : "Sign In"}
                            <ArrowRight size={15} />
                        </>
                    )}
                </button>
            </form>

            {/* A sentence rather than a segmented control: there are two modes, one of
                them is the answer 95% of the time, and the other only needs to be
                findable. */}
            {signUpPaused ? null : (
                <p className="mt-7 text-center text-[15px] text-slate-500">
                    {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegisterMode((m) => !m);
                            setFormError(null);
                        }}
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900"
                    >
                        {isRegisterMode ? "Sign in" : "Create one"}
                    </button>
                </p>
            )}
        </div>
    );
}
