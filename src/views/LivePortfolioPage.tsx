"use client";

import React, { useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask } from '../context/PrivacyContext';
import { SkeletonBar, SkeletonCard, SkeletonTableRows } from '../components/DashboardSkeleton';
import clsx from 'clsx';
import { AlertTriangle, ArrowUp, ArrowDown, ChevronsUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { computeLiveHoldings, summarizeLive, type LiveHolding } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from '../components/Amount';
import { Panel, MetricLabel } from '../components/Panel';

type SortDir = 'asc' | 'desc';

// Stat cards share the dashboard's panel shell; only the padding is tighter than a
// full card's, so they're flush-mounted with their own.
const StatCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Panel flush className="px-4 py-3.5">
        {children}
    </Panel>
);

// Each header maps to a value on the holding. Price-derived columns return null
// for unpriced rows so they sink to the bottom instead of sorting as 0.
//
// The day move isn't on the holding -- it comes from the feed, keyed by symbol -- so
// it is handed to `get` alongside the row rather than being stitched into the model.
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
    { id: 'value', label: 'Value', align: 'right', numeric: true, get: h => h.marketValue },
    { id: 'alloc', label: 'Alloc', align: 'right', numeric: true, get: h => h.marketValue },
    { id: 'pl', label: 'P/L', align: 'right', numeric: true, get: h => (h.isPriced ? h.profitLoss : null) },
    { id: 'plpct', label: '%', align: 'right', numeric: true, get: h => (h.isPriced ? h.profitLossPercentage : null) },
];

const LivePortfolioPage: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const { transactions, loading, livePrices, liveChanges } = usePortfolio();

    // A symbol the feed didn't price has no day move either; null keeps it out of the
    // sort's way instead of pinning it at a fictional 0%.
    const changeFor = (symbol: string): number | null => {
        const value = liveChanges[symbol];
        return Number.isFinite(value) ? value : null;
    };

    // Opens on P/L %, best performer first — the live table is read to see what the
    // book is doing, and cost-order answered a question nobody was asking. Percent
    // rather than absolute P/L so a large position doesn't lead the table on size
    // alone. Unpriced symbols sink to the bottom either way (their `get` returns
    // null), so a symbol the feed missed never takes the top row. Clicking a header
    // takes over.
    const [sort, setSort] = useState<{ id: string; dir: SortDir } | null>({ id: 'plpct', dir: 'desc' });

    const holdings = useMemo(() =>
        computeLiveHoldings(transactions, livePrices)
            .sort((a, b) => b.totalCostBasis - a.totalCostBasis),
        [transactions, livePrices]
    );

    const totals = useMemo(() => summarizeLive(holdings), [holdings]);

    const toggleSort = (col: (typeof COLUMNS)[number]) => {
        setSort(prev =>
            prev?.id === col.id
                ? { id: col.id, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { id: col.id, dir: col.numeric ? 'desc' : 'asc' }
        );
    };

    const sortedHoldings = useMemo(() => {
        if (!sort) return holdings;
        const col = COLUMNS.find(c => c.id === sort.id);
        if (!col) return holdings;
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...holdings].sort((a, b) => {
            const av = col.get(a, changeFor(a.symbol));
            const bv = col.get(b, changeFor(b.symbol));
            // Unpriced (null) rows always sink, whichever direction we sort.
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return cmp * factor;
        });
    }, [holdings, sort, liveChanges]);

    const topMovements = useMemo(() => {
        const sorted = holdings.filter(h => h.isPriced).sort((a, b) => b.profitLossPercentage - a.profitLossPercentage);
        return {
            best: sorted[0] || null,
            worst: sorted[sorted.length - 1] || null
        };
    }, [holdings]);

    if (loading) return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} className="!p-4 !rounded-2xl">
                        <SkeletonBar className="h-2.5 w-24 mb-3.5" />
                        <SkeletonBar className="h-5 w-32 mb-2.5" />
                        <SkeletonBar className="h-2 w-16" />
                    </SkeletonCard>
                ))}
            </div>
            <SkeletonCard className="!rounded-2xl">
                <SkeletonTableRows rows={6} cols={9} />
            </SkeletonCard>
        </div>
    );


    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Summary Widgets — the dark slab anchors the row and echoes the navbar
                panel; the three light panes hang off it in the same grammar. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
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
                        <MetricLabel label="Aggregate Worth" tone="dark" />
                        <Amount
                            value={formatCurrency(Math.round(totals.totalValue))}
                            size="text-xl"
                            className="mt-2.5 text-white"
                        />
                        <div className="mt-2 flex items-center gap-1.5 text-slate-400">
                            <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.16em]" style={DISPLAY}>
                                Cost
                            </span>
                            <Amount
                                value={formatCurrency(Math.round(totals.totalCost))}
                                size="text-[11px]"
                                className="text-slate-300"
                            />
                        </div>
                    </div>
                </div>

                <StatCard>
<MetricLabel label="Market Velocity" />
                    <div className={clsx(
                        "mt-2.5 flex items-baseline gap-1.5",
                        totals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                        <span className="text-[10px] leading-none" style={NUMERIC}>
                            {totals.totalPL >= 0 ? '▲' : '▼'}
                        </span>
                        <Amount value={formatCurrency(Math.round(Math.abs(totals.totalPL)))} size="text-xl" />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                        <span
                            className={clsx(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
                                totals.totalPL >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                            )}
                            style={NUMERIC}
                        >
                            {totals.totalCost > 0
                                ? `${totals.totalPL >= 0 ? '+' : '−'}${Math.abs((totals.totalPL / totals.totalCost) * 100).toFixed(2)}`
                                : '0.00'}%
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400" style={DISPLAY}>
                            On Cost
                        </span>
                    </div>
                </StatCard>

                <StatCard>
                    <MetricLabel label="Leader" />
                    {topMovements.best ? (
                        <>
                            <div
                                className="mt-2.5 text-xl font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                                style={DISPLAY}
                            >
                                {mask(topMovements.best.symbol)}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-emerald-600">
                                <TrendingUp size={12} className="shrink-0" />
                                <span className="text-[11px] font-semibold leading-none tabular-nums" style={NUMERIC}>
                                    +{topMovements.best.profitLossPercentage.toFixed(2)}%
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="mt-2.5 text-xl leading-none text-slate-300" style={NUMERIC}>—</div>
                    )}
                </StatCard>

                <StatCard>
                    <MetricLabel label="Laggard" />
                    {topMovements.worst ? (
                        <>
                            <div
                                className="mt-2.5 text-xl font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                                style={DISPLAY}
                            >
                                {mask(topMovements.worst.symbol)}
                            </div>
                            <div className={clsx(
                                "mt-2 flex items-center gap-1.5",
                                topMovements.worst.profitLossPercentage >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                                {topMovements.worst.profitLossPercentage >= 0
                                    ? <TrendingUp size={12} className="shrink-0" />
                                    : <TrendingDown size={12} className="shrink-0" />}
                                <span className="text-[11px] font-semibold leading-none tabular-nums" style={NUMERIC}>
                                    {topMovements.worst.profitLossPercentage >= 0 ? '+' : ''}
                                    {topMovements.worst.profitLossPercentage.toFixed(2)}%
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="mt-2.5 text-xl leading-none text-slate-300" style={NUMERIC}>—</div>
                    )}
                </StatCard>
            </div>

            {totals.unpricedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-4 py-2.5 text-amber-700 ring-1 ring-amber-500/15">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={DISPLAY}>
                        {totals.unpricedCount} position{totals.unpricedCount > 1 ? 's' : ''} not in the live feed — held at cost, excluded from P/L
                    </span>
                </div>
            )}

            {/* Positions Table */}
            <Panel flush>
                <div className="overflow-x-auto custom-scrollbar -mx-px">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                {COLUMNS.map(col => {
                                    const active = sort?.id === col.id;
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
                                                    ? (sort!.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                                                    : <ChevronsUpDown size={11} className="opacity-30" />}
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70">
                            {sortedHoldings.map((h) => {
                                const alloc = totals.totalValue > 0 ? (h.marketValue / totals.totalValue) * 100 : 0;
                                const up = h.profitLoss >= 0;
                                const d1 = changeFor(h.symbol);

                                return (
                                <tr key={h.symbol} className="group transition-colors hover:bg-slate-50/70">
                                    {/* The accent rail only paints on hover, so the resting table stays
                                        flat and the pointer has something to track. */}
                                    <td className="relative py-2.5 pl-4 pr-4">
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                        />
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
                                    {/* Live price is the one figure on the row that actually moves — it
                                        gets the ink. */}
                                    <td
                                        className={clsx(
                                            "px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                                            h.isPriced ? "text-slate-900" : "text-slate-300"
                                        )}
                                        style={NUMERIC}
                                    >
                                        {h.isPriced ? mask(h.currentPrice.toFixed(2)) : '—'}
                                    </td>
                                    {/* Day move, straight off the feed row -- the one figure here that
                                        isn't derived from the position itself. */}
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
                                    <td
                                        className={clsx(
                                            "px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                                            h.isPriced ? "text-slate-700" : "text-slate-400"
                                        )}
                                        style={NUMERIC}
                                    >
                                        {formatCurrency(Math.round(h.marketValue)).replace(/^Rs\s*/, '')}
                                    </td>
                                    {/* Allocation reads as a share of the whole, so it gets a bar as well
                                        as a number — the shape of the portfolio at a glance. */}
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
                                            // Not a zero — the feed simply had no price, so the position sits
                                            // at cost and has no P/L to report.
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
                    <div className="py-14 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400" style={DISPLAY}>
                            No Positions
                        </p>
                    </div>
                )}
            </Panel>
        </div>
    );
};

export default LivePortfolioPage;