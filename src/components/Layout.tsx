"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useConfirm } from '../context/ConfirmContext';
import { LayoutDashboard, Calendar, Landmark, LogOut, Table2, RefreshCw, UserX, Eye, EyeOff, PieChart, Moon, Star, Search, SlidersHorizontal, UserRound, Users } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useProxy } from '../context/ProxyContext';
import { useAuth } from '../context/AuthContext';
import { usePrivacy, useCurrency } from '../context/PrivacyContext';
import { useSettings } from '../context/SettingsContext';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { Avatar } from './Avatar';
import MonthPicker from './MonthPicker';
import EntryDatePicker from './EntryDatePicker';
import GlobalSearch from './GlobalSearch';
import { getInitials, formatCompactCurrency } from '../utils/formatters';
import { isAdmin } from '../lib/admins';
import { VerifiedBadge } from './VerifiedBadge';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';
import { getPsxMarketState } from '../utils/marketSchedule';
import { DISPLAY, NUMERIC, WORDMARK } from '../utils/typography';
import { Amount } from './Amount';
import clsx from 'clsx';

const baseNavItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/live', label: 'Live Portfolio', icon: Landmark },
    { path: '/entry', label: 'Monthly Entry', icon: Calendar },
    { path: '/ledger', label: 'Ledger', icon: Table2 },
    { path: '/allocation', label: 'Allocation', icon: PieChart },
    { path: '/watchlist', label: 'Watchlist', icon: Star },
];

// The one tab that isn't about your own portfolio, and the only one that isn't
// always there. Hiding it is presentation, not protection -- the RPCs it reads
// refuse a non-admin regardless of what the client chooses to draw.
const peersNavItem = { path: '/peers', label: 'Peers', icon: Users };

// Micro-label stacked over its figure — reads as an instrument panel rather than a
// sentence, and lets each metric keep a fixed column as values change width.
const Metric: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex shrink-0 flex-col gap-2">
        <span
            className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-300"
            style={DISPLAY}
        >
            {label}
        </span>
        <div className="flex items-baseline gap-2">{children}</div>
    </div>
);

// Hairline that fades out at both ends, so the separator never reads as a hard edge.
const Rule: React.FC = () => (
    <span aria-hidden className="h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
);

// Took its children from <Outlet /> under react-router; the App Router hands the
// active page in as `children` from the (app) route-group layout instead.
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { transactions, livePrices, isMarketLive, marketLoading, consecutiveFailures, selectedMonth, setSelectedMonth } = usePortfolio();
    const { retryFetch } = useProxy();
    const { refreshAll, refreshing } = useAppRefresh();
    const { signOut, user } = useAuth();
    const { hidden, toggleHidden } = usePrivacy();
    const { compactNavAmounts, displayName, avatarUrl } = useSettings();
    const formatCurrency = useCurrency();
    const { confirm } = useConfirm();
    const pathname = usePathname();
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);

    // Drives the rail, the document title and the Left/Right tab walk alike, so
    // an account without the Peers tab never steps onto it with the keyboard.
    const navItems = useMemo(
        () => isAdmin(user?.email) ? [...baseNavItems, peersNavItem] : baseNavItems,
        [user?.email]
    );

    // Lifted out of GlobalSearch so the nav icon and Ctrl+K drive the one overlay.
    const [searchOpen, setSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // PSX Regular Market state, re-derived on a timer so the chip flips at the
    // schedule's boundaries (e.g. Open at 09:32) without a page reload.
    const [marketState, setMarketState] = useState(() => getPsxMarketState());
    useEffect(() => {
        const tick = () => setMarketState(getPsxMarketState());
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;

        const onPointerDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    const handleDeleteAccount = async () => {
        const isConfirmed = await confirm({
            title: 'Delete Account',
            message: 'This permanently deletes your account and every transaction in it. This cannot be undone. Continue?',
            variant: 'danger',
            confirmText: 'Continue',
            cancelText: 'Cancel'
        });

        if (isConfirmed) router.push('/delete-account');
    };

    useEffect(() => {
        const currentNav = navItems.find(item => item.path === pathname);
        document.title = currentNav ? `${currentNav.label} | FINSIP` : 'FINSIP';
    }, [pathname, navItems]);

    /**
     * Left/Right step through the tabs in nav-bar order, wrapping at both ends.
     *
     * Worth having now that a tab switch costs nothing: the data for all six is
     * already in memory, so this walks the app rather than firing six loads.
     *
     * Three things it deliberately stays out of the way of:
     *  - typing, including the month field in this very bar, where Left/Right
     *    move the caret between day/month segments;
     *  - modifier chords, so Cmd/Alt+Left is still browser Back;
     *  - an open modal -- every one of them is a `fixed inset-0` overlay that
     *    unmounts when closed, and switching tabs out from under a confirm
     *    prompt would strand it over the next page.
     */
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

            const target = e.target as HTMLElement | null;
            const isTyping = target?.isContentEditable
                || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
            if (isTyping) return;

            if (document.querySelector('.fixed.inset-0')) return;

            const current = navItems.findIndex(item => item.path === pathname);
            // On a page that isn't one of the tabs (nothing routes there today,
            // but /delete-account is one import away): step in from the start
            // rather than from -1, which would land on the last tab going right.
            const step = e.key === 'ArrowRight' ? 1 : -1;
            const next = current === -1
                ? (step === 1 ? 0 : navItems.length - 1)
                : (current + step + navItems.length) % navItems.length;

            e.preventDefault();
            router.push(navItems[next].path);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [pathname, router, navItems]);

    // Unpriced symbols are held at cost inside summarizeLive, so a gap in the feed can no
    // longer shrink the portfolio or report the missing position's whole cost as a loss.
    const { totalValue: totalMarketValue, totalCost: totalInvestedCost, totalPL: netChange } = useMemo(
        () => summarizeLive(computeLiveHoldings(transactions, livePrices)),
        [livePrices, transactions]
    );

    /**
     * Worth and Cost, abbreviated -- "Rs 272k", "Rs 1.2M".
     *
     * Only these two, and only here. They are the widest figures in the app sitting in
     * the narrowest strip it has, and in the bar they are a headline rather than a
     * reading anyone acts on -- the exact number is a tab away on Live Portfolio. The
     * Change figure beside them stays in full: it is small enough not to need this, and
     * abbreviating a move to "Rs 1k" would round away the thing being watched.
     *
     * Routed through the privacy formatter first, so hiding amounts still hides them --
     * a compact figure is still a figure.
     *
     * Switched off on the Settings page, where the whole figure comes back.
     */
    const headline = (value: number) => {
        if (hidden || !compactNavAmounts) return formatCurrency(Math.round(value));
        return formatCompactCurrency(Math.round(value));
    };

    // Prices only truly move while the market is Open; outside that window the feed
    // (if it responds at all) is just the last close, so we don't badge it "Live".
    const isLive = marketState.isOpen && isMarketLive && totalMarketValue > 0;

    // Worth is a fact about the portfolio, not about the market's opening hours: once we
    // have any valuation it stands, closed or not (outside Open it's the last close, which
    // is still what the holdings are worth). Cost basis only stands in when the feed has
    // given us nothing at all. Unpriced symbols are already held at cost inside
    // summarizeLive, so totalMarketValue never understates the portfolio.
    const hasValuation = totalMarketValue > 0;
    const displayWorth = hasValuation ? totalMarketValue : totalInvestedCost;

    return (
        <div className="h-screen overflow-hidden bg-[#F8FAFC] font-sans flex flex-col">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-100 z-50 shrink-0">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
                    {/* Three columns so the worth pill sits dead centre regardless of what
                        the side columns contain. */}
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
                        {/* The mark is the way back out to the public site, as it is on the
                            screener's own header. `alt` is empty because the wordmark beside
                            it already names the link.

                            `justify-self-start` is what keeps the link the width of the mark.
                            As a grid item it otherwise stretches to fill its 1fr column, which
                            made the whole left third of the bar -- all the empty space beside
                            the wordmark, right up to the worth panel -- a link to the public
                            site. `shrink-0` does not prevent that: it governs flex shrinking,
                            not grid stretching. */}
                        <Link
                            href="/"
                            className="flex w-fit items-center gap-1.5 shrink-0 justify-self-start rounded-lg transition-opacity hover:opacity-70"
                        >
                            <img src="/logo.svg" alt="" className="w-9 h-9 rounded-lg shrink-0" />
                            {/* Wordmark and tagline share one optical block. The mark is set in the
                                mono face the prices use -- an instrument label rather than a
                                logotype, which is the register the rest of this bar is already in.
                                Both are tracked in rather than out: the old wide-spaced tagline was
                                sized to fill the mark's width, so it takes a point back now that it
                                no longer has to stretch. */}
                            <div className="flex flex-col gap-0.5 justify-center leading-none">
                                <span
                                    className="text-[17px] font-bold leading-none tracking-[-0.03em] text-slate-900"
                                    style={WORDMARK}
                                >
                                    FINSIP
                                </span>
                                <span
                                    className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-[-0.02em] text-slate-400"
                                    style={DISPLAY}
                                >
                                    SIP Tracker
                                </span>
                            </div>
                        </Link>

                        {/* Worth — one dark glass slab. Depth comes from a corner tint and two
                            hairlines rather than from borders or heavy fills, so the figures are
                            the only thing with real contrast on it. */}
                        <div className="order-last w-full lg:order-none lg:w-auto">
                            <div className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_16px_40px_-24px_rgba(2,6,23,0.9)]">
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_130%_at_0%_0%,rgba(56,189,248,0.13),transparent_55%)]"
                                />
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                                />

                                <div className="relative flex items-center gap-4 overflow-x-auto scrollbar-none px-4 py-2.5 lg:gap-5 lg:px-5">
                                    {marketLoading ? (
                                        <div className="flex items-center gap-3 py-1.5">
                                            <span className="relative h-3.5 w-3.5 shrink-0">
                                                <span className="absolute inset-0 rounded-full border border-white/10" />
                                                <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-sky-400" />
                                            </span>
                                            <span
                                                className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300"
                                                style={DISPLAY}
                                            >
                                                Syncing Feed
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <Metric label="Worth">
                                                <Amount value={headline(displayWorth)} className="text-white" bare roll />
                                            </Metric>

                                            <Rule />

                                            <Metric label="Cost">
                                                <Amount
                                                    value={headline(totalInvestedCost)}
                                                    size="text-[15px]"
                                                    className="text-slate-300"
                                                    bare
                                                    roll
                                                />
                                            </Metric>

                                            {hasValuation && (
                                                <>
                                                    <Rule />
                                                    <Metric label="Change">
                                                        <span className={clsx(
                                                            "flex items-baseline gap-1.5",
                                                            netChange >= 0 ? "text-emerald-400" : "text-rose-400"
                                                        )}>
                                                            <span className="text-[9px] leading-none" style={NUMERIC}>
                                                                {netChange >= 0 ? '▲' : '▼'}
                                                            </span>
                                                            <Amount
                                                                value={formatCurrency(Math.round(Math.abs(netChange)))}
                                                                size="text-[15px]"
                                                                bare
                                                                roll
                                                            />
                                                        </span>
                                                        <span
                                                            className={clsx(
                                                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
                                                                netChange >= 0
                                                                    ? "bg-emerald-400/10 text-emerald-400"
                                                                    : "bg-rose-400/10 text-rose-400"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {totalInvestedCost > 0
                                                                ? `${netChange >= 0 ? '+' : '−'}${Math.abs(netChange / totalInvestedCost * 100).toFixed(2)}`
                                                                : '0.00'}%
                                                        </span>
                                                    </Metric>
                                                </>
                                            )}

                                            <Rule />

                                            {/* One readout carries both facts: the PSX schedule (Market Open /
                                        Closed) and, while Open, whether the feed is actually streaming
                                        ("Live") or has stalled ("Static"). Outside Open hours the schedule
                                        label wins — there's nothing live to show. No chip fill here;
                                        the dot and the colour do the work. */}
                                            {marketState.isOpen ? (
                                                <span className="flex shrink-0 items-center gap-2">
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        {isLive && (
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                        )}
                                                        <span className={clsx(
                                                            "relative inline-flex h-1.5 w-1.5 rounded-full",
                                                            isLive ? "bg-emerald-400" : "bg-slate-500"
                                                        )} />
                                                    </span>
                                                    <span
                                                        className={clsx(
                                                            "text-[10px] font-semibold uppercase tracking-[0.18em]",
                                                            isLive ? "text-emerald-400" : "text-slate-400"
                                                        )}
                                                        style={DISPLAY}
                                                    >
                                                        {isLive ? 'Live' : 'Static'}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="flex shrink-0 items-center gap-2 text-slate-400">
                                                    <Moon size={11} className="fill-slate-500/30 text-slate-500" />
                                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={DISPLAY}>
                                                        {marketState.label}
                                                    </span>
                                                </span>
                                            )}

                                            {/* Feed is down while the market is Open: it retries on its own every few
                                        seconds, so we stay quiet through the first couple of misses and only
                                        offer a manual nudge once it has failed repeatedly. When the market is
                                        closed a dead feed is expected, so no Retry button at all. */}
                                            {marketState.isOpen && !isMarketLive && consecutiveFailures >= 3 && (
                                                <button
                                                    onClick={() => retryFetch()}
                                                    title="Retry live feed"
                                                    className="group flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-amber-400 ring-1 ring-amber-400/20 transition-colors hover:bg-amber-400/10"
                                                >
                                                    <RefreshCw size={11} className="transition-transform duration-500 group-active:rotate-180" />
                                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={DISPLAY}>
                                                        Retry
                                                    </span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Date pickers, refresh, the privacy lock and the account menu. */}
                        <div className="flex items-center justify-end gap-3">
                            {/* Day and month, flush against each other so they read as one
                                date -- "21 Aug 2026" -- rather than two controls that
                                happen to be adjacent. The wrapper carries the slab's own
                                background, which fills the notch the two rounded corners
                                would otherwise leave at the seam; each chip keeps its own
                                ring, and the pair of them at the join reads as the divider
                                between the day and the month. */}
                            <div className="flex shrink-0 items-center rounded-xl">
                                <EntryDatePicker />
                                <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
                            </div>

                            {/* The one way to get current numbers. Nothing in the app
                                refetches on its own any more -- that is what makes tab
                                switching instant -- so this has to be reachable from
                                every screen, not buried in the menu. */}
                            <button
                                onClick={() => refreshAll()}
                                disabled={refreshing}
                                title={refreshing ? 'Refreshing…' : 'Refresh all data'}
                                className={clsx(
                                    "rounded-xl p-2 ring-1 ring-slate-900/5 transition-all",
                                    refreshing
                                        ? "text-sky-500"
                                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <RefreshCw size={15} className={clsx(refreshing && "animate-spin")} />
                            </button>

                            {/* The shortcut is the fast way in, but a chord nobody has been
                                told about is invisible; the icon is what makes the feature
                                findable at all. Both drive the same overlay. */}
                            <button
                                onClick={() => setSearchOpen(true)}
                                title="Search everything (Ctrl+K)"
                                aria-label="Search everything"
                                className="rounded-xl p-2 text-slate-400 ring-1 ring-slate-900/5 transition-all hover:bg-slate-100 hover:text-slate-900"
                            >
                                <Search size={15} />
                            </button>

                            {/* Stays out of the menu on purpose: hiding amounts is a panic
                                action and has to be one click away. */}
                            <button
                                onClick={toggleHidden}
                                title={hidden ? 'Show amounts (Shift+H)' : 'Hide amounts (Shift+H)'}
                                aria-pressed={hidden}
                                className={clsx(
                                    "rounded-xl p-2 transition-all",
                                    hidden
                                        ? "bg-slate-900 text-sky-400 ring-1 ring-slate-900/10"
                                        : "text-slate-400 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>

                            <div ref={menuRef} className="relative">
                                <button
                                    onClick={() => setMenuOpen(open => !open)}
                                    title={user?.email ?? undefined}
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                    style={DISPLAY}
                                    className={clsx(
                                        "flex h-9 w-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-xl bg-slate-900",
                                        "text-[11px] font-semibold tracking-[0.06em] text-white transition-all",
                                        "hover:ring-4 hover:ring-slate-900/10",
                                        menuOpen && "ring-4 ring-slate-900/10"
                                    )}
                                >
                                    {/* An uploaded picture if there is one, otherwise the mark
                                        generated from the address -- and only initials for a
                                        session with no email at all. */}
                                    {avatarUrl || user?.email
                                        ? <Avatar seed={user?.email} src={avatarUrl} alt="" className="h-full w-full" />
                                        : getInitials(user?.email)}
                                </button>

                                {menuOpen && (
                                    <div
                                        role="menu"
                                        className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-24px_rgba(2,6,23,0.35)] ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-top-1 duration-150"
                                    >
                                        <div className="border-b border-slate-100 px-4 py-3.5">
                                            <span
                                                className="mb-2 block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                                                style={DISPLAY}
                                            >
                                                Signed in as
                                            </span>
                                            {/* The chosen name leads; without one it falls back to
                                                the email's local part, the domain being noise you
                                                already know. */}
                                            <span className="flex items-start gap-0.5">
                                                <span className="break-all text-xs font-semibold text-slate-900">
                                                    {displayName?.trim() || user?.email?.split('@')[0] || '—'}
                                                </span>
                                                {isAdmin(user?.email) && (
                                                    <VerifiedBadge
                                                        size={14}
                                                        title="Verified admin"
                                                        className="mt-px text-emerald-500"
                                                    />
                                                )}
                                            </span>
                                            {/* The address stays visible whenever a name is
                                                covering it -- which account you are in is not
                                                something a display name should be able to hide. */}
                                            {displayName?.trim() && (
                                                <span className="mt-1 block break-all text-[11px] font-medium text-slate-400">
                                                    {user?.email}
                                                </span>
                                            )}
                                        </div>

                                        {/* Profile above Settings: who you are, then how the
                                            app draws itself. Both live here rather than in the
                                            tab rail -- the rail is the portfolio, and neither of
                                            these is part of reading it. */}
                                        <Link
                                            href="/profile"
                                            role="menuitem"
                                            onClick={() => setMenuOpen(false)}
                                            style={DISPLAY}
                                            className="flex w-full items-center gap-2.5 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            <UserRound size={14} />
                                            Profile
                                        </Link>

                                        <Link
                                            href="/settings"
                                            role="menuitem"
                                            onClick={() => setMenuOpen(false)}
                                            style={DISPLAY}
                                            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            <SlidersHorizontal size={14} />
                                            Settings
                                        </Link>

                                        <button
                                            role="menuitem"
                                            onClick={() => { setMenuOpen(false); handleDeleteAccount(); }}
                                            style={DISPLAY}
                                            className="flex w-full items-center gap-2.5 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600 transition-colors hover:bg-rose-600 hover:text-white"
                                        >
                                            <UserX size={14} />
                                            Delete Account
                                        </button>

                                        <button
                                            role="menuitem"
                                            onClick={() => { setMenuOpen(false); signOut(); }}
                                            style={DISPLAY}
                                            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            <LogOut size={14} />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 min-h-0 min-w-0 flex flex-col bg-[#F8FAFC]">
                <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10 py-3 lg:py-4 flex-1 min-h-0 w-full flex flex-col gap-3 lg:gap-4">
                    {/* Tab Navigation — a segmented rail rather than underlined tabs. The
                        active tab takes the dark slab the app already uses for its primary
                        actions, so where you are is unmistakable at a glance; the rest of
                        the rail stays quiet on a recessed track. */}
                    <nav className="shrink-0 self-start lg:self-center max-w-full overflow-x-auto overflow-y-hidden scrollbar-none">
                        <div className="inline-flex items-center gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
                            {navItems.map((item) => {
                                // NavLink's isActive render-prop has no App Router equivalent;
                                // every tab is a leaf route, so an exact match is what `end` meant.
                                const isActive = pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        style={DISPLAY}
                                        className={clsx(
                                            "group relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 lg:gap-2 lg:px-3.5",
                                            "text-[10px] font-semibold uppercase tracking-[0.14em] transition-all duration-200",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-[0_8px_18px_-10px_rgba(2,6,23,0.9)]"
                                                : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900"
                                        )}
                                    >
                                        {/* The seam that runs along every dark surface in the app,
                                            scaled down to a tab. */}
                                        {isActive && (
                                            <span
                                                aria-hidden
                                                className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                            />
                                        )}
                                        <item.icon
                                            size={14}
                                            className={clsx(
                                                "shrink-0 transition-colors",
                                                isActive ? "text-sky-400" : "text-slate-400 group-hover:text-slate-600"
                                            )}
                                        />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide-auto animate-in fade-in duration-300">
                        {children}
                    </div>
                </div>
            </main>

            {/* Mounted once for the whole signed-in app, and inert until Cmd/Ctrl+K.
                It lives here rather than on a page because it searches across all of
                them, and because the shortcut has to work wherever you are. */}
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
    );
};

export default Layout;