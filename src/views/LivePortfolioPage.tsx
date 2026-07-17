"use client";

import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask } from '../context/PrivacyContext';
import { SkeletonBar, SkeletonCard, SkeletonTableRows } from '../components/DashboardSkeleton';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';

const LivePortfolioPage: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const { transactions, loading, livePrices } = usePortfolio();

    const holdings = useMemo(() =>
        computeLiveHoldings(transactions, livePrices)
            .sort((a, b) => b.totalCostBasis - a.totalCostBasis),
        [transactions, livePrices]
    );

    const totals = useMemo(() => summarizeLive(holdings), [holdings]);

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
                    <SkeletonCard key={i} className="!p-4">
                        <SkeletonBar className="h-2.5 w-24 mb-3" />
                        <SkeletonBar className="h-5 w-32" />
                    </SkeletonCard>
                ))}
            </div>
            <SkeletonCard>
                <SkeletonTableRows rows={6} cols={6} />
            </SkeletonCard>
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
                            <div className="text-lg font-black text-slate-900 tracking-tight uppercase">{mask(topMovements.best.symbol)}</div>
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
                            <div className="text-lg font-black text-slate-900 tracking-tight uppercase">{mask(topMovements.worst.symbol)}</div>
                            <div className="text-[9px] font-black text-rose-600 uppercase tracking-widest mt-0.5">
                                {topMovements.worst.profitLossPercentage.toFixed(2)}%
                            </div>
                        </>
                    ) : <span className="text-[10px] text-slate-300 font-bold">—</span>}
                </div>
            </div>

            {totals.unpricedCount > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {totals.unpricedCount} position{totals.unpricedCount > 1 ? 's' : ''} not in the live feed — held at cost, excluded from P/L
                    </span>
                </div>
            )}

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
                                    <td className="px-4 py-2 font-black text-slate-900 text-sm uppercase tracking-tight">{mask(h.symbol)}</td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-600 text-sm tabular-nums">
                                        {mask(h.totalShares.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-600 text-sm tabular-nums">{mask(h.avgPrice.toFixed(2))}</td>
                                    <td className="px-4 py-2 text-right font-black text-blue-600 text-sm tabular-nums">
                                        {h.isPriced ? mask(h.currentPrice.toFixed(2)) : '—'}
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-2 text-right font-black text-sm tabular-nums",
                                        h.isPriced ? "text-slate-900" : "text-slate-400"
                                    )}>
                                        {formatCurrency(h.marketValue).split('.')[0].replace('Rs', '')}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-500 text-sm tabular-nums">
                                        {totals.totalValue > 0 ? ((h.marketValue / totals.totalValue) * 100).toFixed(1) : '0.0'}%
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-2 text-right font-black text-sm tabular-nums",
                                        !h.isPriced ? "text-slate-300" : h.profitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {h.isPriced
                                            ? (h.profitLoss >= 0 ? '+' : '-') + formatCurrency(Math.abs(h.profitLoss)).split('.')[0].replace('Rs', '')
                                            : '—'}
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-2 text-right font-black text-sm tabular-nums",
                                        !h.isPriced ? "text-slate-300" : h.profitLossPercentage >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {h.isPriced ? h.profitLossPercentage.toFixed(2) + '%' : 'AT COST'}
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