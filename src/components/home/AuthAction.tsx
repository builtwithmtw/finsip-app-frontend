"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/utils/formatters";

// Never resubscribes: the value it reports is constant per environment.
const noopSubscribe = () => () => {};

/**
 * False on the server and through the first client render, true after. The
 * useState+useEffect spelling of this trips react-hooks/set-state-in-effect.
 */
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * The landing header's one auth-dependent control: the way into the app, shown
 * as the user's initials once there is a user and as "Log in" when there isn't.
 *
 * It exists as its own client component so page.tsx can stay a server component
 * -- the header used to hardcode "Log in", which is all the server can honestly
 * say when the session lives in localStorage, and so signed-in visitors were
 * told to log in on a site they were already logged into.
 *
 * Both states point at /dashboard: ProtectedRoute renders the login form in
 * place there when signed out, so logging in lands on the portfolio.
 */
export function AuthAction() {
  const { isAuthenticated, loading, user } = useAuth();

  // The server renders this blind and the first client render has to agree with
  // it, so both show the placeholder; only once hydrated and resolved do we
  // commit to an answer. Branching on `loading` alone would not do -- it is
  // false on the server and true on the client whenever a session exists, which
  // is a hydration mismatch by construction.
  const hydrated = useHydrated();

  if (!hydrated || loading) {
    return <div className="size-8 rounded-full bg-white/5" aria-hidden />;
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        title={user?.email ?? undefined}
        aria-label="Open your portfolio"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-black tracking-tight text-white backdrop-blur transition-colors hover:border-white/20 hover:bg-white/10"
      >
        {getInitials(user?.email)}
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 backdrop-blur transition-colors hover:border-white/20 hover:text-white"
    >
      Log in
    </Link>
  );
}
