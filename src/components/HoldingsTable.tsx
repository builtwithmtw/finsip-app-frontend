import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';

interface HoldingData {
    symbol: string;
    totalShares: number;
    avgPrice: number;
    totalInvested: number;
}

const HoldingsTable: React.FC = () => {
    const { transactions } = usePortfolio();

    const holdings = useMemo(() => {
        const map = new Map<string, HoldingData>();

        transactions
            .filter(t => t.shares > 0 && t.pricePerShare > 0)
            .forEach(t => {
                const existing = map.get(t.symbol) || {
                    symbol: t.symbol,
                    totalShares: 0,
                    avgPrice: 0,
                    totalInvested: 0,
                };

                if (t.type === 'sell') {
                    existing.totalShares -= t.shares;
                    existing.totalInvested -= t.totalAmount;
                } else {
                    existing.totalShares += t.shares;
                    existing.totalInvested += t.totalAmount;
                }
                map.set(t.symbol, existing);
            });

        return Array.from(map.values())
            .map(h => ({
                ...h,
                avgPrice: h.totalShares > 0 ? Math.max(0, h.totalInvested) / h.totalShares : 0,
            }))
            .filter(h => h.totalShares > 0)
            .sort((a, b) => b.totalInvested - a.totalInvested);
    }, [transactions]);

    const totalPortfolioValue = useMemo(() =>
        holdings.reduce((sum, h) => sum + h.totalInvested, 0),
        [holdings]
    );

    if (holdings.length === 0) return null;

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Symbol</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total Shares</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Avg. Price</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Market Value</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Portfolio %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {holdings.map((stock) => {
                            const allocation = totalPortfolioValue > 0
                                ? (stock.totalInvested / totalPortfolioValue) * 100
                                : 0;

                            return (
                                <tr key={stock.symbol} className="hover:bg-blue-50/30 transition-all duration-300">
                                    <td className="px-8 py-6">
                                        <div className="font-black text-slate-900 text-lg uppercase tracking-tight">{stock.symbol}</div>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-600">
                                        {stock.totalShares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-600">
                                        {formatCurrency(stock.avgPrice)}
                                    </td>
                                    <td className="px-8 py-6 text-right font-black text-blue-600 text-lg">
                                        {formatCurrency(stock.totalInvested)}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-slate-900 text-sm">{allocation.toFixed(2)}%</span>
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden shadow-inner">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                                                    style={{ width: `${allocation}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HoldingsTable;
