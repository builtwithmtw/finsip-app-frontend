"use client";

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { computeLiveHoldings, summarizeLive, type LiveHolding } from '../utils/holdings';
import { formatMonth } from '../utils/formatters';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel } from './Panel';
import type { Peer } from '../types';

type SortDir = 'asc' | 'desc';
type View = 'positions' | 'transactions';

const HEAD = 'px-4 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';
const CELL = 'px-4 py-2 text-[12px] leading-5';

/** "Oct 2025" -- short enough for a narrow column, and unambiguous across years. */
const monthShort = (month: string): string => {
    try {
        return format(parseISO(`${month}-01`), 'MMM yyyy');
    } catch {
        return month;
    }
};

/** `null` for a row with no usable timestamp; only used for the "recorded on" tooltip. */
const entryDate = (createdAt?: string): string | null => {
    if (!createdAt) return null;
    try {
        return format(parseISO(createdAt), 'dd MMM yyyy');
    } catch {
        return null;
    }
};

/**
 * The same columns Live Portfolio reads, minus the ones that only make sense for
 * the account you are signed into. Price-derived columns return null for an
 * unpriced row so it sinks rather than sorting as a zero.
 */
const COLUMNS: {
    id: string;
    label: string;
    align: 'left' | 'right';
    numeric: boolean;
    get: (h: LiveHolding, d1: number | null) => number | string | null;
}[] = [
    { id: 'symbol', label: 'Symbol', align: 'left', numeric: false, get: h => h.symbol },
    { id: 'qty', label: 'Qty', align: 'right', numeric: true, get: h => h.totalShares },
    { id: 'avg', label: 'Avg', align: 'right', numeric: true, get: h => h.avgPrice },
    { id: 'live', label: 'Live', align: 'right', numeric: true, get: h => (h.isPriced ? h.currentPrice : null) },
    { id: 'd1', label: '1D', align: 'right', numeric: true, get: (_h, d1) => d1 },
    { id: 'invested', label: 'Invested', align: 'right', numeric: true, get: h => h.totalCostBasis },
    { id: 'value', label: 'Value', align: 'right', numeric: true, get: h => h.marketValue },
    { id: 'alloc', label: 'Alloc', align: 'right', numeric: true, get: h => h.marketValue },
    { id: 'pl', label: 'P/L', align: 'right', numeric: true, get: h => (h.isPriced ? h.profitLoss : null) },
    { id: 'plpct', label: '%', align: 'right', numeric: true, get: h => (h.isPriced ? h.profitLossPercentage : null) },
];

/**
 * A peer's live portfolio, priced against the feed this session is already
 * running.
 *
 * The prices are the market's, not the account's -- `PortfolioContext` publishes
 * one sweep for the whole app -- so a peer's book is valued off exactly the same
 * numbers as the admin's own, with no second fetch and nothing to fall out of
 * step. Everything else is derived from the peer's ledger by the shared
 * `utils/holdings.ts`, which is what keeps these figures identical in shape to
 * the ones on Live Portfolio.
 */
const PeerPortfolioModal: React.FC<{ peer: Peer; onClose: () => void }> = ({ peer, onClose }) => {
    const { livePrices, liveChanges } = usePortfolio();
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();

    const [sort, setSort] = useState<{ id: string; dir: SortDir }>({ id: 'value', dir: 'desc' });
    const [view, setView] = useState<View>('positions');
    const [query, setQuery] = useState('');

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const changeFor = (symbol: string): number | null => {
        const value = liveChanges[symbol];
        return Number.isFinite(value) ? value : null;
    };

    const holdings = useMemo(
        () => computeLiveHoldings(peer.transactions, livePrices),
        [peer.transactions, livePrices]
    );

    const totals = useMemo(() => summarizeLive(holdings), [holdings]);

    const sortedHoldings = useMemo(() => {
        const col = COLUMNS.find(c => c.id === sort.id);
        if (!col) return holdings;
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...holdings].sort((a, b) => {
            const av = col.get(a, changeFor(a.symbol));
            const bv = col.get(b, changeFor(b.symbol));
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return cmp * factor;
        });
    }, [holdings, sort, liveChanges]);

    /**
     * The peer's ledger as a ledger: every entry, newest first.
     *
     * Ordered on `month` rather than `createdAt`, the same call the app's own
     * Transaction Ledger makes -- `createdAt` is when the row was typed, so a
     * back-filled book has a year of trades all stamped with the one afternoon
     * they were entered. The month is the only date that describes the trade.
     */
    const ledger = useMemo(() =>
        peer.transactions
            .filter(t => t.shares > 0 && t.pricePerShare > 0)
            .slice()
            .sort((a, b) => {
                const byMonth = b.month.localeCompare(a.month);
                return byMonth !== 0 ? byMonth : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
            }),
        [peer.transactions]
    );

    // Symbol, side and month as they are written on screen -- "gcil", "sell" and
    // "august" all find something. Deliberately not the figures: a search that
    // matched "25000" against an amount would match it against a share count too.
    const visibleLedger = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return ledger;

        return ledger.filter(t =>
            [t.symbol, t.type, formatMonth(t.month), entryDate(t.createdAt) ?? '']
                .join(' ')
                .toLowerCase()
                .includes(needle)
        );
    }, [ledger, query]);

    const toggleSort = (col: (typeof COLUMNS)[number]) => {
        setSort(prev =>
            prev.id === col.id
                ? { id: col.id, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { id: col.id, dir: col.numeric ? 'desc' : 'asc' }
        );
    };

    const name = peer.displayName?.trim() || peer.email.split('@')[0] || '—';
    const plUp = totals.totalPL >= 0;

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${name} — live portfolio`}
                className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent"
                />

                {/* Whose book this is, said plainly -- the whole point of the screen is
                    that these numbers are not yours. */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5">
                    <div className="min-w-0">
                        <span
                            className="mb-1.5 block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                            style={DISPLAY}
                        >
                            Peer Portfolio
                        </span>
                        <h2
                            className="truncate text-[17px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            {name}
                        </h2>
                        <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">{peer.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        {/* Two readings of the same account: what they hold now, and
                            what they did to get there. The rail borrows the nav's
                            grammar -- dark slab for where you are. */}
                        <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/70 p-1">
                            {([
                                ['positions', 'Positions'],
                                ['transactions', 'Transactions'],
                            ] as [View, string][]).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setView(id)}
                                    aria-pressed={view === id}
                                    style={DISPLAY}
                                    className={clsx(
                                        "rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-all",
                                        view === id
                                            ? "bg-slate-900 text-white shadow-[0_8px_18px_-10px_rgba(2,6,23,0.9)]"
                                            : "text-slate-500 hover:text-slate-900"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="shrink-0 rounded-xl p-2 text-slate-400 ring-1 ring-slate-900/5 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
                    {/* Worth / Cost / P&L / count, in the grammar the Live tab uses:
                        one dark slab leading three light panes. */}
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
                        <div className="relative overflow-hidden rounded-2xl bg-slate-950 px-4 py-3.5 text-white ring-1 ring-white/10 shadow-[0_16px_40px_-24px_rgba(2,6,23,0.9)]">
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_130%_at_0%_0%,rgba(56,189,248,0.14),transparent_55%)]"
                            />
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                            />
                            <div className="relative">
                                <MetricLabel label="Worth" tone="dark" />
                                <Amount
                                    value={formatCurrency(Math.round(totals.totalValue))}
                                    size="text-xl"
                                    className="mt-2.5 text-white"
                                />
                            </div>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white px-4 py-3.5 ring-1 ring-slate-900/5">
                            <MetricLabel label="Invested" />
                            <Amount
                                value={formatCurrency(Math.round(totals.totalCost))}
                                size="text-xl"
                                className="mt-2.5 text-slate-900"
                            />
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white px-4 py-3.5 ring-1 ring-slate-900/5">
                            <MetricLabel label="Unrealized" />
                            <div className={clsx(
                                "mt-2.5 flex items-baseline gap-1.5",
                                plUp ? "text-emerald-600" : "text-rose-600"
                            )}>
                                <span className="text-[10px] leading-none" style={NUMERIC}>
                                    {plUp ? '▲' : '▼'}
                                </span>
                                <Amount value={formatCurrency(Math.round(Math.abs(totals.totalPL)))} size="text-xl" />
                            </div>
                            <span
                                className={clsx(
                                    "mt-2 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
                                    plUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                                )}
                                style={NUMERIC}
                            >
                                {totals.totalCost > 0
                                    ? `${plUp ? '+' : '−'}${Math.abs((totals.totalPL / totals.totalCost) * 100).toFixed(2)}`
                                    : '0.00'}%
                            </span>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white px-4 py-3.5 ring-1 ring-slate-900/5">
                            <MetricLabel label="Positions" />
                            <div className="mt-2.5 text-xl font-semibold leading-none tabular-nums text-slate-900" style={NUMERIC}>
                                {holdings.length}
                            </div>
                            <span
                                className="mt-2 inline-block text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-slate-400"
                                style={DISPLAY}
                            >
                                {peer.transactions.length} Entr{peer.transactions.length === 1 ? 'y' : 'ies'}
                            </span>
                        </div>
                    </div>

                    {view === 'positions' && totals.unpricedCount > 0 && (
                        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-amber-50 px-4 py-2.5 text-amber-700 ring-1 ring-amber-500/15">
                            <AlertTriangle size={13} className="shrink-0" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={DISPLAY}>
                                {totals.unpricedCount} position{totals.unpricedCount > 1 ? 's' : ''} not in the live feed — held at cost, excluded from P/L
                            </span>
                        </div>
                    )}

                    {view === 'positions' && (
                    <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-900/5">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[800px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        {COLUMNS.map(col => {
                                            const active = sort.id === col.id;
                                            return (
                                                <th
                                                    key={col.id}
                                                    className={clsx(
                                                        "px-4 py-3",
                                                        col.align === 'left' ? "text-left" : "text-right"
                                                    )}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSort(col)}
                                                        style={DISPLAY}
                                                        className={clsx(
                                                            "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-none",
                                                            "tracking-[0.18em] transition-colors hover:text-slate-900",
                                                            col.align === 'right' && "flex-row-reverse",
                                                            active ? "text-slate-900" : "text-slate-400"
                                                        )}
                                                    >
                                                        {col.label}
                                                        {active
                                                            ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                                                            : <ChevronsUpDown size={11} className="opacity-30" />}
                                                    </button>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/70 bg-white">
                                    {sortedHoldings.map(h => {
                                        const alloc = totals.totalValue > 0 ? (h.marketValue / totals.totalValue) * 100 : 0;
                                        const up = h.profitLoss >= 0;
                                        const d1 = changeFor(h.symbol);

                                        return (
                                            <tr key={h.symbol} className="transition-colors hover:bg-slate-50/70">
                                                <td className="py-2.5 pl-4 pr-4">
                                                    <span
                                                        className="text-[13px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
                                                        style={DISPLAY}
                                                    >
                                                        {mask(h.symbol)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                                    {mask(h.totalShares.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                                    {mask(h.avgPrice.toFixed(2))}
                                                </td>
                                                <td
                                                    className={clsx(
                                                        "px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                                                        h.isPriced ? "text-slate-900" : "text-slate-300"
                                                    )}
                                                    style={NUMERIC}
                                                >
                                                    {h.isPriced ? mask(h.currentPrice.toFixed(2)) : '—'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {d1 == null ? (
                                                        <span className="text-[13px] tabular-nums text-slate-300" style={NUMERIC}>—</span>
                                                    ) : (
                                                        <span
                                                            className={clsx(
                                                                "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-none tabular-nums",
                                                                d1 > 0 && "bg-emerald-500/10 text-emerald-600",
                                                                d1 < 0 && "bg-rose-500/10 text-rose-600",
                                                                d1 === 0 && "text-slate-400"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {d1 !== 0 && <span className="text-[8px]">{d1 > 0 ? '▲' : '▼'}</span>}
                                                            {Math.abs(d1).toFixed(2)}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                                    {formatCurrency(Math.round(h.totalCostBasis)).replace(/^Rs\s*/, '')}
                                                </td>
                                                <td
                                                    className={clsx(
                                                        "px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                                                        h.isPriced ? "text-slate-700" : "text-slate-400"
                                                    )}
                                                    style={NUMERIC}
                                                >
                                                    {formatCurrency(Math.round(h.marketValue)).replace(/^Rs\s*/, '')}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                                                            <span
                                                                className="block h-full rounded-full bg-slate-400 transition-all"
                                                                style={{ width: `${Math.min(alloc, 100)}%` }}
                                                            />
                                                        </span>
                                                        <span className="text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                                            {alloc.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td
                                                    className={clsx(
                                                        "px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                                                        !h.isPriced ? "text-slate-300" : up ? "text-emerald-600" : "text-rose-600"
                                                    )}
                                                    style={NUMERIC}
                                                >
                                                    {h.isPriced
                                                        ? `${up ? '+' : '−'}${formatCurrency(Math.round(Math.abs(h.profitLoss))).replace(/^Rs\s*/, '')}`
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {h.isPriced ? (
                                                        <span
                                                            className={clsx(
                                                                "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-none tabular-nums",
                                                                up ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            <span className="text-[8px]">{up ? '▲' : '▼'}</span>
                                                            {Math.abs(h.profitLossPercentage).toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="inline-flex rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                                                            style={DISPLAY}
                                                        >
                                                            At Cost
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {holdings.length === 0 && (
                            <div className="bg-white py-14 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400" style={DISPLAY}>
                                    No Positions
                                </p>
                            </div>
                        )}
                    </div>
                    )}

                    {/* The ledger as a ledger: every entry, one line each. Read-only
                        throughout -- the app's own log opens a row for editing, and a
                        peer's book is something to read, never something to correct
                        from here. */}
                    {view === 'transactions' && (
                        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-900/5">
                            {ledger.length > 0 && (
                                <div className="relative border-b border-slate-100 bg-white p-3">
                                    <Search
                                        size={13}
                                        className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"
                                    />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Search symbol, side or month"
                                        aria-label="Search transactions"
                                        style={DISPLAY}
                                        // border-0/py-0 strips @tailwindcss/forms, which would draw its
                                        // own border inside the ring and force a 40px line box.
                                        className="h-9 w-full rounded-xl border-0 bg-slate-100/70 py-0 pl-9 pr-9 text-[12px] font-medium text-slate-700 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-sky-500/25"
                                    />
                                    {query && (
                                        <button
                                            type="button"
                                            onClick={() => setQuery('')}
                                            aria-label="Clear search"
                                            className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {ledger.length === 0 || visibleLedger.length === 0 ? (
                                <p
                                    className="bg-white px-4 py-14 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                                    style={DISPLAY}
                                >
                                    {ledger.length === 0 ? 'No Transactions' : `Nothing matches “${query}”`}
                                </p>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar bg-white">
                                    <table className="w-full min-w-[560px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                                <th style={DISPLAY} className={HEAD}>Date</th>
                                                <th style={DISPLAY} className={HEAD}>Symbol</th>
                                                <th style={DISPLAY} className={clsx(HEAD, 'text-right')}>Qty</th>
                                                <th style={DISPLAY} className={clsx(HEAD, 'text-right')}>Price</th>
                                                <th style={DISPLAY} className={clsx(HEAD, 'text-right')}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleLedger.map(t => {
                                                const isSell = t.type === 'sell';
                                                const recorded = entryDate(t.createdAt);

                                                return (
                                                    <tr
                                                        key={t.id}
                                                        title={recorded ? `Recorded ${recorded}` : undefined}
                                                        className="border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/70"
                                                    >
                                                        <td className={clsx(CELL, 'whitespace-nowrap text-slate-400')} style={DISPLAY}>
                                                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                                                                {monthShort(t.month)}
                                                            </span>
                                                        </td>

                                                        <td className={clsx(CELL, 'whitespace-nowrap')}>
                                                            <span
                                                                className={clsx(
                                                                    'text-[12px] font-semibold uppercase tracking-[-0.03em]',
                                                                    isSell ? 'text-rose-600' : 'text-slate-900'
                                                                )}
                                                                style={DISPLAY}
                                                            >
                                                                {maskSymbol(t.symbol)}
                                                            </span>
                                                        </td>

                                                        {/* Accounting style: a sold quantity is bracketed rather
                                                            than signed, so the minus can't be lost against the
                                                            column edge. */}
                                                        <td
                                                            className={clsx(
                                                                CELL,
                                                                'text-right tabular-nums',
                                                                isSell ? 'text-rose-600' : 'text-slate-500'
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {isSell
                                                                ? `(${mask(t.shares.toLocaleString())})`
                                                                : mask(t.shares.toLocaleString())}
                                                        </td>

                                                        <td className={clsx(CELL, 'text-right tabular-nums text-slate-500')} style={NUMERIC}>
                                                            {formatCurrency(t.pricePerShare).replace(/^Rs\s*/, '')}
                                                        </td>

                                                        {/* Sign and colour carry buy/sell -- a separate type
                                                            column would cost a column to say what the figure
                                                            already says. */}
                                                        <td
                                                            className={clsx(
                                                                CELL,
                                                                'text-right font-semibold tabular-nums',
                                                                isSell ? 'text-rose-600' : 'text-slate-900'
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {isSell ? '−' : ''}
                                                            {formatCurrency(Math.round(t.totalAmount)).replace(/^Rs\s*/, '')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PeerPortfolioModal;
