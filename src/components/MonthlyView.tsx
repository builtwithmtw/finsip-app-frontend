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

const MonthlyView: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();
    const { transactions, stocks, deleteMonthTransactions, loading } = usePortfolio();
    const { confirm } = useConfirm();

    // State for the detail modal. A missing symbol means a whole month was opened;
    // a missing month means a whole symbol was.
    const [selectedCell, setSelectedCell] = useState<{
        symbol?: string;
        month?: string;
        transactions: Transaction[];
    } | null>(null);

    const filteredTransactions = useMemo(() =>
        transactions.filter(t => t.shares > 0 && t.pricePerShare > 0),
        [transactions]
    );

    const { sortedMonths, sortedSymbols, matrix } = useMemo(() => {
        const monthsSet = new Set<string>();
        const symbolsSet = new Set<string>();

        filteredTransactions.forEach(t => {
            monthsSet.add(t.month);
            symbolsSet.add(t.symbol);
        });

        const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

        const sortedSymbols = Array.from(symbolsSet).sort((a, b) => {
            const indexA = stocks.findIndex(s => s.symbol === a);
            const indexB = stocks.findIndex(s => s.symbol === b);
            const posA = indexA === -1 ? 999 : indexA;
            const posB = indexB === -1 ? 999 : indexB;
            return posA - posB;
        });

        const matrix: Record<string, Record<string, { shares: number; totalAmount: number; hasSell: boolean; hasBuy: boolean; rawTransactions: Transaction[] }>> = {};

        filteredTransactions.forEach(t => {
            if (!matrix[t.symbol]) matrix[t.symbol] = {};
            if (!matrix[t.symbol][t.month]) {
                matrix[t.symbol][t.month] = { shares: 0, totalAmount: 0, hasSell: false, hasBuy: false, rawTransactions: [] };
            }

            const existing = matrix[t.symbol][t.month];

            // Add raw transaction for detail view
            existing.rawTransactions.push(t);

            // Sells are always negative, regardless of what landed in the cell first.
            const sign = t.type === 'sell' ? -1 : 1;
            existing.shares += sign * t.shares;
            existing.totalAmount += sign * t.totalAmount;

            if (t.type === 'sell') existing.hasSell = true;
            else existing.hasBuy = true;
        });

        return { sortedMonths, sortedSymbols, matrix };
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
                <div className="flex items-center justify-between mb-5">
                    <div className="space-y-2">
                        <SkeletonBar className="h-5 w-48" />
                        <SkeletonBar className="h-2.5 w-32" />
                    </div>
                    <SkeletonBar className="h-11 w-28 rounded-lg" />
                </div>
                <SkeletonTableRows rows={6} cols={5} />
            </SkeletonCard>
        );
    }

    if (filteredTransactions.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 shadow-sm px-6 py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                    <Table2 size={22} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No transactions yet</h3>
                <p className="text-xs font-bold text-slate-400 mt-2 max-w-sm leading-relaxed">
                    Every buy and sell you record shows up here as a symbol-by-month matrix.
                    Record your first one in Monthly Entry.
                </p>
                <Link
                    href="/entry"
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                    Go to Monthly Entry
                    <ArrowRight size={13} />
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col group">
                {/* Horizontal only, by design: the ledger must never grow its own vertical
                    scrollbar. It grows as tall as it needs and the page scrolls instead.
                    (The header is sticky left, not top -- sticky-top only pays off inside a
                    vertical scroll container, which is exactly what we don't want here.) */}
                <div className="overflow-x-auto overflow-y-hidden w-full max-w-full custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-max border-spacing-0">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-4 py-2.5 sticky left-0 bg-slate-50 z-30 border-r border-slate-100">
                                    Symbol
                                </th>
                                {sortedMonths.map(month => (
                                    <th key={month} className="px-3 py-2.5 border-r border-slate-100 last:border-0 text-center min-w-[130px]">
                                        <div className="flex items-center justify-center gap-2 group/month">
                                            <button
                                                onClick={() => openMonth(month)}
                                                title={`All transactions in ${formatMonth(month)}`}
                                                className="whitespace-nowrap hover:text-blue-600 transition-colors"
                                            >
                                                {formatMonth(month)}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMonth(month)}
                                                title={`Delete all entries for ${formatMonth(month)}`}
                                                className="p-1 rounded text-slate-300 hover:text-white hover:bg-rose-600 opacity-60 group-hover/month:opacity-100 transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedSymbols.map((symbol, index) => (
                                <tr key={symbol} className={clsx(
                                    "transition-colors group/row",
                                    index % 2 === 0 ? "bg-white":"bg-slate-50/20")}> <td className={clsx("px-4 py-1.5 font-black text-slate-900 sticky left-0 z-10 border-r border-slate-100 text-sm tracking-tight uppercase",
                                        index % 2 === 0 ? "bg-white":"bg-[#FBFDFE]"
                                    )}>
                                        <button
                                            onClick={() => openSymbol(symbol)}
                                            title={`All transactions for ${symbol}`}
                                            className="hover:text-blue-600 transition-colors"
                                        >
                                            {maskSymbol(symbol)}
                                        </button>
                                    </td>
                                    {sortedMonths.map(month => {
                                        const data = matrix[symbol][month];
                                        if (!data || data.rawTransactions.length === 0) {
                                            return (
                                                <td key={month} className="px-3 py-1.5 text-center text-slate-200 font-black text-sm border-r border-slate-50 last:border-0">
                                                    —
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

                                        return (
                                            <td
                                                key={month}
                                                onClick={() => setSelectedCell({ symbol, month, transactions: data.rawTransactions })}
                                                className="px-3 py-1.5 border-r border-slate-50 last:border-0 text-center group-hover/row:bg-blue-50/20 transition-colors cursor-pointer hover:!bg-blue-100/50"
                                            >
                                                <div className={clsx(
                                                    "text-xs font-black tabular-nums leading-tight",
                                                    isSell ? "text-rose-600" : "text-slate-900"
                                                )}>
                                                    {mask(Math.abs(data.shares).toLocaleString())} @ {mask(avgPrice.toFixed(2))}
                                                </div>
                                                <div className={clsx(
                                                    "text-[11px] font-bold tabular-nums leading-tight",
                                                    isSell ? "text-rose-500" : "text-slate-400"
                                                )}>
                                                    {formatCurrency(Math.abs(data.totalAmount)).split('.')[0]}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

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