import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatMonth } from '../utils/formatters';
import { useCurrency } from '../context/PrivacyContext';
import { BarChart3 } from 'lucide-react';
import type { MonthlySummary } from '../types';

const MonthlySummaryView: React.FC = () => {
    const formatCurrency = useCurrency();
    const { transactions } = usePortfolio();

    const summaries = useMemo(() => {
        const map = new Map<string, MonthlySummary>();

        transactions
            .filter(t => t.shares > 0 && t.pricePerShare > 0)
            .forEach(t => {
                const existing = map.get(t.month) || {
                    month: t.month,
                    totalInvested: 0,
                    transactionCount: 0,
                };

                existing.totalInvested += t.totalAmount;
                existing.transactionCount += 1;
                map.set(t.month, existing);
            });

        return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
    }, [transactions]);

    if (summaries.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                <h2 className="text-xl font-bold text-slate-800">Monthly Summary</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium text-sm">
                        <tr>
                            <th className="px-6 py-4">Month</th>
                            <th className="px-6 py-4 text-center">Transactions</th>
                            <th className="px-6 py-4 text-right">Total Invested</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {summaries.map((s) => (
                            <tr key={s.month} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-black text-slate-800">{formatMonth(s.month)}</td>
                                <td className="px-6 py-4 text-center text-slate-600">
                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                        {s.transactionCount}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-indigo-600">
                                    {formatCurrency(s.totalInvested)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlySummaryView;
