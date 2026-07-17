"use client";

import Link from "next/link";
import { LogIn, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * The standalone app's header, with ThemeToggle swapped for the way into FINSIP
 * (the app is light-only, so there is nothing left to toggle).
 *
 * Both states point at /dashboard: ProtectedRoute renders the login form in
 * place there when signed out, so logging in lands on the portfolio rather than
 * bouncing back to the screener.
 */
export function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 w-full max-w-350 items-center justify-center px-4 sm:px-6">
        {/* FINSIP's own mark, shared with the signed-in app's nav bar, so the
            homepage and the portfolio read as one product rather than two. */}
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-8 shrink-0 rounded-lg" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">FinSIP Screener</p>
            <p className="text-[11px] text-muted-foreground">
              Pakistan Stock Exchange
            </p>
          </div>
        </Link>

        <div className="absolute right-4 sm:right-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-accent"
          >
            {isAuthenticated ? (
              <>
                <LayoutDashboard className="size-3.5" />
                <span className="max-sm:hidden">Portfolio</span>
              </>
            ) : (
              <>
                <LogIn className="size-3.5" />
                <span className="max-sm:hidden">Log in</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
