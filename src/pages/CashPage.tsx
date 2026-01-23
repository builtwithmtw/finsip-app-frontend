import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Wallet, Plus, Calendar, DollarSign, PiggyBank, FileText } from 'lucide-react';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { toast } from 'sonner';

const CashPage: React.FC = () => {
    const { cashEntries, addCashEntry } = usePortfolio();
    const [formData, setFormData] = useState({
        month: new Date().toISOString().slice(0, 7),
        amount: '',
        memo: '',
    });

    const totalCash = cashEntries.reduce((sum, e) => sum + e.amount, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount) return;

        addCashEntry({
            month: formData.month,
            amount: Number(formData.amount),
            memo: formData.memo,
        });

        toast.success(`Allocated ${formatCurrency(Number(formData.amount))} for ${formatMonth(formData.month)}`);
        setFormData(prev => ({ ...prev, amount: '', memo: '' }));
    };

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
                    <Wallet className="text-blue-600" size={32} />
                    Capital Allocation
                </h1>
                <p className="text-slate-500 font-medium mt-1 pl-1 italic">Record your savings and monthly budget transfers.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Left side: Summary & Form */}
                <div className="xl:col-span-4 space-y-8">
                    {/* Total Cash Card */}
                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl shadow-blue-900/10 relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 text-white/5 group-hover:scale-110 transition-transform duration-500">
                            <PiggyBank size={180} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">Available Budget Pool</span>
                        <div className="text-4xl font-black text-white tracking-tighter uppercase">{formatCurrency(totalCash).split('.')[0]}</div>
                        <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-wider">Total cumulative savings recorded</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100">
                        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase">
                            <Plus size={20} className="text-blue-600" />
                            Provision Funds
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">Target Month</label>
                                <div className="relative font-bold">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                    <input
                                        type="month"
                                        required
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all cursor-pointer"
                                        value={formData.month}
                                        onChange={e => setFormData({ ...formData, month: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">Allocation Value (Rs.)</label>
                                <div className="relative font-bold">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="number"
                                        required
                                        placeholder="0"
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">Memo / Origin</label>
                                <div className="relative font-bold">
                                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        placeholder="e.g. Monthly Savings"
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        value={formData.memo}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all duration-300 font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95 uppercase"
                            >
                                <Plus size={20} />
                                Commit Allocation
                            </button>
                        </form>
                    </div>
                </div>

                {/* Table area */}
                <div className="xl:col-span-8">
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 uppercase">Provisioning Journal</h2>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cashEntries.length} Records</div>
                        </div>

                        {cashEntries.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Wallet size={48} className="text-slate-100 mb-4" />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No allocations recorded</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#2563EB] text-white">
                                        <tr>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Applicable Month</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Memo / Origin</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Credit Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 uppercase">
                                        {[...cashEntries].sort((a, b) => b.month.localeCompare(a.month)).map((entry) => (
                                            <tr key={entry.id} className="hover:bg-blue-50/20 group transition-all duration-300">
                                                <td className="px-8 py-5">
                                                    <span className="font-black text-slate-900 uppercase tracking-tight">{formatMonth(entry.month)}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-slate-500 text-xs">{entry.memo || '—'}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black text-blue-600 text-lg tabular-nums">{formatCurrency(entry.amount).split('.')[0]}</td>
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

export default CashPage;
