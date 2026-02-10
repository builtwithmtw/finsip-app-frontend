import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useProxy } from '../context/ProxyContext';
import { formatCurrency } from '../utils/formatters';
import { TrendingUp, TrendingDown, Landmark, Activity, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import clsx from 'clsx';
import type { Transaction } from '../types';

const LivePortfolioPage: React.FC = () => {
    const { transactions, loading, livePrices, isMarketLive, realizedProfits } = usePortfolio();
    const { selectedProxy, setShowModal, retryFetch } = useProxy();
    const [lastUpdated] = useState<Date>(new Date());
    const [activeTab, setActiveTab] = useState<'live' | 'settled'>('live');

    const holdings = useMemo(() => {
        const map = new Map<string, { totalShares: number; totalCostBasis: number }>();

        [...transactions]
            .filter(t => t.shares > 0 && t.pricePerShare > 0)
            .sort((a, b) => a.month.localeCompare(b.month))
            .forEach((t: Transaction) => {
                const current = map.get(t.symbol) || { totalShares: 0, totalCostBasis: 0 };
                const sharesNum = Number(t.shares || 0);
                const priceNum = Number(t.pricePerShare || 0);
                const amountNum = Number(t.totalAmount || (sharesNum * priceNum));

                if (t.type === 'buy') {
                    current.totalShares += sharesNum;
                    current.totalCostBasis += amountNum;
                } else {
                    const avgPriceBeforeSell = current.totalShares > 0 ? current.totalCostBasis / current.totalShares : 0;
                    current.totalShares -= sharesNum;
                    current.totalCostBasis -= sharesNum * avgPriceBeforeSell;
                }

                if (current.totalShares > 0.001) {
                    map.set(t.symbol, current);
                } else {
                    map.delete(t.symbol);
                }
            });

        return Array.from(map.entries()).map(([symbol, data]) => {
            const currentPrice = livePrices[symbol] || 0;
            const marketValue = data.totalShares * currentPrice;
            const avgPrice = data.totalShares > 0 ? data.totalCostBasis / data.totalShares : 0;
            const profitLoss = marketValue - data.totalCostBasis;
            const profitLossPercentage = data.totalCostBasis > 0 ? (profitLoss / data.totalCostBasis) * 100 : 0;

            return {
                symbol,
                quantity: data.totalShares,
                avgPrice,
                currentPrice,
                marketValue,
                totalCost: data.totalCostBasis,
                profitLoss,
                profitLossPercentage
            };
        }).sort((a, b) => b.totalCost - a.totalCost);
    }, [transactions, livePrices]);

    const totals = useMemo(() => {
        return holdings.reduce((acc, h) => ({
            totalCost: acc.totalCost + h.totalCost,
            totalValue: acc.totalValue + h.marketValue,
            totalPL: acc.totalPL + h.profitLoss
        }), { totalCost: 0, totalValue: 0, totalPL: 0 });
    }, [holdings]);

    const realizedTotals = useMemo(() => {
        return realizedProfits.reduce((acc, p) => acc + p.realizedProfit, 0);
    }, [realizedProfits]);

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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Initializing Live Engine</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 uppercase">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-blue-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/10 group-hover:scale-105 transition-transform">
                            {activeTab === 'live' ? <Activity className="text-white" size={36} /> : <Zap className="text-white" size={36} />}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-1 w-8 bg-blue-600 rounded-full" />
                            <span className="text-[10px] font-black text-blue-600 tracking-[0.3em]">Institutional Grade</span>
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
                            {activeTab === 'live' ? 'Live Terminal' : 'Settled P&L'}
                        </h1>
                        <p className="text-slate-400 font-bold tracking-[0.2em] text-[10px] mt-1 drop-shadow-sm">
                            {activeTab === 'live' ? 'Real-time Matrix Overview • KSE Main Gateway' : 'Historical Realized Gains • Finalized Matrix'}
                        </p>
                    </div>
                </div>


                <div className="flex flex-col 2xl:flex-row gap-6 2xl:items-center mt-6 xl:mt-0">


                    <div>
                        <button
                            onClick={() => setActiveTab('live')}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl text-[9px] font-black tracking-widest transition-all",
                                activeTab === 'live' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            LIVE FEED
                        </button>
                        <button
                            onClick={() => setActiveTab('settled')}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl text-[9px] font-black tracking-widest transition-all",
                                activeTab === 'settled' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            SETTLED P&L
                        </button>
                    </div>


                    {activeTab === 'live' && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className={clsx(
                                "flex items-center gap-5 px-8 py-4 rounded-[2rem] border shadow-2xl transition-all duration-1000",
                                isMarketLive ? "bg-white border-white ring-8 ring-emerald-50/50" : "bg-slate-50 border-slate-200"
                            )}>
                                <div className="relative">
                                    <div className={clsx("w-4 h-4 rounded-full shadow-[0_0_15px]", isMarketLive ? "bg-emerald-500 shadow-emerald-500/50" : "bg-slate-300 shadow-transparent")} />
                                    {isMarketLive && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40 scale-150" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-0.5">
                                        {isMarketLive ? 'Link Active' : 'Establishing Sync'}
                                    </span>
                                    <div className="flex items-center gap-2 font-bold text-[9px] text-slate-400">
                                        <Zap size={10} className={isMarketLive ? "text-amber-500" : "text-slate-300"} />
                                        <span>LATENCY: 42MS • {lastUpdated.toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-xl flex items-center gap-1">
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="px-4 py-2 hover:bg-slate-50 rounded-xl flex flex-col items-start transition-all group"
                                >
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Gateway</span>
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1.5">
                                        {selectedProxy.name}
                                        <Activity size={10} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </span>
                                </button>
                                <div className="w-px h-8 bg-slate-100 mx-1" />
                                <button
                                    onClick={() => retryFetch()}
                                    className="p-3 hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 rounded-xl transition-all active:rotate-180 duration-500"
                                    title="Force Reconnaissance"
                                >
                                    <Activity size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>


            </div>

            {activeTab === 'live' ? (
                <>
                    {/* Performance Widgets + Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-slate-900 p-6 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute -right-8 -top-8 text-white/[0.03] group-hover:scale-150 transition-transform duration-1000">
                                    <Landmark size={240} />
                                </div>
                                <div className="relative">
                                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] block mb-4">Total Aggregate Worth</span>
                                    <div className="text-4xl font-black tracking-tighter tabular-nums mb-3 drop-shadow-md">
                                        {formatCurrency(totals.totalValue).split('.')[0]}
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <Activity size={12} className="text-blue-500" />
                                        <span>NET COST: {formatCurrency(totals.totalCost).split('.')[0]}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={clsx(
                                "p-6 rounded-[3rem] shadow-2xl relative overflow-hidden group border transition-all duration-500",
                                totals.totalPL >= 0 ? "bg-white border-emerald-100 shadow-emerald-500/5" : "bg-white border-rose-100 shadow-rose-500/5"
                            )}>
                                <div className="absolute -right-8 -bottom-8 p-4 opacity-[0.03] group-hover:scale-125 transition-transform duration-1000">
                                    {totals.totalPL >= 0 ? <TrendingUp size={220} /> : <TrendingDown size={220} />}
                                </div>
                                <div className="relative">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">Market Velocity</span>
                                    <div className={clsx(
                                        "text-4xl font-black tracking-tighter tabular-nums mb-3",
                                        totals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {totals.totalPL >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.totalPL)).split('.')[0]}
                                    </div>
                                    <div className={clsx(
                                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider",
                                        totals.totalPL >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                        {totals.totalPL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        {totals.totalCost > 0 ? ((totals.totalPL / totals.totalCost) * 100).toFixed(2) : '0.00'}% TOTAL GAIN
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-12 -mt-12" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5">Velocity Leader</span>
                            {topMovements.best ? (
                                <div className="flex items-center justify-between relative">
                                    <div>
                                        <div className="text-2xl font-black text-slate-900 tracking-tighter mb-1">{topMovements.best.symbol}</div>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-black">
                                            <TrendingUp size={12} />
                                            +{topMovements.best.profitLossPercentage.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-400 shadow-xl group-hover:rotate-12 transition-transform">
                                        <ArrowUpRight size={28} />
                                    </div>
                                </div>
                            ) : <span className="text-[10px] text-slate-300 font-bold italic">Scanning...</span>}
                        </div>

                        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full blur-3xl opacity-50 -mr-12 -mt-12" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5">Position Laggard</span>
                            {topMovements.worst ? (
                                <div className="flex items-center justify-between relative">
                                    <div>
                                        <div className="text-2xl font-black text-slate-900 tracking-tighter mb-1">{topMovements.worst.symbol}</div>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-black">
                                            <TrendingDown size={12} />
                                            {topMovements.worst.profitLossPercentage.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-rose-400 shadow-xl group-hover:-rotate-12 transition-transform">
                                        <ArrowDownRight size={28} />
                                    </div>
                                </div>
                            ) : <span className="text-[10px] text-slate-300 font-bold italic">Scanning...</span>}
                        </div>
                    </div>

                    {/* Pro Terminal Table */}
                    <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden relative group">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Instrument Source</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Holding Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Acquisition</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Live Feed</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Equity Total</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Portfolio %</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">P/L Vector</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {holdings.map((h, index) => (
                                        <tr key={h.symbol} className={clsx(
                                            "hover:bg-blue-50/40 transition-all duration-300 group/row cursor-default",
                                            index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                        )}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-1.5 h-10 bg-slate-900 rounded-full scale-y-0 group-hover/row:scale-y-100 transition-transform origin-center duration-500" />
                                                    <div>
                                                        <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none mb-1.5 transition-colors group-hover/row:text-blue-600 uppercase">{h.symbol}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-slate-900 tabular-nums text-xl tracking-tight">
                                                    {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Total Shares</div>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-slate-600 tabular-nums text-lg">{h.avgPrice.toFixed(2)}</div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Avg Price</div>
                                            </td>
                                            <td className="px-6 py-4 text-right relative">
                                                <div className="font-black text-blue-600 tabular-nums text-2xl tracking-tighter drop-shadow-sm group-hover/row:scale-110 transition-transform duration-500">
                                                    {h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '—'}
                                                </div>
                                                <div className="text-[9px] text-blue-400/60 font-black uppercase mt-1">Live Feed</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-blue-600 tabular-nums text-xl tracking-tight">
                                                    {formatCurrency(h.marketValue).split('.')[0].replace('Rs', '')}
                                                </div>
                                                <div className="text-[9px] text-blue-400/60 font-black uppercase mt-1">Equity Value</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-indigo-600 tabular-nums text-xl tracking-tight">
                                                    {((h.marketValue / (totals.totalValue + totals.totalPL)) * 100).toFixed(2)}%
                                                </div>
                                                <div className="text-[9px] text-indigo-400/60 font-black uppercase mt-1">Allocation</div>
                                            </td>
                                            <td className={clsx(
                                                "px-6 py-4 text-right font-black text-xl tabular-nums transition-all border-x border-slate-50",
                                                h.profitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                <div className="flex flex-col items-end">
                                                    <span className="drop-shadow-sm">{h.currentPrice > 0 ? (h.profitLoss >= 0 ? '+' : '-') + formatCurrency(Math.abs(h.profitLoss)).split('.')[0].replace('Rs', '') : '—'}</span>
                                                    <div className="mt-2.5 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                        <div
                                                            className={clsx("h-full transition-all duration-1000", h.profitLoss >= 0 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]")}
                                                            style={{ width: `${Math.min(100, (Math.abs(h.profitLoss) / (totals.totalValue * 0.05)) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                <div className={clsx(
                                                    "inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all border-2",
                                                    h.currentPrice > 0
                                                        ? (h.profitLossPercentage >= 0
                                                            ? "bg-emerald-50 border-emerald-100 text-emerald-700 shadow-xl shadow-emerald-500/10"
                                                            : "bg-rose-50 border-rose-100 text-rose-700 shadow-xl shadow-rose-500/10")
                                                        : "bg-slate-100 border-slate-200 text-slate-400"
                                                )}>
                                                    {h.currentPrice > 0 ? (h.profitLossPercentage >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />) : <Activity size={12} />}
                                                    {h.currentPrice > 0 ? (Math.abs(h.profitLossPercentage).toFixed(2) + '%') : 'OFF'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {holdings.length === 0 && (
                            <div className="py-24 text-center bg-slate-50/50">
                                <Activity className="mx-auto text-slate-200 mb-6" size={64} />
                                <p className="text-slate-400 font-black uppercase tracking-[0.5em] text-[10px]">Matrix Initializing • No Positions Detected</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Settled P&L Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -right-8 -top-8 text-white/[0.03] group-hover:scale-150 transition-transform duration-1000">
                                <Landmark size={200} />
                            </div>
                            <div className="relative">
                                <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] block mb-4">Cumulative Realized P&L</span>
                                <div className={clsx(
                                    "text-5xl font-black tracking-tighter tabular-nums mb-2",
                                    realizedTotals >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {realizedTotals >= 0 ? '+' : '-'}{formatCurrency(Math.abs(realizedTotals)).split('.')[0]}
                                </div>
                                <p className="text-slate-400 text-[10px] font-bold tracking-widest">FINALIZED CAPITAL GAINS/LOSSES</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">Settled Positions</span>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                                {realizedProfits.length}
                            </div>
                            <p className="text-slate-400 text-[10px] font-bold tracking-widest mt-1">COMPLETED EXIT CYCLES</p>
                        </div>

                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">Last Settlement</span>
                            <div className="text-2xl font-black text-slate-900 tracking-tighter truncate uppercase">
                                {realizedProfits[0]?.symbol || 'N/A'}
                            </div>
                            <p className="text-slate-400 text-[10px] font-bold tracking-widest mt-1">
                                {realizedProfits[0]?.sellDate || 'NO RECENT ACTIVITY'}
                            </p>
                        </div>
                    </div>

                    {/* Settled P&L Table */}
                    <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden relative group">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Instrument Exited</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Sold Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Avg Buy</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Avg Sell</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Realized P&L</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Exit date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {realizedProfits.map((p, index) => (
                                        <tr key={p.id} className={clsx(
                                            "hover:bg-blue-50/40 transition-all duration-300 group/row cursor-default",
                                            index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                        )}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-1.5 h-10 bg-slate-900 rounded-full scale-y-0 group-hover/row:scale-y-100 transition-transform origin-center duration-500" />
                                                    <div>
                                                        <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none mb-1.5 transition-colors group-hover/row:text-blue-600 uppercase">{p.symbol}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-slate-900 tabular-nums text-xl tracking-tight">
                                                    {p.quantitySold.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-600 tabular-nums text-lg">
                                                {p.avgBuyPrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums text-lg">
                                                {p.avgSellPrice.toFixed(2)}
                                            </td>
                                            <td className={clsx(
                                                "px-6 py-4 text-right font-black text-2xl tabular-nums drop-shadow-sm",
                                                p.realizedProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {p.realizedProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(p.realizedProfit)).split('.')[0].replace('Rs', '')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{p.sellDate}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {realizedProfits.length === 0 && (
                            <div className="py-24 text-center bg-slate-50/50">
                                <Zap className="mx-auto text-slate-200 mb-6" size={64} />
                                <p className="text-slate-400 font-black uppercase tracking-[0.5em] text-[10px]">Matrix Pure • No Realized Gains Recorded</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default LivePortfolioPage;
