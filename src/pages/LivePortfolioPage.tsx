import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';
import { computeHoldings } from '../utils/holdings';

const LivePortfolioPage: React.FC = () => {
    const { transactions, loading, livePrices } = usePortfolio();

    const holdings = useMemo(() =>
        computeHoldings(transactions).map(h => {
            const currentPrice = livePrices[h.symbol] || 0;
            const marketValue = h.totalShares * currentPrice;
            const profitLoss = marketValue - h.totalCostBasis;
            const profitLossPercentage = h.totalCostBasis > 0 ? (profitLoss / h.totalCostBasis) * 100 : 0;

            return {
                symbol: h.symbol,
                quantity: h.totalShares,
                avgPrice: h.avgPrice,
                currentPrice,
                marketValue,
                totalCost: h.totalCostBasis,
                profitLoss,
                profitLossPercentage
            };
        }).sort((a, b) => b.totalCost - a.totalCost),
        [transactions, livePrices]
    );

    const totals = useMemo(() => {
        return holdings.reduce((acc, h) => ({
            totalCost: acc.totalCost + h.totalCost,
            totalValue: acc.totalValue + h.marketValue,
            totalPL: acc.totalPL + h.profitLoss
        }), { totalCost: 0, totalValue: 0, totalPL: 0 });
    }, [holdings]);

    const topMovements = useMemo(() => {
        const sorted = [...holdings].filter(h => h.currentPrice > 0).sort((a, b) => b.profitLossPercentage - a.profitLossPercentage);
        return {
            best: sorted[0] || null,
            worst: sorted[sorted.length - 1] || null
        };
    }, [holdings]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[500px] space-y-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Live Engine</p>
        </div>
    );


    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Summary Widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                <div className="bg-slate-900 px-4 py-3 rounded-lg text-white">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Aggregate Worth</span>
                    <div className="text-lg font-black tabular-nums tracking-tight">
                        {formatCurrency(totals.totalValue).split('.')[0]}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        Cost: {formatCurrency(totals.totalCost).split('.')[0]}
                    </div>
                </div>

                <div className={clsx(
                    "px-4 py-3 rounded-lg border bg-white",
                    totals.totalPL >= 0 ? "border-emerald-100" : "border-rose-100"
                )}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Market Velocity</span>
                    <div className={clsx(
                        "text-lg font-black tabular-nums tracking-tight",
                        totals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                        {totals.totalPL >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.totalPL)).split('.')[0]}
                    </div>
                    <div className={clsx(
                        "text-[9px] font-black uppercase tracking-widest mt-0.5",
                        totals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                        {totals.totalCost > 0 ? ((totals.totalPL / totals.totalCost) * 100).toFixed(2) : '0.00'}%
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Leader</span>
                    {topMovements.best ? (
                        <>
                            <div className="text-lg font-black text-slate-900 tracking-tight uppercase">{topMovements.best.symbol}</div>
                            <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">
                                +{topMovements.best.profitLossPercentage.toFixed(2)}%
                            </div>
                        </>
                    ) : <span className="text-[10px] text-slate-300 font-bold">—</span>}
                </div>

                <div className="bg-white px-4 py-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Laggard</span>
                    {topMovements.worst ? (
                        <>
                            <div className="text-lg font-black text-slate-900 tracking-tight uppercase">{topMovements.worst.symbol}</div>
                            <div className="text-[9px] font-black text-rose-600 uppercase tracking-widest mt-0.5">
                                {topMovements.worst.profitLossPercentage.toFixed(2)}%
                            </div>
                        </>
                    ) : <span className="text-[10px] text-slate-300 font-bold">—</span>}
                </div>
            </div>

            {/* Positions Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar -mx-px">
                    <table className="w-full min-w-[640px] text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Symbol</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Avg</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Live</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Alloc</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">P/L</th>
                                <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {holdings.map((h) => (
                                <tr key={h.symbol} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-2 font-black text-slate-900 text-sm uppercase tracking-tight">{h.symbol}</td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-600 text-sm tabular-nums">
                                        {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-600 text-sm tabular-nums">{h.avgPrice.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right font-black text-blue-600 text-sm tabular-nums">
                                        {h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-black text-slate-900 text-sm tabular-nums">
                                        {formatCurrency(h.marketValue).split('.')[0].replace('Rs', '')}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-500 text-sm tabular-nums">
                                        {totals.totalValue > 0 ? ((h.marketValue / totals.totalValue) * 100).toFixed(1) : '0.0'}%
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-2 text-right font-black text-sm tabular-nums",
                                        h.profitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {h.currentPrice > 0
                                            ? (h.profitLoss >= 0 ? '+' : '-') + formatCurrency(Math.abs(h.profitLoss)).split('.')[0].replace('Rs', '')
                                            : '—'}
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-2 text-right font-black text-sm tabular-nums",
                                        h.currentPrice === 0 ? "text-slate-300" : h.profitLossPercentage >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {h.currentPrice > 0 ? h.profitLossPercentage.toFixed(2) + '%' : 'OFF'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {holdings.length === 0 && (
                    <div className="py-12 text-center">
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No Positions</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LivePortfolioPage;
