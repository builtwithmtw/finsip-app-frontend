"use client";

import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask } from '../context/PrivacyContext';
import { computeHoldings } from '../utils/holdings';



const HoldingsTable: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const { transactions, stocks } = usePortfolio();

    const holdings = useMemo(() =>
        computeHoldings(transactions)
            .map(h => ({
                ...h,
                totalInvested: h.totalCostBasis,
                sector: stocks.find(s => s.symbol === h.symbol)?.sector || 'Others',
            }))
            .sort((a, b) => b.totalInvested - a.totalInvested),
        [transactions, stocks]
    );

    const totalPortfolioValue = useMemo(() =>
        holdings.reduce((sum, h) => sum + h.totalInvested, 0),
        [holdings]
    );

    if (holdings.length === 0) return null;

    return (
        <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Asset Allocation</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">By Invested Cost</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Total Invested</span>
                    <span className="text-base font-black text-slate-900 tracking-tight">
                        {formatCurrency(totalPortfolioValue).split('.')[0]}
                    </span>
                </div>
            </div>


            <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[620px] text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Symbol</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sector</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Shares</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Avg Cost</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Invested</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Portfolio %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {holdings.map((stock) => {
                            const allocation = totalPortfolioValue > 0
                                ? (stock.totalInvested / totalPortfolioValue) * 100
                                : 0;

                            return (
                                <tr key={stock.symbol} className="hover:bg-blue-50/30 transition-all duration-300 group">
                                    <td className="px-4 py-2.5">
                                        <div className="font-black text-slate-900 text-sm uppercase tracking-tight group-hover:text-blue-600 transition-colors">{mask(stock.symbol)}</div>
                                    </td>
                                    {/* Sector isn't masked -- it's a market classification, not a position. */}
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stock.sector}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-slate-600 text-sm tabular-nums">
                                        {mask(stock.totalShares.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-slate-600 text-sm tabular-nums">
                                        {/* Rounded to whole rupees: the paisa on an average cost is noise. */}
                                        {formatCurrency(Math.round(stock.avgPrice)).replace('Rs', '')}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-blue-600 text-sm tabular-nums">
                                        {formatCurrency(Math.round(stock.totalInvested)).replace('Rs', '')}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden ">
                                                <div
                                                    className="h-full bg-blue-600 rounded-full"
                                                    style={{ width: `${allocation}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-slate-900 text-xs tabular-nums w-12 text-right">{allocation.toFixed(1)}%</span>
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