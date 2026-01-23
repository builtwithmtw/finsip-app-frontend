import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Wallet, Plus, Trash2, Calendar, DollarSign, PiggyBank } from 'lucide-react';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { toast } from 'sonner';

const CashPage: React.FC = () => {
    const { cashEntries, addCashEntry, deleteCashEntry } = usePortfolio();
    const [formData, setFormData] = useState({
        date: new Date().toISOString().slice(0, 7),
        amount: '',
        description: '',
    });

    const totalCash = cashEntries.reduce((sum, e) => sum + e.amount, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount) return;

        addCashEntry({
            date: formData.date,
            amount: Number(formData.amount),
            description: formData.description || 'Monthly SIP Allocation',
        });

        toast.success(`Allocated ${formatCurrency(Number(formData.amount))} for ${formatMonth(formData.date)}`);
        setFormData(prev => ({ ...prev, amount: '', description: '' }));
    };

    const handleDelete = (id: string, date: string) => {
        if (window.confirm(`Delete cash allocation record for ${formatMonth(date)}?`)) {
            deleteCashEntry(id);
            toast.success(`Removed allocation for ${formatMonth(date)}`);
        }
    };

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Wallet className="text-blue-600" size={32} />
                    Capital Allocation
                </h1>
                <p className="text-slate-500 font-medium mt-1 pl-1">Record your savings and monthly budget transfers.</p>
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
                        <div className="text-4xl font-black text-white tracking-tighter">{formatCurrency(totalCash)}</div>
                        <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-wider">Total cumulative savings recorded</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100">
                        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-blue-600" />
                            Provision Funds
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Target Month</label>
                                <div className="relative font-bold">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                    <input
                                        type="month"
                                        required
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all cursor-pointer"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Allocation Value (Rs.)</label>
                                <div className="relative font-bold">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="number"
                                        required
                                        placeholder="0.00"
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Memo / Origin</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Salary Transfer"
                                    className="w-full h-12 bg-slate-50 border-0 rounded-xl px-4 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all duration-300 font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95"
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
                            <h2 className="text-lg font-black text-slate-900">Provisioning Journal</h2>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cashEntries.length} Records</div>
                        </div>

                        {cashEntries.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Wallet size={48} className="text-slate-100 mb-4" />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No allocations recorded</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/80">
                                        <tr>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Applicable Month</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Origin/Memo</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Credit Value</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right w-20">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {[...cashEntries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
                                            <tr key={entry.id} className="hover:bg-blue-50/20 group transition-all duration-300">
                                                <td className="px-8 py-5">
                                                    <span className="font-black text-slate-900 uppercase tracking-tight">{formatMonth(entry.date)}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-slate-500 font-bold text-sm italic">{entry.description}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black text-blue-600 text-lg">{formatCurrency(entry.amount)}</td>
                                                <td className="px-8 py-5 text-right">
                                                    <button
                                                        onClick={() => handleDelete(entry.id, entry.date)}
                                                        className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
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
