import React, { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import { TrendingUp, TrendingDown, Landmark } from 'lucide-react';
import clsx from 'clsx';
import type { Transaction } from '../types';

const LivePortfolioPage: React.FC = () => {
    const { transactions, loading } = usePortfolio();
    const [stockPrices, setStockPrices] = useState<Record<string, number>>({});
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const targetUrl = "https://beta-restapi.sarmaaya.pk/api/indices/KSE100/companies?page=1&limit=500";
                const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
                const response = await fetch(proxyUrl);
                const json = await response.json();

                const prices: Record<string, number> = {};
                const dataArray = json.response.data || json;
                if (Array.isArray(dataArray)) {
                    dataArray.forEach((item: any) => {
                        const symbol = (item.symbol || item.ticker || "").toUpperCase();
                        const price = Number(item.curr || item.last_price || item.current_price || item.price || 0);
                        if (symbol && price > 0) {
                            prices[symbol] = price;
                        }
                    });
                    setStockPrices(prices);
                    setIsLive(true);
                }
            } catch (error) {
                console.error("Live price fetch failed:", error);
                setIsLive(false);
            }
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 60000);
        return () => clearInterval(interval);
    }, []);

    const holdings = useMemo(() => {
        const map = new Map<string, { totalShares: number; totalCost: number }>();

        transactions.forEach((t: Transaction) => {
            const current = map.get(t.symbol) || { totalShares: 0, totalCost: 0 };
            const sharesNum = Number(t.shares || 0);
            const amountNum = Number(t.totalAmount || 0);

            if (t.type === 'buy') {
                current.totalShares += sharesNum;
                current.totalCost += amountNum;
            } else {
                current.totalShares -= sharesNum;
                current.totalCost -= amountNum;
            }
            if (current.totalShares > 0) {
                map.set(t.symbol, current);
            } else {
                map.delete(t.symbol);
            }
        });

        return Array.from(map.entries()).map(([symbol, data]) => {
            const currentPrice = stockPrices[symbol] || 0;
            const marketValue = data.totalShares * currentPrice;
            const avgPrice = data.totalCost / data.totalShares;
            const profitLoss = marketValue - data.totalCost;
            const profitLossPercentage = data.totalCost > 0 ? (profitLoss / data.totalCost) * 100 : 0;

            return {
                symbol,
                quantity: data.totalShares,
                avgPrice,
                currentPrice,
                marketValue,
                totalCost: data.totalCost,
                profitLoss,
                profitLossPercentage
            };
        }).sort((a, b) => b.marketValue - a.marketValue);
    }, [transactions, stockPrices]);

    const totals = useMemo(() => {
        return holdings.reduce((acc, h) => ({
            totalCost: acc.totalCost + h.totalCost,
            totalValue: acc.totalValue + h.marketValue,
            totalPL: acc.totalPL + h.profitLoss
        }), { totalCost: 0, totalValue: 0, totalPL: 0 });
    }, [holdings]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 uppercase">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Landmark className="text-blue-600" size={32} />
                        Live Portfolio
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1 ml-11">
                        Real-time Equity Positions
                    </p>
                </div>

                <div className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-500",
                    isLive ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                )}>
                    <div className={clsx("w-2 h-2 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {isLive ? 'Live' : 'Market Offline / Connecting'}
                    </span>
                </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Invested</span>
                    <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.totalCost).split('.')[0]}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-blue-500/10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">Market Value</span>
                    <div className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totals.totalValue).split('.')[0]}</div>
                </div>
                <div className={clsx(
                    "p-6 rounded-3xl border shadow-sm transition-all animate-in fade-in",
                    totals.totalPL >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                )}>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">Net Gain/Loss</span>
                    <div className={clsx(
                        "text-2xl font-black flex items-center gap-2 tabular-nums",
                        totals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                        {totals.totalPL >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        {formatCurrency(Math.abs(totals.totalPL)).split('.')[0]}
                    </div>
                </div>
            </div>

            {/* Portfolio Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#2563EB] text-white">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Symbol</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Quantity</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Avg Price</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Live Price</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">P/L (Rs)</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Growth %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {holdings.map((h) => (
                                <tr key={h.symbol} className="hover:bg-blue-50/30 transition-all duration-300 group">
                                    <td className="px-8 py-5">
                                        <div className="font-black text-slate-900 text-lg uppercase tracking-tight">{h.symbol}</div>
                                    </td>
                                    <td className="px-8 py-5 text-right font-bold text-slate-700 tabular-nums">
                                        {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-8 py-5 text-right font-bold text-slate-500 tabular-nums">
                                        {h.avgPrice.toFixed(2)}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="font-black text-blue-600 text-lg tabular-nums">
                                            {h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '—'}
                                        </div>
                                    </td>
                                    <td className={clsx(
                                        "px-8 py-5 text-right font-black text-lg tabular-nums",
                                        h.profitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {h.currentPrice > 0 ? (h.profitLoss >= 0 ? '+' : '') + h.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                                    </td>
                                    <td className="px-8 py-5 text-right font-mono">
                                        <div className={clsx(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black",
                                            h.currentPrice > 0
                                                ? (h.profitLossPercentage >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
                                                : "bg-slate-100 text-slate-400"
                                        )}>
                                            {h.currentPrice > 0 ? (h.profitLossPercentage.toFixed(2) + '%') : 'N/A'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LivePortfolioPage;
