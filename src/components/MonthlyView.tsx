"use client";

import React, { useMemo, useState } from 'react';
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

const HEAD = 'py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';

interface Cell {
    shares: number;
    totalAmount: number;
    hasSell: boolean;
    hasBuy: boolean;
    /**
     * Gross money in and gross money out, both positive. `totalAmount` is the net of
     * the two and can't answer "how much was sold" in a month that also bought, which
     * is exactly what the score lines need.
     */
    buyAmount: number;
    sellAmount: number;
    rawTransactions: Transaction[];
}

const MonthlyView: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();
    const { transactions, stocks, deleteMonthTransactions, loading, selectedMonth, showScoreLines } = usePortfolio();
    const { confirm } = useConfirm();

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

    const {
        sortedMonths, sortedSymbols, matrix, colTotals, colBuyTotals,
        rowBuyTotals, rowBuyPeaks, rowSellTotals, rowSellPeaks, held,
    } = useMemo(() => {
        const monthsSet = new Set<string>();
        const symbolsSet = new Set<string>();

        filteredTransactions.forEach(t => {
            monthsSet.add(t.month);
            symbolsSet.add(t.symbol);
        });

        const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

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
            if (!matrix[t.symbol]) matrix[t.symbol] = {};
            if (!matrix[t.symbol][t.month]) {
                matrix[t.symbol][t.month] = {
                    shares: 0,
                    totalAmount: 0,
                    hasSell: false,
                    hasBuy: false,
                    buyAmount: 0,
                    sellAmount: 0,
                    rawTransactions: [],
                };
            }

            const existing = matrix[t.symbol][t.month];

            // Add raw transaction for detail view
            existing.rawTransactions.push(t);

            // Sells are always negative, regardless of what landed in the cell first.
            const sign = t.type === 'sell' ? -1 : 1;
            existing.shares += sign * t.shares;
            existing.totalAmount += sign * t.totalAmount;

            if (t.type === 'sell') {
                existing.hasSell = true;
                existing.sellAmount += t.totalAmount;
            } else {
                existing.hasBuy = true;
                existing.buyAmount += t.totalAmount;
            }
        });

        // Per-month net, for the footer.
        const colTotals = new Map<string, number>();

        // Denominator for a cell's share of its month. Deliberately buys-only: a sell is
        // money coming back out, so folding it in would let one sell push the month's
        // remaining rows past 100%.
        const colBuyTotals = new Map<string, number>();

        // The same idea turned sideways: everything ever put into one symbol, and the
        // single biggest month it went in. The first is what each month's score line is
        // a percentage of; the second is what fills that line, so the heaviest month in
        // a row runs full and the rest read against it.
        //
        // Selling is tracked on its own scale rather than against the buying, because
        // the question the red line answers is "which month did I take the most out",
        // and a book that sells a fraction of what it buys would otherwise draw every
        // sell as an invisible sliver.
        const rowBuyTotals = new Map<string, number>();
        const rowBuyPeaks = new Map<string, number>();
        const rowSellTotals = new Map<string, number>();
        const rowSellPeaks = new Map<string, number>();

        sortedSymbols.forEach(symbol => {
            sortedMonths.forEach(month => {
                const cell = matrix[symbol]?.[month];
                if (!cell) return;
                colTotals.set(month, (colTotals.get(month) || 0) + cell.totalAmount);
                if (cell.totalAmount > 0) {
                    colBuyTotals.set(month, (colBuyTotals.get(month) || 0) + cell.totalAmount);
                }
                if (cell.buyAmount > 0) {
                    rowBuyTotals.set(symbol, (rowBuyTotals.get(symbol) || 0) + cell.buyAmount);
                    rowBuyPeaks.set(symbol, Math.max(rowBuyPeaks.get(symbol) || 0, cell.buyAmount));
                }
                if (cell.sellAmount > 0) {
                    rowSellTotals.set(symbol, (rowSellTotals.get(symbol) || 0) + cell.sellAmount);
                    rowSellPeaks.set(symbol, Math.max(rowSellPeaks.get(symbol) || 0, cell.sellAmount));
                }
            });
        });

        return {
            sortedMonths, sortedSymbols, matrix, colTotals, colBuyTotals,
            rowBuyTotals, rowBuyPeaks, rowSellTotals, rowSellPeaks, held,
        };
    }, [filteredTransactions, stocks]);

    // Header clicks open a whole row or column of the matrix; the modal sorts by date,
    // so nothing needs ordering here.
    const openMonth = (month: string) => {
        setSelectedCell({
            month,
            transactions: filteredTransactions.filter(t => t.month === month),
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
                    className="text-[15px] font-semibold uppercase leading-none tracking-[0.02em] text-slate-900"
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
                <div className="w-full max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                    <table className="w-full min-w-max border-collapse border-spacing-0 text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th
                                    style={DISPLAY}
                                    className={clsx(HEAD, 'sticky left-0 z-30 border-r border-slate-100 bg-white pl-5 pr-4')}
                                >
                                    Symbol
                                </th>
                                {sortedMonths.map(month => (
                                    <th
                                        key={month}
                                        onMouseEnter={() => setHoveredMonth(month)}
                                        onMouseLeave={() => setHoveredMonth(null)}
                                        className={clsx(
                                            "min-w-[132px] border-r border-slate-100 px-3 py-2.5 text-right transition-colors last:border-r-0",
                                            hoveredMonth === month && "bg-slate-50"
                                        )}
                                    >
                                        {/* The delete button occupies no layout of its own until it is
                                            wanted -- it sits over the label's left, which is empty space. */}
                                        <div className="group/month relative inline-flex items-center justify-end">
                                            <button
                                                onClick={() => handleDeleteMonth(month)}
                                                title={`Delete all entries for ${formatMonth(month)}`}
                                                className="absolute right-full mr-1 rounded p-0.5 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover/month:opacity-100"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                            {/* Month leads, year trails dimmed: down a long history the eye
                                                only needs the month, and the years stop shouting in unison. */}
                                            <button
                                                onClick={() => openMonth(month)}
                                                title={`All transactions in ${formatMonth(month)}`}
                                                style={DISPLAY}
                                                className={clsx(
                                                    "whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.18em] transition-colors hover:text-slate-900",
                                                    // The selected month's label carries the same sky as the
                                                    // cells below it, so the highlighted column reads as
                                                    // deliberate rather than as a stuck hover.
                                                    month === selectedMonth
                                                        ? "text-sky-600"
                                                        : hoveredMonth === month ? "text-slate-900" : "text-slate-400"
                                                )}
                                            >
                                                {formatMonth(month).split(' ')[0]}
                                                <span className="ml-1 font-normal text-slate-300">
                                                    {formatMonth(month).split(' ')[1]}
                                                </span>
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
                                        <td className="sticky left-0 z-10 border-r border-slate-100 bg-white py-1.5 pl-5 pr-4 transition-colors group-hover/row:bg-slate-50">
                                            <button
                                                onClick={() => openSymbol(symbol)}
                                                title={`All transactions for ${symbol}`}
                                                style={DISPLAY}
                                                className={clsx(
                                                    "text-[12px] font-semibold uppercase leading-none tracking-tight transition-colors hover:text-sky-600",
                                                    isExited ? "text-rose-600" : "text-slate-900"
                                                )}
                                            >
                                                {maskSymbol(symbol)}
                                            </button>
                                        </td>


                                        {sortedMonths.map(month => {
                                            const data = matrix[symbol][month];
                                            if (!data || data.rawTransactions.length === 0) {
                                                return (
                                                    <td
                                                        key={month}
                                                        onMouseEnter={() => setHoveredMonth(month)}
                                                        onMouseLeave={() => setHoveredMonth(null)}
                                                        className={clsx(
                                                            "border-r border-slate-100 px-3 py-1.5 text-right text-slate-200 transition-colors last:border-r-0 group-hover/row:bg-slate-50",
                                                            hoveredMonth === month && "bg-slate-50"
                                                        )}
                                                    >
                                                        <span className="text-[11px] leading-none" style={NUMERIC}>·</span>
                                                    </td>
                                                );
                                            }

                                            // Always volume-weighted across the month's actual trades. Dividing the
                                            // *net* amount by *net* shares breaks whenever a month both buys and
                                            // sells: 100 @ 10 bought and 50 @ 20 sold nets to 50 shares for 0 rupees,
                                            // which would price the row at 0.00.
                                            const grossShares = data.rawTransactions.reduce((sum, t) => sum + t.shares, 0);
                                            const grossAmount = data.rawTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
                                            const avgPrice = grossShares > 0 ? grossAmount / grossShares : 0;

                                            const isSell = data.shares < 0 || (data.shares === 0 && data.hasSell);

                                            // This month's buying reads as already selected -- the same sky
                                            // wash a cell takes on hover -- so the column you are actually
                                            // working in stands out of a long history without being clicked.
                                            // Sells are left alone: the highlight is about where the money
                                            // went this month.
                                            const isCurrentBuy = month === selectedMonth && !isSell;

                                            // Score line: this month's share of everything ever bought in
                                            // *this symbol*, which is the other axis from the % beside the
                                            // amount (that one is the month's split across symbols).
                                            //
                                            // The bar is drawn against the row's own biggest month rather
                                            // than against 100, because a symbol bought across two years
                                            // would otherwise be twenty near-empty slivers. Full bar = the
                                            // month you put the most into; the tooltip carries the true
                                            // percentage.
                                            //
                                            // Buys and sells are scored separately and drawn as their own
                                            // line, so a month that did both -- topped up and trimmed the
                                            // same position -- shows green over red instead of one bar that
                                            // nets them out and says nothing about either.
                                            const symbolBuys = rowBuyTotals.get(symbol) ?? 0;
                                            const symbolBuyPeak = rowBuyPeaks.get(symbol) ?? 0;
                                            const buyShare = data.buyAmount > 0 && symbolBuys > 0
                                                ? (data.buyAmount / symbolBuys) * 100
                                                : null;
                                            const buyFill = buyShare != null && symbolBuyPeak > 0
                                                ? (data.buyAmount / symbolBuyPeak) * 100
                                                : 0;

                                            const symbolSells = rowSellTotals.get(symbol) ?? 0;
                                            const symbolSellPeak = rowSellPeaks.get(symbol) ?? 0;
                                            const sellShare = data.sellAmount > 0 && symbolSells > 0
                                                ? (data.sellAmount / symbolSells) * 100
                                                : null;
                                            const sellFill = sellShare != null && symbolSellPeak > 0
                                                ? (data.sellAmount / symbolSellPeak) * 100
                                                : 0;

                                            // Share of that month's buying. Sells get none -- they are not part
                                            // of how the month's money was split.
                                            const monthBuys = colBuyTotals.get(month) ?? 0;
                                            const share = !isSell && monthBuys > 0
                                                ? (data.totalAmount / monthBuys) * 100
                                                : null;


                                            return (
                                                <td
                                                    key={month}
                                                    onClick={() => setSelectedCell({ symbol, month, transactions: data.rawTransactions })}
                                                    // The quantity and price the amount is built from stay one hover
                                                    // away, and one click away in full, rather than costing every row
                                                    // a second line.
                                                    title={clsx(
                                                        `${mask(Math.abs(data.shares).toLocaleString())} @ ${mask(avgPrice.toFixed(2))}`,
                                                        buyShare != null &&
                                                            `· ${buyShare.toFixed(1)}% of all ${maskSymbol(symbol)} buying`,
                                                        sellShare != null &&
                                                            `· ${sellShare.toFixed(1)}% of all ${maskSymbol(symbol)} selling`
                                                    )}
                                                    onMouseEnter={() => setHoveredMonth(month)}
                                                    onMouseLeave={() => setHoveredMonth(null)}
                                                    className={clsx(
                                                        "cursor-pointer border-r border-slate-100 px-3 py-1.5 text-right transition-colors last:border-r-0",
                                                        "group-hover/row:bg-slate-50 hover:!bg-sky-50",
                                                        hoveredMonth === month && "bg-slate-50",
                                                        // Beats the row and column washes, and still yields to
                                                        // the hover rule, which Tailwind emits after it.
                                                        isCurrentBuy && "!bg-sky-50"
                                                    )}
                                                >
                                                    {/* Amount and its share of the month sit on one line: a second
                                                        line would double every row and cost the grid its no-scroll
                                                        fit. The share is dimmed so the rupee figure still leads. */}
                                                    <span className="inline-flex items-baseline justify-end gap-1.5">
                                                        <span
                                                            className={clsx(
                                                                "text-[12px] leading-none tabular-nums",
                                                                isSell ? "text-rose-600" : "text-slate-700"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {isSell ? '−' : ''}
                                                            {formatCurrency(Math.round(Math.abs(data.totalAmount))).replace(/^Rs\s*/, '')}
                                                        </span>
                                                        {share != null && (
                                                            <span
                                                                className="w-8 text-right text-[10px] leading-none tabular-nums text-slate-400"
                                                                style={NUMERIC}
                                                            >
                                                                {share.toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </span>

                                                    {/* Hairlines under the figure, so a row can be read across as a
                                                        bar chart of when this symbol was accumulated and when it
                                                        was trimmed. Green in, red out. 3px tall on a 3px gap:
                                                        enough to see, not enough to cost the grid its
                                                        no-vertical-scroll fit. */}
                                                    {showScoreLines && buyShare != null && (
                                                        <span className="mt-[3px] block h-[3px] w-full overflow-hidden rounded-full bg-slate-100">
                                                            <span
                                                                className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                                                                style={{ width: `${Math.max(buyFill, 4)}%` }}
                                                            />
                                                        </span>
                                                    )}
                                                    {showScoreLines && sellShare != null && (
                                                        <span className="mt-[3px] block h-[3px] w-full overflow-hidden rounded-full bg-slate-100">
                                                            <span
                                                                className="block h-full rounded-full bg-rose-500 transition-[width] duration-500"
                                                                style={{ width: `${Math.max(sellFill, 4)}%` }}
                                                            />
                                                        </span>
                                                    )}
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
                                    className={clsx(HEAD, 'sticky left-0 z-20 border-r border-slate-100 bg-slate-50 pl-5 pr-4 text-slate-500')}
                                >
                                    Net
                                </td>
                                {sortedMonths.map(month => {
                                    const net = colTotals.get(month) ?? 0;
                                    return (
                                        <td
                                        key={month}
                                        onMouseEnter={() => setHoveredMonth(month)}
                                        onMouseLeave={() => setHoveredMonth(null)}
                                        className={clsx(
                                            "border-r border-slate-100 px-3 py-2.5 text-center transition-colors last:border-r-0",
                                            hoveredMonth === month && "bg-slate-100/70"
                                        )}
                                    >
                                            <span
                                                className={clsx(
                                                    'text-[12px] font-semibold leading-none tabular-nums',
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
