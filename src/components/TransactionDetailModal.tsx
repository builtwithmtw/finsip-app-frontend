import React, { useState } from 'react';
import { X, Clock, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { toast } from 'sonner';
import clsx from 'clsx';

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    symbol: string;
    month: string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, transactions, symbol, month }) => {
    const { updateTransaction, deleteTransaction } = usePortfolio();
    const { confirm } = useConfirm();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ shares: number; pricePerShare: number }>({ shares: 0, pricePerShare: 0 });

    if (!isOpen) return null;

    const handleStartEdit = (t: Transaction) => {
        setEditingId(t.id);
        setEditData({ shares: t.shares, pricePerShare: t.pricePerShare });
    };

    const handleSaveEdit = async (id: string) => {
        try {
            await updateTransaction(id, editData);
            setEditingId(null);
        } catch (err) {
            // Error handled in context
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Delete Transaction',
            message: 'Are you sure you want to remove this specific entry? This will permanently affect your portfolio calculations.',
            variant: 'danger',
            confirmText: 'Delete Entry',
            cancelText: 'Cancel'
        });

        if (isConfirmed) {
            try {
                await deleteTransaction(id);
                toast.success('Entry removed');
            } catch (err) {
                // Error handled in context
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 uppercase">
            <div className="bg-white rounded-xl shadow-sm w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{symbol}</span>
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">•</span>
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{month}</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Audit Ledger</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-6">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest">Execution Timestamp</th>
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest text-center">Op Type</th>
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest text-right">Volume</th>
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest text-right">Net Value</th>
                                <th className="pb-4 text-[12px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map((t) => (
                                <tr key={t.id} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="py-3">
                                        <div className="flex items-center gap-3 text-slate-600 font-bold text-xs tracking-tight">
                                            <Clock size={14} className="text-slate-400" />
                                            {new Date(t.createdAt).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="py-4 text-center">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide",
                                            t.type === 'buy' ? "bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"
                                        )}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-black text-slate-900 tabular-nums">
                                        {editingId === t.id ? (
                                            <input
                                                type="number"
                                                value={editData.shares}
                                                onChange={(e) => setEditData({ ...editData, shares: Number(e.target.value) })}
                                                className="w-20 px-2 py-1 bg-white border border-blue-200 rounded text-right focus:outline-none focus:ring-2 ring-blue-500/20"
                                            />
                                        ) : (
                                            t.shares.toLocaleString()
                                        )}
                                    </td>
                                    <td className="py-3 text-right font-black text-slate-600 tabular-nums">
                                        {editingId === t.id ? (
                                            <input
                                                type="number"
                                                value={editData.pricePerShare}
                                                onChange={(e) => setEditData({ ...editData, pricePerShare: Number(e.target.value) })}
                                                className="w-24 px-2 py-1 bg-white border border-blue-200 rounded text-right focus:outline-none focus:ring-2 ring-blue-500/20"
                                            />
                                        ) : (
                                            formatCurrency(t.pricePerShare).replace('Rs', '')
                                        )}
                                    </td>
                                    <td className="py-3 text-right font-black text-slate-900 tabular-nums tracking-tight">
                                        {editingId === t.id
                                            ? formatCurrency(editData.shares * editData.pricePerShare).replace('Rs', '')
                                            : formatCurrency(t.totalAmount).replace('Rs', '')}
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingId === t.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveEdit(t.id)}
                                                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm "
                                                        title="Save Changes"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <ArrowLeft size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStartEdit(t)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete"
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

                <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Audit Trail Log: {transactions.length} Total Executions Detected
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
