import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { Wallet, Plus, Calendar, DollarSign, PiggyBank, FileText, Edit2, Trash2, Check, X } from 'lucide-react';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { toast } from 'sonner';
import type { CashEntry } from '../types';

const CashPage: React.FC = () => {
    const { cashEntries, addCashEntry, updateCashEntry, deleteCashEntry } = usePortfolio();
    const { confirm } = useConfirm();
    const [formData, setFormData] = useState<{ month: string; amount: string; type: 'deposit' | 'withdraw'; memo: string }>({
        month: new Date().toISOString().slice(0, 7),
        amount: '',
        type: 'deposit',
        memo: '',
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ amount: number; memo: string; type: 'deposit' | 'withdraw' }>({
        amount: 0,
        memo: '',
        type: 'deposit'
    });

    const totalCash = cashEntries.reduce((sum, e) => {
        const amt = Number(e.amount) || 0;
        return sum + (e.type === 'withdraw' ? -amt : amt);
    }, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount) return;

        addCashEntry({
            month: formData.month,
            amount: Number(formData.amount),
            type: formData.type,
            memo: formData.memo,
        });

        const actionWord = formData.type === 'deposit' ? 'Allocated' : 'Withdrawn';
        toast.success(`${actionWord} ${formatCurrency(Number(formData.amount))} for ${formatMonth(formData.month)}`);
        setFormData(prev => ({ ...prev, amount: '', memo: '', type: 'deposit' }));
    };

    const handleStartEdit = (entry: CashEntry) => {
        setEditingId(entry.id);
        setEditData({
            amount: entry.amount,
            memo: entry.memo || '',
            type: entry.type || 'deposit'
        });
    };

    const handleSaveEdit = async (id: string) => {
        try {
            await updateCashEntry(id, editData);
            setEditingId(null);
            toast.success('Allocation updated');
        } catch (err) {
            // Error handled in context
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Remove Allocation',
            message: 'Are you sure you want to delete this cash entry? This will reduce your available budget pool.',
            variant: 'danger',
            confirmText: 'Delete Record',
            cancelText: 'Cancel'
        });

        if (isConfirmed) {
            try {
                await deleteCashEntry(id);
                toast.success('Allocation removed');
            } catch (err) {
                // Error handled in context
            }
        }
    };

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto uppercase">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Wallet className="text-blue-600" size={32} />
                    Capital Allocation
                </h1>
                <p className="text-slate-500 font-bold mt-1 pl-1 tracking-widest text-[10px]">RECORD YOUR SAVINGS AND MONTHLY BUDGET TRANSFERS.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Left side: Summary & Form */}
                <div className="xl:col-span-4 space-y-8">
                    {/* Total Cash Card */}
                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 text-white/5 group-hover:scale-110 transition-transform duration-500">
                            <PiggyBank size={180} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">Available Budget Pool</span>
                        <div className="text-4xl font-black text-white tracking-tighter tabular-nums">{formatCurrency(totalCash).split('.')[0]}</div>
                        <p className="text-slate-400 text-[10px] mt-4 font-black tracking-widest opacity-60">TOTAL CUMULATIVE SAVINGS RECORDED</p>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase">
                            <Plus size={20} className="text-blue-600" />
                            Provision Funds
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 px-1">Allocation Type</label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'deposit' })}
                                        className={`py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === 'deposit'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        DEPOSIT
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'withdraw' })}
                                        className={`py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === 'withdraw'
                                            ? 'bg-white text-rose-600 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        WITHDRAW
                                    </button>
                                </div>
                            </div>

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
                                        placeholder="E.G. MONTHLY SAVINGS"
                                        className="w-full h-12 bg-slate-50 border-0 rounded-xl pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        value={formData.memo}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className={`w-full h-14 ${formData.type === 'deposit' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500'} text-white rounded-2xl transition-all duration-300 font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95 uppercase tracking-widest`}
                            >
                                {formData.type === 'deposit' ? <Plus size={20} /> : <X size={20} />}
                                {formData.type === 'deposit' ? 'Commit Allocation' : 'Record Withdrawal'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Table area */}
                <div className="xl:col-span-8">
                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">Provisioning Journal</h2>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cashEntries.length} Records</div>
                        </div>

                        {cashEntries.length === 0 ? (
                            <div className="p-24 text-center flex flex-col items-center">
                                <Wallet size={64} className="text-slate-100 mb-6" />
                                <p className="text-slate-300 font-black uppercase tracking-[0.5em] text-[10px]">Matrix Empty • No Allocations Found</p>
                            </div>
                        ) : (
                            <div className="max-h-[650px] overflow-y-auto overflow-x-auto scrollbar-hide-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#2563EB] text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Applicable Month</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Type</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Memo / Origin</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Value (Rs.)</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[...cashEntries].sort((a, b) => b.month.localeCompare(a.month)).map((entry) => (
                                            <tr key={entry.id} className="hover:bg-blue-50/20 group transition-all duration-300">
                                                <td className="px-8 py-5">
                                                    <span className="font-black text-slate-900 uppercase tracking-tight">{formatMonth(entry.month)}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    {editingId === entry.id ? (
                                                        <select
                                                            value={editData.type}
                                                            onChange={e => setEditData({ ...editData, type: e.target.value as 'deposit' | 'withdraw' })}
                                                            className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-4 ring-blue-500/10 font-bold text-[10px] uppercase"
                                                        >
                                                            <option value="deposit">Deposit</option>
                                                            <option value="withdraw">Withdraw</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${entry.type === 'withdraw'
                                                            ? 'bg-rose-100 text-rose-600'
                                                            : 'bg-emerald-100 text-emerald-600'
                                                            }`}>
                                                            {entry.type || 'deposit'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    {editingId === entry.id ? (
                                                        <input
                                                            type="text"
                                                            value={editData.memo}
                                                            onChange={e => setEditData({ ...editData, memo: e.target.value })}
                                                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-4 ring-blue-500/10 font-bold text-xs"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-slate-500 text-xs">{entry.memo || '—'}</span>
                                                    )}
                                                </td>
                                                <td className={`px-8 py-5 text-right font-black ${(editingId === entry.id ? editData.type : entry.type) === 'withdraw' ? 'text-rose-600' : 'text-blue-600'
                                                    } text-lg tabular-nums`}>
                                                    {editingId === entry.id ? (
                                                        <input
                                                            type="number"
                                                            value={editData.amount}
                                                            onChange={e => setEditData({ ...editData, amount: Number(e.target.value) })}
                                                            className="w-32 px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-4 ring-blue-500/10 text-right font-black"
                                                        />
                                                    ) : (
                                                        `${entry.type === 'withdraw' ? '-' : ''}${formatCurrency(entry.amount).split('.')[0].replace('Rs', '')}`
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {editingId === entry.id ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleSaveEdit(entry.id)}
                                                                    className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingId(null)}
                                                                    className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStartEdit(entry)}
                                                                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(entry.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
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
