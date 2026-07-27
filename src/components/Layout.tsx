"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useConfirm } from '../context/ConfirmContext';
import { LayoutDashboard, Calendar, Landmark, LogOut, Table2, Activity, RefreshCw, UserX, Eye, EyeOff, PieChart, Moon, Clock, Star } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useProxy } from '../context/ProxyContext';
import { useAuth } from '../context/AuthContext';
import { usePrivacy, useCurrency } from '../context/PrivacyContext';
import { getInitials } from '../utils/formatters';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';
import { getPsxMarketState } from '../utils/marketSchedule';
import clsx from 'clsx';

const navItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/live', label: 'Live Portfolio', icon: Landmark },
    { path: '/entry', label: 'Monthly Entry', icon: Calendar },
    { path: '/ledger', label: 'Transaction Ledger', icon: Table2 },
    { path: '/allocation', label: 'Allocation', icon: PieChart },
    { path: '/watchlist', label: 'Watchlist', icon: Star },
];

/* ---- Worth panel typography -------------------------------------------------
 * Space Grotesk and JetBrains Mono are already loaded app-wide by next/font as
 * bare CSS variables; globals.css only binds them inside `.screener-root`, so the
 * panel reaches for them directly. Labels get the geometric display face, every
 * figure gets mono so digits hold their column as prices tick. */
const DISPLAY = { fontFamily: 'var(--font-heading), sans-serif' } as const;
const NUMERIC = { fontFamily: 'var(--font-mono), ui-monospace, monospace' } as const;

// "Rs 1,234" -> ["Rs", "1,234"], so the symbol can sit small and dim beside the
// number instead of competing with it. The privacy mask has no symbol to peel off.
const splitAmount = (formatted: string): [string | null, string] => {
    const match = formatted.match(/^Rs\s*(.*)$/);
    return match ? ['Rs', match[1]] : [null, formatted];
};

const Amount: React.FC<{ value: string; size?: string; className?: string }> = ({
    value,
    size = 'text-[17px]',
    className,
}) => {
    const [symbol, figure] = splitAmount(value);
    return (
        <span className={clsx('flex items-baseline gap-1', className)}>
            {symbol && (
                <span className="text-[9px] font-medium text-current opacity-45" style={DISPLAY}>
                    {symbol}
                </span>
            )}
            <span className={clsx(size, 'font-semibold leading-none tracking-tight tabular-nums')} style={NUMERIC}>
                {figure}
            </span>
        </span>
    );
};

// Micro-label stacked over its figure — reads as an instrument panel rather than a
// sentence, and lets each metric keep a fixed column as values change width. A short
// accent tick keys the label to its metric so the row scans by colour, not by reading.
const Metric: React.FC<{ label: string; accent: string; children: React.ReactNode }> = ({
    label,
    accent,
    children,
}) => (
    <div className="flex shrink-0 flex-col gap-2">
        <span className="flex items-center gap-1.5">
            <span aria-hidden className={clsx('h-2 w-0.5 rounded-full', accent)} />
            <span
                className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-300"
                style={DISPLAY}
            >
                {label}
            </span>
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
    const { transactions, livePrices, isMarketLive, marketLoading, selectedMonth, setSelectedMonth } = usePortfolio();
    const { selectedProxy, setShowModal, retryFetch } = useProxy();
    const { signOut, user } = useAuth();
    const { hidden, toggleHidden } = usePrivacy();
    const formatCurrency = useCurrency();
    const { confirm } = useConfirm();
    const pathname = usePathname();
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);
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
    }, [pathname]);

    // Unpriced symbols are held at cost inside summarizeLive, so a gap in the feed can no
    // longer shrink the portfolio or report the missing position's whole cost as a loss.
    const { totalValue: totalMarketValue, totalCost: totalInvestedCost, totalPL: netChange } = useMemo(
        () => summarizeLive(computeLiveHoldings(transactions, livePrices)),
        [livePrices, transactions]
    );

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
                            it already names the link. */}
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 shrink-0 rounded-lg transition-opacity hover:opacity-70"
                        >
                            <img src="/logo.svg" alt="" className="w-9 h-9 rounded-lg shrink-0" />
                            {/* Wordmark and tagline share one optical block: the tagline is letter-spaced
                                to sit flush with the right edge of FINSIP above it. */}
                            <div className="flex flex-col justify-center leading-none">
                                <span className="text-lg font-black text-slate-900 tracking-tight leading-none">FINSIP</span>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.28em] leading-none mt-1">
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
                                    <Metric label="Portfolio Worth" accent="bg-sky-400">
                                        <Amount value={formatCurrency(Math.round(displayWorth))} className="text-white" />
                                    </Metric>

                                    <Rule />

                                    <Metric label="Total Cost" accent="bg-slate-600">
                                        <Amount
                                            value={formatCurrency(Math.round(totalInvestedCost))}
                                            size="text-[15px]"
                                            className="text-slate-300"
                                        />
                                    </Metric>

                                    {hasValuation && (
                                        <>
                                            <Rule />
                                            <Metric
                                                label="Net Change"
                                                accent={netChange >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}
                                            >
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

                                    {/* One readout carries both facts: the PSX schedule (Market Open / Closed /
                                        Pre-Open / Post-Close) and, while Open, whether the feed is actually
                                        streaming ("Live") or has stalled ("Static"). Outside Open hours the
                                        schedule label wins — there's nothing live to show. No chip fill here;
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
                                    ) : marketState.phase === 'closed' ? (
                                        <span className="flex shrink-0 items-center gap-2 text-slate-400">
                                            <Moon size={11} className="fill-slate-500/30 text-slate-500" />
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={DISPLAY}>
                                                Market Closed
                                            </span>
                                        </span>
                                    ) : (
                                        // Pre-Open / Post-Close: market's in session but not trading yet — amber, gently pulsing.
                                        <span className="flex shrink-0 items-center gap-2 text-amber-400">
                                            <Clock size={11} className="animate-pulse" />
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={DISPLAY}>
                                                {marketState.label}
                                            </span>
                                        </span>
                                    )}

                                    {/* Feed is down while the market is Open: it retries on its own every few
                                        seconds, but offer a manual nudge too. When the market is closed a dead
                                        feed is expected, so we don't nag with a Retry button. */}
                                    {marketState.isOpen && !isMarketLive && (
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

                        {/* Feed status + gateway + lock */}
                        <div className="flex items-center justify-end gap-3">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 lg:px-3 lg:py-2 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer transition-colors"
                            />

                            {/* Gateway picker and manual refresh stay wired up, just hidden from the nav bar. */}
                            <div className="hidden items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm">
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="px-3 py-1.5 hover:bg-slate-50 rounded-md flex flex-col items-start transition-all group"
                                >
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Gateway</span>
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1.5">
                                        {selectedProxy.name}
                                        <Activity size={10} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </span>
                                </button>
                                <div className="w-px h-7 bg-slate-100" />
                                <button
                                    onClick={() => retryFetch()}
                                    className="p-2 hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 rounded-md transition-all active:rotate-180 duration-500"
                                    title="Refresh live feed"
                                >
                                    <Activity size={16} />
                                </button>
                            </div>

                            {/* Stays out of the menu on purpose: hiding amounts is a panic
                                action and has to be one click away. */}
                            <button
                                onClick={toggleHidden}
                                title={hidden ? 'Show amounts (Shift+H)' : 'Hide amounts (Shift+H)'}
                                aria-pressed={hidden}
                                className={clsx(
                                    "p-2 rounded-lg transition-all",
                                    hidden
                                        ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                                        : "text-slate-300 hover:text-slate-700 hover:bg-slate-100"
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
                                    className={clsx(
                                        "w-8 h-8 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-tight select-none transition-all",
                                        "hover:ring-4 hover:ring-slate-900/10",
                                        menuOpen && "ring-4 ring-slate-900/10"
                                    )}
                                >
                                    {getInitials(user?.email)}
                                </button>

                                {menuOpen && (
                                    <div
                                        role="menu"
                                        className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl border border-slate-100 shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                                    >
                                        <div className="px-4 py-3 border-b border-slate-50">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Signed in as</span>
                                            {/* Local part only -- the domain is noise you already know. */}
                                            <span className="text-xs font-bold text-slate-900 break-all">
                                                {user?.email?.split('@')[0] ?? '—'}
                                            </span>
                                        </div>

                                        <button
                                            role="menuitem"
                                            onClick={() => { setMenuOpen(false); handleDeleteAccount(); }}
                                            className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-600 hover:text-white transition-colors"
                                        >
                                            <UserX size={14} />
                                            Delete Account
                                        </button>

                                        <button
                                            role="menuitem"
                                            onClick={() => { setMenuOpen(false); signOut(); }}
                                            className="w-full flex items-center gap-2.5 px-4 py-3 border-t border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
                    {/* Tab Navigation */}
                    <nav className="shrink-0 flex justify-start lg:justify-center gap-1 border-b border-slate-200 overflow-x-auto overflow-y-hidden scrollbar-none">
                        {navItems.map((item) => {
                            // NavLink's isActive render-prop has no App Router equivalent;
                            // every tab is a leaf route, so an exact match is what `end` meant.
                            const isActive = pathname === item.path;

                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={clsx(
                                        "group relative flex items-center gap-1.5 px-3 lg:px-4 lg:gap-2 pt-2 pb-3 -mb-px rounded-t-lg",
                                        "text-[10px] lg:text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors duration-200",
                                        isActive
                                            ? "text-blue-600"
                                            : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/70"
                                    )}
                                >
                                    <item.icon
                                        size={15}
                                        className={clsx(
                                            "transition-transform duration-200 group-hover:scale-110",
                                            isActive ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500"
                                        )}
                                    />
                                    <span>{item.label}</span>
                                    <span
                                        className={clsx(
                                            "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all duration-200",
                                            isActive ? "bg-blue-600 opacity-100" : "bg-slate-300 opacity-0 group-hover:opacity-100"
                                        )}
                                    />
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide-auto animate-in fade-in duration-300">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;