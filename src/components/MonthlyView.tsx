import React, { useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import TransactionDetailModal from './TransactionDetailModal';
import type { Transaction } from '../types';

const MonthlyView: React.FC = () => {
    const { transactions, stocks, deleteMonthTransactions } = usePortfolio();
    const { confirm } = useConfirm();

    // State for the detail modal
    const [selectedCell, setSelectedCell] = useState<{
        symbol: string;
        month: string;
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

    if (filteredTransactions.length === 0) {
        return (
            <div className="text-center py-20 text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                <p className="font-bold uppercase tracking-widest text-[10px]">No transaction history detected</p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col group">
                <div className="overflow-x-auto w-full max-w-full custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-max border-spacing-0">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest sticky top-0 z-20">
                            <tr>
                                <th className="px-4 py-2.5 sticky left-0 bg-slate-50 z-30 border-r border-slate-100">
                                    Symbol
                                </th>
                                {sortedMonths.map(month => (
                                    <th key={month} className="px-3 py-2.5 border-r border-slate-100 last:border-0 text-center min-w-[130px]">
                                        <div className="flex items-center justify-center gap-2 group/month">
                                            <span className="whitespace-nowrap">{formatMonth(month)}</span>
                                            <button
                                                onClick={() => handleDeleteMonth(month)}
                                                className="opacity-0 group-hover/month:opacity-100 p-0.5 hover:bg-rose-50 rounded transition-all text-slate-300 hover:text-rose-500"
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
                                        <span>{symbol}</span>
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

                                        // A month that buys and fully sells nets to zero shares, so fall back to a
                                        // volume-weighted price rather than dividing by it.
                                        const grossShares = data.rawTransactions.reduce((sum, t) => sum + t.shares, 0);
                                        const grossAmount = data.rawTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
                                        const avgPrice = data.shares !== 0
                                            ? data.totalAmount / data.shares
                                            : (grossShares > 0 ? grossAmount / grossShares : 0);

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
                                                    {Math.abs(data.shares).toLocaleString()} @ {avgPrice.toFixed(2)}
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
                symbol={selectedCell?.symbol || ''}
                month={selectedCell?.month || ''}
            />
        </>
    );
};

export default MonthlyView;
