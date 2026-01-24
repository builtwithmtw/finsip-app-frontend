import React from 'react';
import { X, Clock } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    symbol: string;
    month: string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, transactions, symbol, month }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">{symbol}</span>
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">•</span>
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{month}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Monthly Breakdown</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-6">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map((t) => (
                                <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-4">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                                            <Clock size={12} className="text-slate-400" />
                                            {new Date(t.createdAt).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="py-4 text-center">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide",
                                            t.type === 'buy' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right font-bold text-slate-700 tabular-nums">
                                        {t.shares}
                                    </td>
                                    <td className="py-4 text-right font-bold text-slate-700 tabular-nums">
                                        {formatCurrency(t.pricePerShare)}
                                    </td>
                                    <td className="py-4 text-right font-black text-slate-900 tabular-nums">
                                        {formatCurrency(t.totalAmount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
