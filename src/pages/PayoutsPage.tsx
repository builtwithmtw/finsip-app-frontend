import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { TrendingUp, Plus, WalletCards, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'sonner';

const PayoutsPage: React.FC = () => {
    const { payouts, stocks, addPayout } = usePortfolio();
    const [formData, setFormData] = useState({
        symbol: '',
        date: new Date().toISOString().slice(0, 10),
        amount: '',
    });

    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
    const lastPayout = [...payouts].sort((a, b) => b.date.localeCompare(a.date))[0];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.symbol || !formData.amount) return;

        addPayout({
            symbol: formData.symbol,
            date: formData.date,
            amount: Number(formData.amount),
        });

        toast.success(`Recorded payout of ${formatCurrency(Number(formData.amount))} for ${formData.symbol}`);
        setFormData(prev => ({ ...prev, amount: '' }));
    };



    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <TrendingUp className="text-emerald-500" size={32} />
                    Payouts & Dividends
                </h1>
                <p className="text-slate-500 font-medium mt-1 pl-1">Earnings and passive income from your portfolio.</p>
            </div>

            {/* Payout Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 text-emerald-50/50 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Aggregate Earnings</span>
                    <div className="text-3xl font-black text-emerald-600">{formatCurrency(totalPayouts)}</div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 text-slate-50/50 group-hover:scale-110 transition-transform duration-500">
                        <WalletCards size={120} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Payment Volume</span>
                    <div className="text-3xl font-black text-slate-900">{payouts.length} <span className="text-xs font-bold text-slate-400 tracking-normal uppercase">Receipts</span></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Latest Entry</span>
                    {lastPayout ? (
                        <div>
                            <div className="text-2xl font-black text-slate-900">{formatCurrency(lastPayout.amount)}</div>
                            <div className="text-[10px] text-blue-500 font-black mt-1 uppercase tracking-wider">{lastPayout.symbol} • {new Date(lastPayout.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-300 font-bold italic">No payouts tracked</div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Form area */}
                <div className="xl:col-span-4 sticky top-8">
                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100">
                        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-emerald-500" />
                            Log New Receipt
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1 text-left">Asset Filter</label>
                                <select
                                    required
                                    className="w-full h-12 bg-slate-50 border-0 rounded-xl px-4 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all appearance-none cursor-pointer"
                                    value={formData.symbol}
                                    onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                >
                                    <option value="">Select Target...</option>
                                    {stocks.map(s => <option key={s.id} value={s.symbol}>{s.symbol}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1 text-left">Receipt Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="date"
                                        required
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all cursor-pointer"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1 text-left">Net Amount (Rs.)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="number"
                                        required
                                        placeholder="0.00"
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all duration-300 font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95"
                            >
                                <TrendingUp size={18} />
                                Commit Receipt
                            </button>
                        </form>
                    </div>
                </div>

                {/* Table area */}
                <div className="xl:col-span-8">
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">Historical Journal</h2>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{payouts.length} Total Records</div>
                        </div>

                        {payouts.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <TrendingUp size={48} className="text-slate-100 mb-4" />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No entries found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/80">
                                        <tr>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction At</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Credit Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {[...payouts].sort((a, b) => b.date.localeCompare(a.date)).map((payout) => (
                                            <tr key={payout.id} className="hover:bg-emerald-50/20 group transition-all duration-300">
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-slate-700">{new Date(payout.date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-900 uppercase tracking-wider">{payout.symbol}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black text-emerald-600 text-lg">{formatCurrency(payout.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayoutsPage;
