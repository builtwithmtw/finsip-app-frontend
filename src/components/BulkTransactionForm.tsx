import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Save, TrendingUp, TrendingDown, Info, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';

const BulkTransactionForm: React.FC = () => {
    const { stocks, addTransaction, selectedMonth: month, livePrices } = usePortfolio();

    // price is left undefined until the user types, so an untouched field can fall back
    // to the live feed while a deliberately cleared one stays empty.
    const [inputs, setInputs] = useState<Record<string, { shares: string; price?: string; type: 'buy' | 'sell' }>>({});

    const handleInputChange = (symbol: string, field: 'shares' | 'price' | 'type', value: string) => {
        setInputs(prev => ({
            ...prev,
            [symbol]: {
                ...prev[symbol] || { type: 'buy', shares: '' },
                [field]: value
            }
        }));
    };

    // What the price box shows: the user's edit if they made one, otherwise the live quote.
    const priceFor = (symbol: string) => {
        const typed = inputs[symbol]?.price;
        if (typed !== undefined) return typed;
        const live = livePrices[symbol];
        return live > 0 ? live.toFixed(2) : '';
    };

    const isLivePrice = (symbol: string) => inputs[symbol]?.price === undefined && livePrices[symbol] > 0;

    const parsedEntries = useMemo(() => {
        return stocks.map(stock => {
            const data = inputs[stock.symbol];
            const shares = data?.shares ? Number(data.shares) : 0;
            const price = Number(priceFor(stock.symbol)) || 0;
            const type = data?.type || 'buy';
            return {
                symbol: stock.symbol,
                shares,
                price,
                type,
                total: shares * price
            };
        });
    }, [inputs, stocks, livePrices]);

    const totalMonthlyInvestment = useMemo(() => {
        return parsedEntries.reduce((sum, entry) => {
            return sum + (entry.type === 'sell' ? -entry.total : entry.total);
        }, 0);
    }, [parsedEntries]);

    const activeEntriesCount = useMemo(() => {
        return parsedEntries.filter(e => e.shares > 0 && e.price > 0).length;
    }, [parsedEntries]);

    const handleBulkSave = () => {
        if (activeEntriesCount === 0) {
            toast.error("Please enter at least one transaction quantity and price.");
            return;
        }

        parsedEntries.forEach(entry => {
            addTransaction({
                month,
                symbol: entry.symbol,
                shares: entry.shares,
                pricePerShare: entry.price,
                type: entry.type
            });
        });

        setInputs({});
        toast.success(`Successfully saved ${activeEntriesCount} entries for ${month}!`, {
            description: `Total net value: ${formatCurrency(totalMonthlyInvestment)}`
        });
    };

    if (stocks.length === 0) {
        return (
            <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-12 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <TrendingUp className="text-slate-400" size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-3">No Stocks Added Yet</h3>
                        <p className="text-slate-500 font-medium mb-6">
                            Before you can record monthly transactions, you need to add stocks to your portfolio.
                            Head over to the "Manage Stocks" page to get started.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-100">
                            <Info size={16} />
                            <span>Add stocks first, then return here to log your SIP entries</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm  border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Symbol</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price per Share</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stocks.map(stock => {
                                const entry = inputs[stock.symbol] || { type: 'buy' as const, shares: '' };
                                const priceValue = priceFor(stock.symbol);
                                const sharesVal = Number(entry.shares) || 0;
                                const priceVal = Number(priceValue) || 0;
                                const total = sharesVal * priceVal;
                                const fromLiveFeed = isLivePrice(stock.symbol);

                                return (
                                    <tr key={stock.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                                        <td className="px-4 py-1.5">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors uppercase">{stock.symbol}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{stock.sector || 'Others'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <div className="flex justify-center">
                                                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 ">
                                                    <button
                                                        onClick={() => handleInputChange(stock.symbol, 'type', 'buy')}
                                                        className={clsx(
                                                            "flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                                                            entry.type === 'buy'
                                                                ? "bg-white text-emerald-600 shadow-md transform scale-105":"text-slate-400 hover:text-slate-600")} > <TrendingUp size={12} /> Buy </button> <button onClick={() => handleInputChange(stock.symbol, 'type', 'sell')} className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                                                            entry.type === 'sell'
                                                                ? "bg-white text-rose-500 shadow-md transform scale-105":"text-slate-400 hover:text-slate-600"
                                                        )}
                                                    >
                                                        <TrendingDown size={12} />
                                                        Sell
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <div className="relative group/input max-w-[120px]">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.shares}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'shares', e.target.value)}
                                                    className="w-full bg-slate-50 border-0 rounded-md px-3 py-1.5 text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <div className="relative max-w-[160px]">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px]">Rs.</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={priceValue}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'price', e.target.value)}
                                                    className={clsx(
                                                        "w-full bg-slate-50 border-0 rounded-md pl-9 pr-3 py-1.5 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm",
                                                        fromLiveFeed ? "text-blue-600" : "text-slate-900"
                                                    )}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5 text-right">
                                            <div className={clsx(
                                                "font-black text-sm transition-all duration-300",
                                                total > 0 ? (entry.type === 'sell' ? "text-rose-500":"text-emerald-500") : "text-slate-200"
                                            )}>
                                                {total > 0 && (entry.type === 'sell' ? '-' : '')}
                                                {formatCurrency(total).split('.')[0]}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-900 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-500/10 rounded-md">
                                <Calculator className="text-blue-400" size={14} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assets Impacted</span>
                                <span className="text-white font-black text-sm tabular-nums">{activeEntriesCount} / {stocks.length}</span>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-slate-800 hidden sm:block" />

                        <div className="flex items-center gap-2">
                            <div className={clsx(
                                "p-1.5 rounded-md",
                                totalMonthlyInvestment >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
                            )}>
                                {totalMonthlyInvestment >= 0 ? <TrendingUp className="text-emerald-400" size={14} /> : <TrendingDown className="text-rose-400" size={14} />}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Monthly Value</span>
                                <span className={clsx(
                                    "font-black text-sm tracking-tight tabular-nums",
                                    totalMonthlyInvestment >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {formatCurrency(totalMonthlyInvestment)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleBulkSave}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={14} />
                        Commit All Transactions
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md border border-blue-100">
                <Info size={13} className="text-blue-600 flex-shrink-0" />
                <p className="text-[11px] text-blue-700 font-medium">
                    Entries with zero quantity or price will be ignored during save. "Sell" transactions will be subtracted from your total invested amount.
                </p>
            </div>
        </div>
    );
};

export default BulkTransactionForm;
