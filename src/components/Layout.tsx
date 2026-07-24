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
    const displayWorth = isLive ? totalMarketValue : totalInvestedCost;

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

                        {/* Worth */}
                        <div className="order-last w-full overflow-x-auto scrollbar-none flex items-center gap-3 bg-slate-900 px-3 py-2 rounded-lg shadow-sm lg:order-none lg:w-auto lg:gap-5 lg:pl-5 lg:pr-3 lg:py-2.5">
                            {marketLoading ? (
                                <div className="flex items-center gap-2.5 py-0.5">
                                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                        Fetching Live Feed
                                    </span>
                                </div>
                            ) : (
                            <>
                            <div className="flex items-baseline gap-2.5 shrink-0">
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Portfolio Worth</span>
                                <span className="text-base font-black text-white leading-none tracking-tight">
                                    {formatCurrency(displayWorth).split('.')[0]}
                                </span>
                            </div>

                            <div className="flex items-baseline gap-2.5 border-l border-white/10 pl-3 lg:pl-5 shrink-0">
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Total Cost</span>
                                <span className="text-base font-black text-white leading-none tracking-tight">
                                    {formatCurrency(totalInvestedCost).split('.')[0]}
                                </span>
                            </div>

                            {isLive && (
                                <div className="flex items-baseline gap-2.5 border-l border-white/10 pl-3 lg:pl-5 shrink-0">
                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Net Change</span>
                                    <span className={clsx(
                                        "text-base font-black leading-none tracking-tight",
                                        netChange >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {netChange >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netChange)).split('.')[0]}
                                    </span>
                                    <span className={clsx(
                                        "text-[10px] font-black px-2 py-0.5 rounded-lg",
                                        netChange >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                    )}>
                                        {totalInvestedCost > 0 ? (netChange / totalInvestedCost * 100).toFixed(2) : '0.00'}%
                                    </span>
                                </div>
                            )}

                            {/* One chip carries both facts: the PSX schedule (Market Open / Closed /
                                Pre-Open / Post-Close) and, while Open, whether the feed is actually
                                streaming ("Live") or has stalled ("Static"). Outside Open hours the
                                schedule label wins — there's nothing live to show. */}
                            {marketState.isOpen ? (
                                <div className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-500 shrink-0",
                                    isLive ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-500/10 border-slate-500/20"
                                )}>
                                    <span className={clsx("w-1.5 h-1.5 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-500")} />
                                    <span className={clsx("text-[9px] font-black tracking-widest uppercase", isLive ? "text-emerald-500" : "text-slate-500")}>
                                        {isLive ? 'Live' : 'Static'}
                                    </span>
                                </div>
                            ) : marketState.phase === 'closed' ? (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 shrink-0">
                                    <Moon size={11} className="text-slate-300 fill-slate-300/30" />
                                    <span className="text-[9px] font-black tracking-widest uppercase text-slate-200">
                                        Market Closed
                                    </span>
                                </div>
                            ) : (
                                // Pre-Open / Post-Close: market's in session but not trading yet — amber, gently pulsing.
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 shrink-0">
                                    <Clock size={11} className="text-amber-400 animate-pulse" />
                                    <span className="text-[9px] font-black tracking-widest uppercase text-amber-400">
                                        {marketState.label}
                                    </span>
                                </div>
                            )}

                            {/* Feed is down while the market is Open: it retries on its own every few
                                seconds, but offer a manual nudge too. When the market is closed a dead
                                feed is expected, so we don't nag with a Retry button. */}
                            {marketState.isOpen && !isMarketLive && (
                                <button
                                    onClick={() => retryFetch()}
                                    title="Retry live feed"
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors group"
                                >
                                    <RefreshCw size={11} className="group-active:rotate-180 transition-transform duration-500" />
                                    <span className="text-[9px] font-black tracking-widest uppercase">Retry</span>
                                </button>
                            )}
                            </>
                            )}
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