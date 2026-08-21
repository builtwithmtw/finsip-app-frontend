"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatMonth } from '../utils/formatters';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import Link from 'next/link';
import { Trash2, Table2, ArrowRight } from 'lucide-react';
import { SkeletonBar, SkeletonCard, SkeletonTableRows } from './DashboardSkeleton';
import { toast } from 'sonner';
import clsx from 'clsx';
import TransactionDetailModal from './TransactionDetailModal';
import type { Transaction } from '../types';
import { computeHoldings } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel } from './Panel';

const HEAD = 'py-2 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';

/*
 * Column width, which is what decides how many months fit before the grid has to be
 * scrolled -- the single biggest lever on how much of the book you can read at once.
 *
 * Two widths because the share column is optional: carrying the width for a percentage
 * that isn't being drawn costs a month of history on screen for nothing. The narrow one
 * still clears seven figures with a thousands separator at this size.
 */
const COL_WIDE = 'min-w-[112px]';
const COL_NARROW = 'min-w-[92px]';

interface Cell {
    shares: number;
    totalAmount: number;
    hasSell: boolean;
    hasBuy: boolean;
    rawTransactions: Transaction[];
}

interface MonthlyViewProps {
    /** Draw each cell's share of its column beside the amount. Switched on the page's
        control strip, which owns every ledger view option. */
    showPercentages: boolean;
    /** Column granularity. 'year' folds every month of a year into one column -- the
        same grid and the same cells, summed. Also from the control strip. */
    period?: 'month' | 'year';
}

const MonthlyView: React.FC<MonthlyViewProps> = ({ showPercentages, period = 'month' }) => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();
    const { transactions, stocks, deleteMonthTransactions, loading, selectedMonth } = usePortfolio();
    const { confirm } = useConfirm();

    const isYearly = period === 'year';

    // The one place the two granularities differ. Everything downstream works on the
    // key this returns and never asks which it got: 'YYYY' and 'YYYY-MM' both sort
    // and compare as plain strings, and `formatMonth` labels either.
    const columnKey = (month: string) => (isYearly ? month.slice(0, 4) : month);

    // State for the detail modal. A missing symbol means a whole month was opened;
    // a missing month means a whole symbol was.
    const [selectedCell, setSelectedCell] = useState<{
        symbol?: string;
        month?: string;
        transactions: Transaction[];
    } | null>(null);

    // Which month column the pointer is over. Rows already light up on their own via
    // the group; this is the other half of the crosshair, and it is what makes a wide
    // grid readable -- you can follow a column down without losing the line.
    const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

    const filteredTransactions = useMemo(() =>
        transactions.filter(t => t.shares > 0 && t.pricePerShare > 0),
        [transactions]
    );

    // The grid scrolls sideways and nothing else, so a normal wheel over it should move
    // it sideways -- otherwise reaching last year means hunting for the scrollbar or a
    // shift key. Only claimed while there is actually room left to travel: at either end
    // the event falls through untouched and the page scrolls as usual.
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            // A trackpad's own horizontal gesture is already doing the right thing.
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

            const max = el.scrollWidth - el.clientWidth;
            if (max <= 0) return;

            const next = el.scrollLeft + e.deltaY;
            if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;

            // Non-passive, so this is allowed to take the event off the page.
            e.preventDefault();
            el.scrollLeft = Math.max(0, Math.min(next, max));
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
        // The container only exists once the grid does, so re-attach when it appears.
    }, [loading, filteredTransactions.length]);

    const { sortedColumns, sortedSymbols, matrix, colTotals, colBuyTotals, colMaxBuys, held } = useMemo(() => {
        const columnsSet = new Set<string>();
        const symbolsSet = new Set<string>();

        filteredTransactions.forEach(t => {
            columnsSet.add(columnKey(t.month));
            symbolsSet.add(t.symbol);
        });

        const sortedColumns = Array.from(columnsSet).sort((a, b) => b.localeCompare(a));

        // Symbols still held today rise to the top; positions fully exited sink below
        // them. Within each group the order stays the one set on Overview, so the grid
        // doesn't reshuffle for any reason other than actually closing a position.
        const held = new Set(computeHoldings(filteredTransactions).map(h => h.symbol));

        const sortedSymbols = Array.from(symbolsSet).sort((a, b) => {
            const heldA = held.has(a) ? 0 : 1;
            const heldB = held.has(b) ? 0 : 1;
            if (heldA !== heldB) return heldA - heldB;

            const indexA = stocks.findIndex(s => s.symbol === a);
            const indexB = stocks.findIndex(s => s.symbol === b);
            const posA = indexA === -1 ? 999 : indexA;
            const posB = indexB === -1 ? 999 : indexB;
            return posA - posB;
        });

        const matrix: Record<string, Record<string, Cell>> = {};

        filteredTransactions.forEach(t => {
            const key = columnKey(t.month);
            if (!matrix[t.symbol]) matrix[t.symbol] = {};
            if (!matrix[t.symbol][key]) {
                matrix[t.symbol][key] = {
                    shares: 0,
                    totalAmount: 0,
                    hasSell: false,
                    hasBuy: false,
                    rawTransactions: [],
                };
            }

            const existing = matrix[t.symbol][key];

            // Add raw transaction for detail view
            existing.rawTransactions.push(t);

            // Sells are always negative, regardless of what landed in the cell first.
            const sign = t.type === 'sell' ? -1 : 1;
            existing.shares += sign * t.shares;
            existing.totalAmount += sign * t.totalAmount;

            if (t.type === 'sell') {
                existing.hasSell = true;
            } else {
                existing.hasBuy = true;
            }
        });

        // Per-column net, for the footer.
        const colTotals = new Map<string, number>();

        // Denominator for a cell's share of its column. Deliberately buys-only: a sell is
        // money coming back out, so folding it in would let one sell push the column's
        // remaining rows past 100%.
        const colBuyTotals = new Map<string, number>();

        /*
         * The heaviest single buy in each month, which is what the cell tints are scaled
         * against. Per column rather than across the whole grid on purpose: the question
         * a row of tints answers is "where did THIS month go", and scaling globally would
         * wash out every month that happened to be smaller than the biggest one you ever
         * had. It also keeps the picture legible whether the book holds four symbols or
         * twenty -- the largest cell in a month is always full strength.
         */
        const colMaxBuys = new Map<string, number>();

        sortedSymbols.forEach(symbol => {
            sortedColumns.forEach(col => {
                const cell = matrix[symbol]?.[col];
                if (!cell) return;
                colTotals.set(col, (colTotals.get(col) || 0) + cell.totalAmount);
                if (cell.totalAmount > 0) {
                    colBuyTotals.set(col, (colBuyTotals.get(col) || 0) + cell.totalAmount);
                    colMaxBuys.set(col, Math.max(colMaxBuys.get(col) || 0, cell.totalAmount));
                }
            });
        });

        return { sortedColumns, sortedSymbols, matrix, colTotals, colBuyTotals, colMaxBuys, held };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTransactions, stocks, isYearly]);

    // Header clicks open a whole row or column of the matrix; the modal sorts by date,
    // so nothing needs ordering here.
    const openColumn = (col: string) => {
        setSelectedCell({
            month: col,
            transactions: filteredTransactions.filter(t => columnKey(t.month) === col),
        });
    };

    const openSymbol = (symbol: string) => {
        setSelectedCell({
            symbol,
            transactions: filteredTransactions.filter(t => t.symbol === symbol),
        });
    };

    const handleDeleteMonth = async (month: string) => {
        const isConfirmed = await confirm({
            title: 'Wipe Monthly Data',
            message: `Are you sure you want to delete ALL entries for ${formatMonth(month)}? This action is immediate and cannot be undone.`,
            variant: 'danger',
            confirmText: 'Delete All',
            cancelText: 'Go Back'
        });

        if (isConfirmed) {
            try {
                deleteMonthTransactions(month);
                toast.success(`Successfully deleted entries for ${formatMonth(month)}`);
            } catch (err) {
                toast.error('Failed to delete entries');
            }
        }
    };

    // Without this the ledger claims there's no history for as long as the fetch runs.
    if (loading) {
        return (
            <SkeletonCard>
                <SkeletonBar className="h-3 w-full mb-5" />
                <SkeletonTableRows rows={8} cols={6} />
            </SkeletonCard>
        );
    }

    if (filteredTransactions.length === 0) {
        return (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 ring-1 ring-slate-900/10">
                    <Table2 size={20} />
                </div>
                <h3
                    className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                    style={DISPLAY}
                >
                    No transactions yet
                </h3>
                <p className="mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
                    Every buy and sell you record shows up here as a symbol-by-month grid.
                    Record your first one in Monthly Entry.
                </p>
                <Link
                    href="/entry"
                    style={DISPLAY}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800"
                >
                    Go to Monthly Entry
                    <ArrowRight size={13} />
                </Link>
            </div>
        );
    }

    return (
        <>
            <Panel flush>
                {/* Horizontal only, by design: every month stays on one page and the grid
                    must never grow a vertical scrollbar -- nor push the page into growing
                    one. One line per cell is what keeps a full symbol list on screen.
                    (The header is sticky left, not top -- sticky-top only pays off inside a
                    vertical scroll container, which is exactly what we don't want here.) */}
                <div ref={scrollerRef} className="w-full max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                    <table className="w-full min-w-max border-collapse border-spacing-0 text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th
                                    style={DISPLAY}
                                    className={clsx(HEAD, 'sticky left-0 z-30 border-r border-slate-100 bg-white pl-4 pr-3')}
                                >
                                    Symbol
                                </th>
                                {sortedColumns.map(col => (
                                    <th
                                        key={col}
                                        onMouseEnter={() => setHoveredMonth(col)}
                                        onMouseLeave={() => setHoveredMonth(null)}
                                        className={clsx(
                                            "relative border-r border-slate-100 px-2.5 py-2 text-right transition-colors last:border-r-0",
                                            showPercentages ? COL_WIDE : COL_NARROW,
                                            hoveredMonth === col && "bg-slate-50"
                                        )}
                                    >
                                        {/* The selected month used to be a sky wash down the
                                            whole column. Now that a cell's fill means how big
                                            it is, the two would be saying different things in
                                            the same ink -- so selection moved up here, to a
                                            rule under its own heading. It marks the column
                                            once instead of on every row, which is all it ever
                                            needed to do. */}
                                        {columnKey(selectedMonth) === col && (
                                            <span
                                                aria-hidden
                                                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-sky-500"
                                            />
                                        )}

                                        {/* The delete button occupies no layout of its own until it is
                                            wanted -- it sits over the label's left, which is empty space.
                                            Months only: wiping a whole year is not something the ledger
                                            offers, and a delete that silently means twelve months is worse
                                            than no delete at all. */}
                                        <div className="group/month relative inline-flex items-center justify-end">
                                            {!isYearly && (
                                                <button
                                                    onClick={() => handleDeleteMonth(col)}
                                                    title={`Delete all entries for ${formatMonth(col)}`}
                                                    className="absolute right-full mr-1 rounded p-0.5 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover/month:opacity-100"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openColumn(col)}
                                                title={`All transactions in ${formatMonth(col)}`}
                                                style={DISPLAY}
                                                className={clsx(
                                                    "whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.18em] transition-colors hover:text-slate-900",
                                                    // The selected month's label carries the same sky as the
                                                    // cells below it, so the highlighted column reads as
                                                    // deliberate rather than as a stuck hover.
                                                    columnKey(selectedMonth) === col
                                                        ? "text-sky-600"
                                                        : hoveredMonth === col ? "text-slate-900" : "text-slate-400"
                                                )}
                                            >
                                                {/* Monthly: month leads, year trails dimmed -- down a long
                                                    history the eye only needs the month, and the years stop
                                                    shouting in unison. Yearly: the year is the whole label. */}
                                                {isYearly ? col : (
                                                    <>
                                                        {formatMonth(col).split(' ')[0]}
                                                        <span className="ml-1 font-normal text-slate-300">
                                                            {formatMonth(col).split(' ')[1]}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {sortedSymbols.map((symbol) => {
                                // Nothing left on the books for this ticker: the position was
                                // closed out, so the label is marked rather than just sorted down.
                                const isExited = !held.has(symbol);

                                return (
                                    <tr key={symbol} className="group/row border-b border-slate-100 transition-colors last:border-0">
                                        {/* Stays put as the months scroll past, so a row never loses its
                                            label. It carries its own background for that reason. */}
                                        <td className="sticky left-0 z-10 border-r border-slate-100 bg-white py-1 pl-4 pr-3 transition-colors group-hover/row:bg-slate-50">
                                            <button
                                                onClick={() => openSymbol(symbol)}
                                                title={`All transactions for ${symbol}`}
                                                style={DISPLAY}
                                                className={clsx(
                                                    "text-[11px] font-semibold uppercase leading-none tracking-[-0.03em] transition-colors hover:text-sky-600",
                                                    isExited ? "text-rose-600" : "text-slate-900"
                                                )}
                                            >
                                                {maskSymbol(symbol)}
                                            </button>
                                        </td>


                                        {sortedColumns.map(col => {
                                            const data = matrix[symbol][col];
                                            if (!data || data.rawTransactions.length === 0) {
                                                return (
                                                    <td
                                                        key={col}
                                                        onMouseEnter={() => setHoveredMonth(col)}
                                                        onMouseLeave={() => setHoveredMonth(null)}
                                                        className={clsx(
                                                            "border-r border-slate-100 px-2.5 py-1 text-right text-slate-200 transition-colors last:border-r-0 group-hover/row:bg-slate-50",
                                                            hoveredMonth === col && "bg-slate-50"
                                                        )}
                                                    >
                                                        <span className="text-[11px] leading-none" style={NUMERIC}>·</span>
                                                    </td>
                                                );
                                            }

                                            // Always volume-weighted across the column's actual trades. Dividing the
                                            // *net* amount by *net* shares breaks whenever a month both buys and
                                            // sells: 100 @ 10 bought and 50 @ 20 sold nets to 50 shares for 0 rupees,
                                            // which would price the row at 0.00.
                                            const grossShares = data.rawTransactions.reduce((sum, t) => sum + t.shares, 0);
                                            const grossAmount = data.rawTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
                                            const avgPrice = grossShares > 0 ? grossAmount / grossShares : 0;

                                            const isSell = data.shares < 0 || (data.shares === 0 && data.hasSell);

                                            // Share of that column's buying. Sells get none -- they are not part
                                            // of how the money was split.
                                            const monthBuys = colBuyTotals.get(col) ?? 0;
                                            const share = !isSell && monthBuys > 0
                                                ? (data.totalAmount / monthBuys) * 100
                                                : null;

                                            /*
                                             * How strongly the cell is tinted: its size against the heaviest buy
                                             * of the same month, so the biggest cell in every column reads at full
                                             * strength and the rest fall away from it.
                                             *
                                             * Floored well above zero. A cell that exists is a month you put money
                                             * into that symbol, and that fact should never fade to the point of
                                             * looking like the empty ones beside it -- the tint ranks the cells, it
                                             * does not decide which ones count. Capped low too: this sits behind
                                             * 11px figures, and anything heavier starts costing legibility to say
                                             * something the number already says exactly.
                                             */
                                            const monthPeak = colMaxBuys.get(col) ?? 0;
                                            const heat = isSell
                                                ? 0.10
                                                : monthPeak > 0
                                                    ? 0.06 + (data.totalAmount / monthPeak) * 0.20
                                                    : 0;


                                            return (
                                                <td
                                                    key={col}
                                                    onClick={() => setSelectedCell({ symbol, month: col, transactions: data.rawTransactions })}
                                                    // The quantity and price the amount is built from stay one hover
                                                    // away, and one click away in full, rather than costing every row
                                                    // a second line.
                                                    title={`${mask(Math.abs(data.shares).toLocaleString())} @ ${mask(avgPrice.toFixed(2))}`}
                                                    onMouseEnter={() => setHoveredMonth(col)}
                                                    onMouseLeave={() => setHoveredMonth(null)}
                                                    className={clsx(
                                                        "relative cursor-pointer border-r border-slate-100 px-2.5 py-1 text-right transition-colors last:border-r-0",
                                                        "group-hover/row:bg-slate-50 hover:!bg-sky-50",
                                                        hoveredMonth === col && "bg-slate-50"
                                                    )}
                                                >
                                                    {/* The tint is a layer of its own rather than a background on
                                                        the cell, so it composes with the row and column washes
                                                        instead of fighting them for the same property -- hover
                                                        still reads through it, and neither needs `!important` to
                                                        win. Costs no height and no width: it sits behind the
                                                        figures that were already there. */}
                                                    <span
                                                        aria-hidden
                                                        className={clsx(
                                                            'pointer-events-none absolute inset-0',
                                                            isSell ? 'bg-rose-500' : 'bg-sky-500'
                                                        )}
                                                        style={{ opacity: heat }}
                                                    />

                                                    {/* Amount and its share of the month sit on one line: a second
                                                        line would double every row and cost the grid its no-scroll
                                                        fit. The share is dimmed so the rupee figure still leads. */}
                                                    <span className="relative inline-flex items-baseline justify-end gap-1">
                                                        <span
                                                            className={clsx(
                                                                "text-[11px] leading-none tabular-nums",
                                                                isSell ? "text-rose-600" : "text-slate-700"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {isSell ? '−' : ''}
                                                            {formatCurrency(Math.round(Math.abs(data.totalAmount))).replace(/^Rs\s*/, '')}
                                                        </span>
                                                        {showPercentages && share != null && (
                                                            <span
                                                                className="w-7 text-right text-[9px] leading-none tabular-nums text-slate-400"
                                                                style={NUMERIC}
                                                            >
                                                                {share.toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Bottom margin: what each month cost, and what the book has taken in
                            total. The grid closes on an answer rather than trailing off. */}
                        <tfoot>
                            <tr className="border-t border-slate-100 bg-slate-50/60">
                                <td
                                    style={DISPLAY}
                                    className={clsx(HEAD, 'sticky left-0 z-20 border-r border-slate-100 bg-slate-50 pl-4 pr-3 text-slate-500')}
                                >
                                    Net
                                </td>
                                {sortedColumns.map(col => {
                                    const net = colTotals.get(col) ?? 0;
                                    return (
                                        <td
                                        key={col}
                                        onMouseEnter={() => setHoveredMonth(col)}
                                        onMouseLeave={() => setHoveredMonth(null)}
                                        className={clsx(
                                            "border-r border-slate-100 px-2.5 py-2 text-center transition-colors last:border-r-0",
                                            hoveredMonth === col && "bg-slate-100/70"
                                        )}
                                    >
                                            <span
                                                className={clsx(
                                                    'text-[11px] font-semibold leading-none tabular-nums',
                                                    net < 0 ? 'text-rose-600' : 'text-slate-600'
                                                )}
                                                style={NUMERIC}
                                            >
                                                {net < 0 ? '−' : ''}
                                                {formatCurrency(Math.round(Math.abs(net))).replace(/^Rs\s*/, '')}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Panel>

            <TransactionDetailModal
                isOpen={!!selectedCell}
                onClose={() => setSelectedCell(null)}
                transactions={selectedCell?.transactions || []}
                symbol={selectedCell?.symbol}
                month={selectedCell?.month}
            />
        </>
    );
};

export default MonthlyView;
