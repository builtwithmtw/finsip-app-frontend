import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { Trash2, MoveHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

const MonthlyView: React.FC = () => {
    const { transactions, stocks, deleteMonthTransactions } = usePortfolio();
    const { confirm } = useConfirm();

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

        const matrix: Record<string, Record<string, { shares: number; totalAmount: number; type: string }>> = {};

        filteredTransactions.forEach(t => {
            if (!matrix[t.symbol]) matrix[t.symbol] = {};
            if (!matrix[t.symbol][t.month]) {
                matrix[t.symbol][t.month] = { shares: 0, totalAmount: 0, type: t.type };
            }

            const existing = matrix[t.symbol][t.month];
            if (t.type === existing.type) {
                existing.shares += t.shares;
                existing.totalAmount += t.totalAmount;
            } else {
                existing.shares += (t.type === 'sell' ? -t.shares : t.shares);
                existing.totalAmount += (t.type === 'sell' ? -t.totalAmount : t.totalAmount);
            }
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
            <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="font-bold uppercase tracking-widest text-[10px]">No transaction history detected</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group">
            {/* Minimal Sub-header */}
            <div className="bg-slate-50/50 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Ledger</span>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <MoveHorizontal size={12} className="text-blue-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Scroll Matrix</span>
                </div>
            </div>

            <div className="overflow-x-auto w-full max-w-full custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max border-spacing-0">
                    <thead className="bg-[#2563EB] text-white font-black text-[11px] uppercase tracking-[0.15em] sticky top-0 z-20">
                        <tr>
                            <th className="px-6 py-4 sticky left-0 bg-[#2563EB] z-30 border-r border-blue-500/30">
                                Symbol
                            </th>
                            {sortedMonths.map(month => (
                                <th key={month} className="px-5 py-4 border-r border-blue-500/30 last:border-0 text-center min-w-[180px]">
                                    <div className="flex items-center justify-center gap-3 group/month">
                                        <span className="whitespace-nowrap">{formatMonth(month)}</span>
                                        <button
                                            onClick={() => handleDeleteMonth(month)}
                                            className="opacity-0 group-hover/month:opacity-100 p-1 hover:bg-white/20 rounded-md transition-all text-white/70 hover:text-white"
                                        >
                                            <Trash2 size={13} />
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
                                index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                            )}>
                                <td className={clsx(
                                    "px-6 py-3 font-black text-slate-900 sticky left-0 z-10 border-r border-slate-100 text-sm tracking-tighter uppercase shadow-[6px_0_15px_rgba(0,0,0,0.02)]",
                                    index % 2 === 0 ? "bg-white" : "bg-[#FBFDFE]"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-3 bg-blue-500 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                        {symbol}
                                    </div>
                                </td>
                                {sortedMonths.map(month => {
                                    const data = matrix[symbol][month];
                                    if (!data || data.shares === 0) {
                                        return (
                                            <td key={month} className="px-5 py-3 text-center text-slate-200 font-black text-lg border-r border-slate-50 last:border-0">
                                                —
                                            </td>
                                        );
                                    }

                                    const avgPrice = data.totalAmount / data.shares;
                                    const isSell = data.shares < 0 || (data.shares === 0 && data.totalAmount < 0);

                                    return (
                                        <td key={month} className="px-5 py-3 border-r border-slate-50 last:border-0 text-center group-hover/row:bg-blue-50/20 transition-colors">
                                            <div className="flex flex-col items-center">
                                                <div className={clsx(
                                                    "text-[14px] font-black tracking-tighter leading-none mb-1.5 tabular-nums",
                                                    isSell ? "text-rose-600" : "text-slate-900"
                                                )}>
                                                    {Math.abs(data.shares).toLocaleString()}
                                                    <span className="text-rose-600 font-black mx-1">@</span>
                                                    {avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className={clsx(
                                                    "text-[11px] font-black px-2.5 py-1 rounded-lg border leading-none transition-all",
                                                    isSell
                                                        ? "bg-rose-50 border-rose-100 text-rose-700"
                                                        : "bg-blue-50 border-blue-100 text-blue-800 group-hover/row:bg-blue-100"
                                                )}>
                                                    {formatCurrency(Math.abs(data.totalAmount)).split('.')[0]}
                                                </div>
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
    );
};

export default MonthlyView;
