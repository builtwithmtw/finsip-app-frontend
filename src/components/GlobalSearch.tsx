"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, SearchX, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { useWatchlist } from '../hooks/useWatchlist';
import { computeLiveHoldings } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import TransactionDetailModal from './TransactionDetailModal';
import type { Transaction } from '../types';

/** Share counts are floats, so a fully sold position rarely lands on exactly 0. */
const EPSILON = 0.001;

/** How many holdings stand in as suggestions before anything has been typed. */
const DEFAULT_SUGGESTIONS = 5;

/** Mirrors the nav bar's own array. Kept here so a page is findable by name too. */
const PAGES = [
    { path: '/dashboard', label: 'Overview' },
    { path: '/live', label: 'Live Portfolio' },
    { path: '/entry', label: 'Monthly Entry' },
    { path: '/ledger', label: 'Ledger' },
    { path: '/allocation', label: 'Allocation' },
    { path: '/watchlist', label: 'Watchlist' },
];

interface SymbolHit {
    symbol: string;
    sector: string | null;
    /** Where in the app this symbol turns up. */
    held: boolean;
    watched: boolean;
    tracked: boolean;
    closed: boolean;
    shares: number;
    marketValue: number;
    profitLossPercentage: number;
    isPriced: boolean;
    transactions: Transaction[];
    months: number;
    /** Lower sorts first: exact, then prefix, then substring, then sector-only. */
    rank: number;
}

/** The micro-label that heads every group, with the accent tick the panels use. */
const GroupLabel: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
    <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span aria-hidden className="h-2.5 w-0.5 shrink-0 rounded-full bg-sky-500" />
        <span
            style={DISPLAY}
            className="text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
        >
            {children}
        </span>
        {typeof count === 'number' && (
            <span
                style={NUMERIC}
                className="text-[9px] font-semibold leading-none tabular-nums text-slate-300"
            >
                {count}
            </span>
        )}
    </div>
);

const Pill: React.FC<{ tone: 'sky' | 'amber' | 'slate' | 'rose'; children: React.ReactNode }> = ({
    tone,
    children,
}) => (
    <span
        style={DISPLAY}
        className={clsx(
            'rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] ring-1',
            tone === 'sky' && 'bg-sky-500/10 text-sky-600 ring-sky-500/15',
            tone === 'amber' && 'bg-amber-500/10 text-amber-600 ring-amber-500/15',
            tone === 'slate' && 'bg-slate-500/10 text-slate-500 ring-slate-500/15',
            tone === 'rose' && 'bg-rose-500/10 text-rose-600 ring-rose-500/15'
        )}
    >
        {children}
    </span>
);

/** A keycap, so the shortcuts read as keys rather than as words about keys. */
const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span
        style={DISPLAY}
        // Slate rather than white: the keycap sits on white in the search row and on a
        // tinted footer, and only the tinted fill reads on both.
        className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded bg-slate-100 px-1 text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-slate-400 ring-1 ring-slate-900/5"
    >
        {children}
    </span>
);

/**
 * One search across the whole signed-in app.
 *
 * Everything it reads is already in memory: the boot gate warms every source before the
 * shell renders and nothing refetches afterwards, so this is filtering over arrays the
 * app already holds -- no request, no debounce, no spinner, and it stays correct as the
 * ledger changes underneath it.
 *
 * The answer it gives is deliberately not a list of links. Typing PRL when you half
 * remember owning it should say *where PRL is* -- held, watched, tracked, closed, and
 * how many trades are behind it -- in one row, because that is the actual question. The
 * links are the follow-up: Enter opens every transaction for the symbol.
 *
 * Sectors match too, so "cement" finds the cement book without knowing its tickers.
 */
const GlobalSearch: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
    const router = useRouter();
    const formatCurrency = useCurrency();
    const { transactions, stocks, livePrices, realizedProfits } = usePortfolio();
    const { items: watchlist } = useWatchlist();

    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [detail, setDetail] = useState<SymbolHit | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const liveHoldings = useMemo(
        () => computeLiveHoldings(transactions, livePrices),
        [transactions, livePrices]
    );

    const { symbols, pages, suggesting } = useMemo(() => {
        const q = query.trim().toUpperCase();

        /*
         * Every symbol the app knows about, from wherever it knows it. A symbol bought
         * and fully exited years ago is still findable -- it exists in the ledger, and
         * "did I ever own this" is one of the questions being asked.
         */
        const sectors = new Map<string, string | null>();
        stocks.forEach((s) => sectors.set(s.symbol, s.sector));
        watchlist.forEach((w) => {
            if (!sectors.has(w.symbol)) sectors.set(w.symbol, w.sector);
        });
        transactions.forEach((t) => {
            if (t.symbol && !sectors.has(t.symbol)) sectors.set(t.symbol, null);
        });
        realizedProfits.forEach((r) => {
            if (r.symbol && !sectors.has(r.symbol)) sectors.set(r.symbol, null);
        });

        const trackedSet = new Set(stocks.map((s) => s.symbol));
        const watchedSet = new Set(watchlist.map((w) => w.symbol));
        const closedSet = new Set(realizedProfits.map((r) => r.symbol));

        const build = (symbol: string, sector: string | null, rank: number): SymbolHit => {
            const holding = liveHoldings.find((h) => h.symbol === symbol);
            const mine = transactions.filter((t) => t.symbol === symbol);
            const held = Boolean(holding && holding.totalShares > EPSILON);

            return {
                symbol,
                sector,
                held,
                watched: watchedSet.has(symbol),
                tracked: trackedSet.has(symbol),
                // Only worth saying once the position is actually gone; a part-sold
                // holding is still a holding.
                closed: closedSet.has(symbol) && !held,
                shares: holding?.totalShares ?? 0,
                marketValue: holding?.marketValue ?? 0,
                profitLossPercentage: holding?.profitLossPercentage ?? 0,
                isPriced: holding?.isPriced ?? false,
                transactions: mine,
                months: new Set(mine.map((t) => t.month)).size,
                rank,
            };
        };

        /*
         * Nothing typed yet: the biggest positions stand in. An empty palette that only
         * says "type something" wastes the one moment the reader is definitely looking
         * at it, and these are the rows most likely to be wanted anyway.
         */
        if (!q) {
            const top: SymbolHit[] = [];
            sectors.forEach((sector, symbol) => {
                const hit = build(symbol, sector, 0);
                if (hit.held) top.push(hit);
            });

            top.sort((a, b) => b.marketValue - a.marketValue);

            return {
                symbols: top.slice(0, DEFAULT_SUGGESTIONS),
                pages: [] as typeof PAGES,
                suggesting: true,
            };
        }

        const hits: SymbolHit[] = [];

        sectors.forEach((sector, symbol) => {
            const bySymbol = symbol.toUpperCase();
            const bySector = (sector ?? '').toUpperCase();

            // Rank decides the order; -1 means the query touched neither field.
            const rank = bySymbol === q ? 0
                : bySymbol.startsWith(q) ? 1
                    : bySymbol.includes(q) ? 2
                        : bySector.includes(q) ? 3
                            : -1;

            if (rank === -1) return;

            hits.push(build(symbol, sector, rank));
        });

        hits.sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            // Within a rank, what you own outranks what you only watch.
            if (a.held !== b.held) return a.held ? -1 : 1;
            if (a.marketValue !== b.marketValue) return b.marketValue - a.marketValue;
            return a.symbol.localeCompare(b.symbol);
        });

        return {
            symbols: hits.slice(0, 8),
            pages: PAGES.filter((p) => p.label.toUpperCase().includes(q)),
            suggesting: false,
        };
    }, [query, stocks, watchlist, transactions, realizedProfits, liveHoldings]);

    // One flat list is what the arrow keys walk, so the highlight crosses the group
    // boundary without either group having to know the other exists.
    const flat = useMemo(
        () => [
            ...symbols.map((s) => ({ kind: 'symbol' as const, hit: s })),
            ...pages.map((p) => ({ kind: 'page' as const, page: p })),
        ],
        [symbols, pages]
    );

    useEffect(() => setActive(0), [query]);

    const close = useCallback(() => {
        onOpenChange(false);
        setQuery('');
        setActive(0);
    }, [onOpenChange]);

    const choose = useCallback(
        (index: number) => {
            // Falls back to the first row rather than doing nothing: results can shrink
            // under a highlight that was valid a keystroke ago, and Enter going silently
            // dead is worse than Enter taking the top match -- which is what it was
            // going to be anyway.
            const item = flat[index] ?? flat[0];
            if (!item) return;

            if (item.kind === 'page') {
                router.push(item.page.path);
                close();
                return;
            }

            // A symbol with nothing behind it has no transactions to open, so the useful
            // move is to go where it does live rather than raise an empty modal.
            if (item.hit.transactions.length === 0) {
                router.push(item.hit.watched ? '/watchlist' : '/dashboard');
                close();
                return;
            }

            setDetail(item.hit);
            close();
        },
        [flat, router, close]
    );

    /*
     * Cmd/Ctrl+K opens it, the same chord every tool with a palette uses. Deliberately
     * not a bare key: `/` and `k` both belong to whatever field has focus, and the app
     * already spends Shift+H and the arrow keys on shortcuts that have to stay out of
     * typing's way.
     */
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                // Closing goes through `close` so the query is cleared the same way it is
                // on Esc -- toggling the flag alone would reopen on the last search.
                if (open) close();
                else onOpenChange(true);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // Re-bound when `open` changes: the handler reads it to decide which way to
        // toggle, and a listener bound once would close over the first value forever.
    }, [open, close, onOpenChange]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    // Keep the highlighted row in view when the arrows walk past the fold.
    useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector('[data-active="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (flat.length === 0) return;
            e.preventDefault();
            // Stopped here as well as prevented: the nav bar listens for the arrows on
            // `window` to step between tabs, and it must not do that under an open
            // search even though the overlay already blocks it.
            e.stopPropagation();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((prev) => (prev + step + flat.length) % flat.length);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            choose(active);
        }
    };

    const renderRow = (hit: SymbolHit, index: number) => {
        const isActive = active === index;
        const up = hit.profitLossPercentage >= 0;

        return (
            <button
                key={hit.symbol}
                type="button"
                data-active={isActive}
                onMouseMove={() => setActive((prev) => (prev === index ? prev : index))}
                onClick={() => choose(index)}
                className={clsx(
                    'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    isActive ? 'bg-slate-50 ring-1 ring-slate-900/5' : 'hover:bg-slate-50/60'
                )}
            >
                {/* The rail the holdings table uses on hover, here marking the row the
                    keyboard is on -- so the arrows and the pointer say the same thing. */}
                <span
                    aria-hidden
                    className={clsx(
                        'absolute inset-y-2 left-0 w-0.5 rounded-full bg-sky-500 transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0'
                    )}
                />

                {/* Monogram tile, tinted by where the symbol lives, so the list is
                    scannable by colour before a word of it is read. */}
                <span
                    aria-hidden
                    style={DISPLAY}
                    className={clsx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold uppercase leading-none tracking-[0.06em] ring-1',
                        hit.held
                            ? 'bg-slate-900 text-sky-400 ring-slate-900/10'
                            : hit.watched
                                ? 'bg-amber-500/10 text-amber-600 ring-amber-500/15'
                                : 'bg-slate-100 text-slate-400 ring-slate-900/5'
                    )}
                >
                    {hit.symbol.slice(0, 2)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <span
                            style={DISPLAY}
                            className="text-[12px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
                        >
                            {hit.symbol}
                        </span>

                        {/* Where it lives, which is the whole point of the row. */}
                        {hit.held && <Pill tone="sky">Portfolio</Pill>}
                        {hit.watched && <Pill tone="amber">Watchlist</Pill>}
                        {hit.closed && <Pill tone="rose">Closed</Pill>}
                        {hit.tracked && !hit.held && !hit.closed && <Pill tone="slate">Tracked</Pill>}
                    </span>

                    <span
                        style={DISPLAY}
                        className="truncate text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                    >
                        {[
                            hit.sector,
                            hit.transactions.length > 0
                                ? `${hit.transactions.length} ${hit.transactions.length === 1 ? 'trade' : 'trades'} · ${hit.months} ${hit.months === 1 ? 'month' : 'months'}`
                                : 'No trades yet',
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </span>

                {/* Only a held position has a value worth printing. An unpriced one is
                    held at cost upstream, so the figure is still true -- it is just not
                    a market price, and says so rather than posting a 0.00% move. */}
                {hit.held && (
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                            className="text-[12px] font-semibold leading-none tabular-nums text-slate-900"
                            style={NUMERIC}
                        >
                            {formatCurrency(Math.round(hit.marketValue))}
                        </span>

                        {hit.isPriced ? (
                            <span
                                style={NUMERIC}
                                className={clsx(
                                    'text-[10px] font-semibold leading-none tabular-nums',
                                    up ? 'text-emerald-600' : 'text-rose-600'
                                )}
                            >
                                {up ? '+' : '−'}
                                {Math.abs(hit.profitLossPercentage).toFixed(2)}%
                            </span>
                        ) : (
                            <span
                                style={DISPLAY}
                                className="text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            >
                                At Cost
                            </span>
                        )}
                    </span>
                )}
            </button>
        );
    };

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-150"
                    onMouseDown={close}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Search everything"
                        // The click that lands inside must not reach the backdrop above.
                        onMouseDown={(e) => e.stopPropagation()}
                        className="mx-auto mt-[9vh] flex max-h-[72vh] w-[92%] max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-32px_rgba(2,6,23,0.6)] ring-1 ring-slate-900/10 animate-in zoom-in-95 slide-in-from-top-2 duration-200"
                    >
                        {/* No box around the field, and no box inside that one either.
                            The overlay is already a card; drawing a second card in its
                            header and then letting the input draw a third was the whole
                            problem. What is left is one row -- glyph, text, keycap -- with
                            a hairline under it, and the panel's own edge doing the
                            containing.

                            The input's own chrome is killed inline rather than with
                            utilities because `globals.css` gives every element an outline
                            colour in its base layer (`* { outline-ring/50 }`), and an
                            inline style is the one thing that reliably beats it: that base
                            rule is what was painting a second rectangle around the text. */}
                        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-4">
                            <Search size={17} className="shrink-0 text-slate-400" />

                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onFieldKeyDown}
                                placeholder="Search symbols, sectors, pages…"
                                aria-label="Search everything"
                                style={{ outline: 'none', boxShadow: 'none' }}
                                className="w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[15px] font-medium tracking-[-0.01em] text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                            />

                            {/* Only once there is something to clear, so the row is not
                                carrying a dead control the whole time it is open. */}
                            {query !== '' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        inputRef.current?.focus();
                                    }}
                                    aria-label="Clear search"
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                >
                                    <X size={14} />
                                </button>
                            )}

                            <Key>Esc</Key>
                        </div>

                        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                            {flat.length === 0 ? (
                                <div className="flex flex-col items-center px-4 py-12 text-center">
                                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 ring-1 ring-slate-900/10">
                                        <SearchX size={18} />
                                    </span>
                                    <p
                                        style={DISPLAY}
                                        className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-900"
                                    >
                                        No match for “{query.trim()}”
                                    </p>
                                    <p className="mt-2.5 text-[11px] font-medium text-slate-400">
                                        Try a ticker, a sector, or the name of a tab.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {symbols.length > 0 && (
                                        <>
                                            <GroupLabel count={suggesting ? undefined : symbols.length}>
                                                {suggesting ? 'Top Holdings' : 'Symbols'}
                                            </GroupLabel>
                                            {symbols.map((hit, i) => renderRow(hit, i))}
                                        </>
                                    )}

                                    {pages.length > 0 && (
                                        <>
                                            <GroupLabel>Pages</GroupLabel>
                                            {pages.map((page, i) => {
                                                const index = symbols.length + i;
                                                const isActive = active === index;

                                                return (
                                                    <button
                                                        key={page.path}
                                                        type="button"
                                                        data-active={isActive}
                                                        onMouseMove={() => setActive((prev) => (prev === index ? prev : index))}
                                                        onClick={() => choose(index)}
                                                        style={DISPLAY}
                                                        className={clsx(
                                                            'relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                                                            isActive
                                                                ? 'bg-slate-50 text-slate-900 ring-1 ring-slate-900/5'
                                                                : 'text-slate-500 hover:bg-slate-50/60'
                                                        )}
                                                    >
                                                        <span
                                                            aria-hidden
                                                            className={clsx(
                                                                'absolute inset-y-2 left-0 w-0.5 rounded-full bg-sky-500 transition-opacity',
                                                                isActive ? 'opacity-100' : 'opacity-0'
                                                            )}
                                                        />
                                                        {page.label}
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                            <span
                                style={DISPLAY}
                                className="flex items-center gap-1.5 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            >
                                <Key><ArrowUp size={9} /></Key>
                                <Key><ArrowDown size={9} /></Key>
                                Move
                            </span>

                            <span
                                style={DISPLAY}
                                className="flex items-center gap-1.5 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            >
                                <Key><CornerDownLeft size={9} /></Key>
                                Open
                            </span>

                            <span
                                style={DISPLAY}
                                className="ml-auto text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-300"
                            >
                                FINSIP
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* The same modal the ledger opens a symbol with, so "every trade for this
                symbol" looks and behaves identically wherever it was asked for -- edits
                and deletes included. */}
            {detail && (
                <TransactionDetailModal
                    isOpen
                    onClose={() => setDetail(null)}
                    symbol={detail.symbol}
                    transactions={detail.transactions}
                />
            )}
        </>
    );
};

export default GlobalSearch;
