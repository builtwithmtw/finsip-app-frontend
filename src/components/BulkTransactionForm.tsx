import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, Save, TrendingUp, TrendingDown, Info, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';

const BulkTransactionForm: React.FC = () => {
    const { stocks, addTransaction } = usePortfolio();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

    // { [stockSymbol]: { shares: string, price: string, type: 'buy' | 'sell' } }
    const [inputs, setInputs] = useState<Record<string, { shares: string; price: string; type: 'buy' | 'sell' }>>({});

    const handleInputChange = (symbol: string, field: 'shares' | 'price' | 'type', value: string) => {
        setInputs(prev => ({
            ...prev,
            [symbol]: {
                ...prev[symbol] || { type: 'buy', shares: '', price: '' },
                [field]: value
            }
        }));
    };

    const parsedEntries = useMemo(() => {
        return stocks.map(stock => {
            const data = inputs[stock.symbol];
            const shares = data?.shares ? Number(data.shares) : 0;
            const price = data?.price ? Number(data.price) : 0;
            const type = data?.type || 'buy';
            return {
                symbol: stock.symbol,
                shares,
                price,
                type,
                total: shares * price
            };
        });
    }, [inputs, stocks]);

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
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Calendar className="text-blue-600" size={24} />
                        Monthly SIP Entry
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Record purchases for all your assets at once.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-12 text-center">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Calendar className="text-blue-600" size={24} />
                        Monthly SIP Entry
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Record purchases for all your assets at once.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Select Month:</span>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="rounded-xl border-0 bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 py-2 px-4 cursor-pointer"
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Symbol</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Type</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quantity</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Price per Share</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stocks.map(stock => {
                                const entry = inputs[stock.symbol] || { type: 'buy', shares: '', price: '' };
                                const sharesVal = Number(entry.shares) || 0;
                                const priceVal = Number(entry.price) || 0;
                                const total = sharesVal * priceVal;

                                return (
                                    <tr key={stock.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors uppercase">{stock.symbol}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stock.sector || 'Others'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                                                    <button
                                                        onClick={() => handleInputChange(stock.symbol, 'type', 'buy')}
                                                        className={clsx(
                                                            "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                                            entry.type === 'buy'
                                                                ? "bg-white text-emerald-600 shadow-md transform scale-105"
                                                                : "text-slate-400 hover:text-slate-600"
                                                        )}
                                                    >
                                                        <TrendingUp size={12} />
                                                        Buy
                                                    </button>
                                                    <button
                                                        onClick={() => handleInputChange(stock.symbol, 'type', 'sell')}
                                                        className={clsx(
                                                            "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                                            entry.type === 'sell'
                                                                ? "bg-white text-rose-500 shadow-md transform scale-105"
                                                                : "text-slate-400 hover:text-slate-600"
                                                        )}
                                                    >
                                                        <TrendingDown size={12} />
                                                        Sell
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="relative group/input max-w-[120px]">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.shares}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'shares', e.target.value)}
                                                    className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="relative max-w-[160px]">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">Rs.</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.price}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'price', e.target.value)}
                                                    className="w-full bg-slate-50 border-0 rounded-xl pl-10 pr-4 py-3 text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className={clsx(
                                                "font-black text-lg transition-all duration-300",
                                                total > 0 ? (entry.type === 'sell' ? "text-rose-500" : "text-emerald-500") : "text-slate-200"
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

                <div className="bg-slate-900 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl">
                                <Calculator className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Total Assets Impacted</span>
                                <span className="text-white font-bold text-xl">{activeEntriesCount} / {stocks.length}</span>
                            </div>
                        </div>

                        <div className="w-px h-10 bg-slate-800 hidden md:block"></div>

                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "p-3 rounded-2xl",
                                totalMonthlyInvestment >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
                            )}>
                                {totalMonthlyInvestment >= 0 ? <TrendingUp className="text-emerald-400" size={24} /> : <TrendingDown className="text-rose-400" size={24} />}
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Net Monthly Value</span>
                                <span className={clsx(
                                    "font-black text-2xl tracking-tighter",
                                    totalMonthlyInvestment >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {formatCurrency(totalMonthlyInvestment)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleBulkSave}
                        className="group relative bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl transition-all duration-300 font-bold flex items-center gap-3 shadow-xl shadow-blue-900/20 active:scale-95 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <Save size={20} className="group-hover:rotate-12 transition-transform" />
                        <span className="tracking-wide">Commit All Transactions</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <Info size={18} className="text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-700 font-medium">
                    Entries with zero quantity or price will be ignored during save. "Sell" transactions will be subtracted from your total invested amount.
                </p>
            </div>
        </div>
    );
};

export default BulkTransactionForm;
