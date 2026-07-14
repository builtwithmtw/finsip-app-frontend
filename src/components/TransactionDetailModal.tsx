import React, { useState } from 'react';
import { X, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';
import type { Transaction } from '../types';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { toast } from 'sonner';
import clsx from 'clsx';

/**
 * Three ways in, all sorted by date:
 *   symbol + month -> one cell of the ledger
 *   month only     -> every trade that month, across symbols (rows carry the symbol)
 *   symbol only    -> every trade for that symbol, across months
 */
interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    symbol?: string;
    month?: string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, transactions, symbol, month }) => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();
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

    const total = transactions.reduce((sum, t) => sum + (t.type === 'sell' ? -t.totalAmount : t.totalAmount), 0);

    // Newest first.
    const ordered = [...transactions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                            {symbol && month ? (
                                <>
                                    {maskSymbol(symbol)} <span className="text-slate-300 font-normal">·</span> <span className="text-slate-500 font-normal">{formatMonth(month)}</span>
                                </>
                            ) : symbol ? (
                                maskSymbol(symbol)
                            ) : month ? (
                                formatMonth(month)
                            ) : (
                                'Transactions'
                            )}
                        </h2>
                        <p className="text-xs font-medium text-slate-400 mt-0.5">
                            {symbol && !month && <>All months<span className="text-slate-300"> · </span></>}
                            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                            <span className="text-slate-300"> · </span>
                            net {formatCurrency(Math.abs(total)).split('.')[0]}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="shrink-0 -mr-2 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto custom-scrollbar border-t border-slate-100">
                    <table className="w-full min-w-[560px] text-left border-collapse">
                        {/* The last column is w-px: it shrinks to exactly the width of the two
                            buttons instead of reserving a wide, mostly-empty gutter on the right. */}
                        <colgroup>
                            {!symbol && <col className="w-[16%]" />}
                            <col className="w-[24%]" />
                            <col className="w-[14%]" />
                            <col />
                            <col />
                            <col />
                            <col className="w-px" />
                        </colgroup>

                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                                {!symbol && <th className="px-6 py-2.5 font-semibold">Symbol</th>}
                                <th className={clsx('py-2.5 font-semibold', symbol ? 'px-6' : 'px-4')}>Date</th>
                                <th className="px-4 py-2.5 font-semibold">Type</th>
                                <th className="px-4 py-2.5 font-semibold text-right">Shares</th>
                                <th className="px-4 py-2.5 font-semibold text-right">Price</th>
                                <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                                <th className="w-px pl-2 pr-5 py-2.5" />
                            </tr>
                        </thead>

                        <tbody>
                            {ordered.map((t) => {
                                const isEditing = editingId === t.id;

                                return (
                                    <tr
                                        key={t.id}
                                        className="group relative border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        {!symbol && (
                                            <td className="px-6 py-3 text-sm font-bold text-slate-900 uppercase tracking-tight">
                                                {maskSymbol(t.symbol)}
                                            </td>
                                        )}

                                        <td className={clsx('py-3 text-sm font-medium text-slate-500 whitespace-nowrap', symbol ? 'px-6' : 'px-4')}>
                                            {new Date(t.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className={clsx(
                                                'inline-flex items-center gap-1.5 text-xs font-semibold capitalize',
                                                t.type === 'buy' ? 'text-emerald-600' : 'text-rose-600'
                                            )}>
                                                <span className={clsx(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    t.type === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'
                                                )} />
                                                {t.type}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editData.shares}
                                                    onChange={(e) => setEditData({ ...editData, shares: Number(e.target.value) })}
                                                    className="w-full max-w-[90px] px-2 py-1 border border-slate-200 rounded-md text-right text-sm tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                                                />
                                            ) : (
                                                mask(t.shares.toLocaleString())
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-500 tabular-nums">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editData.pricePerShare}
                                                    onChange={(e) => setEditData({ ...editData, pricePerShare: Number(e.target.value) })}
                                                    className="w-full max-w-[90px] px-2 py-1 border border-slate-200 rounded-md text-right text-sm tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                                                />
                                            ) : (
                                                formatCurrency(t.pricePerShare).replace('Rs', '').trim()
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                            {isEditing
                                                ? formatCurrency(editData.shares * editData.pricePerShare).split('.')[0]
                                                : formatCurrency(t.totalAmount).split('.')[0]}
                                        </td>

                                        {/* Sized to the buttons (w-px + nowrap collapses it to its content),
                                            so the actions never hold a wide empty column open. */}
                                        <td className="w-px whitespace-nowrap pl-2 pr-5 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSaveEdit(t.id)}
                                                            title="Save"
                                                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        >
                                                            <Check size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            title="Cancel"
                                                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <ArrowLeft size={15} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEdit(t)}
                                                            title="Edit"
                                                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(t.id)}
                                                            title="Delete"
                                                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        <tfoot>
                            <tr className="border-t border-slate-100 bg-slate-50/60">
                                <td
                                    className={clsx('py-3 text-xs font-semibold text-slate-400', symbol ? 'px-6' : 'px-4')}
                                    colSpan={symbol ? 4 : 5}
                                >
                                    Net {total >= 0 ? 'invested' : 'realised'}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                    {formatCurrency(Math.abs(total)).split('.')[0]}
                                </td>
                                <td className="w-px pl-2 pr-5 py-3" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
