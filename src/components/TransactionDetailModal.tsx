"use client";

import React, { useState } from 'react';
import { X, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';
import type { Transaction } from '../types';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { toast } from 'sonner';
import clsx from 'clsx';
import { DISPLAY, NUMERIC } from '../utils/typography';

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

const HEAD = 'py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';

// Edit fields match the recessed, borderless fields used across the app: the focus
// ring is the only edge that ever appears.
const FIELD = [
    'no-spinner w-full max-w-[92px] rounded-lg border-0 bg-slate-100/70 px-2.5 py-1.5',
    'text-right text-[13px] font-semibold tabular-nums text-slate-900 outline-none',
    'transition-all focus:bg-white focus:ring-2 focus:ring-sky-500/25',
].join(' ');

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent"
                />

                <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
                    <div className="min-w-0">
                        <h2
                            className="truncate text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            {symbol && month ? (
                                <>
                                    {maskSymbol(symbol)}
                                    <span className="mx-1.5 text-slate-300">·</span>
                                    <span className="text-slate-400">{formatMonth(month)}</span>
                                </>
                            ) : symbol ? (
                                maskSymbol(symbol)
                            ) : month ? (
                                formatMonth(month)
                            ) : (
                                'Transactions'
                            )}
                        </h2>

                        {/* Count and net in the same label/figure grammar as every other
                            readout in the app, rather than a run-on sentence. */}
                        <div className="mt-2.5 flex items-center gap-3">
                            <span className="flex items-center">
                                <span
                                    className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                                    style={DISPLAY}
                                >
                                    {symbol && !month ? 'All months · ' : ''}
                                    {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
                                </span>
                            </span>
                            <span aria-hidden className="h-3 w-px bg-slate-200" />
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                                    style={DISPLAY}
                                >
                                    Net
                                </span>
                                <span
                                    className={clsx(
                                        'text-[13px] font-semibold leading-none tabular-nums',
                                        total >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                    )}
                                    style={NUMERIC}
                                >
                                    {formatCurrency(Math.round(Math.abs(total))).replace(/^Rs\s*/, '')}
                                </span>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* The one place a vertical scroller is right: a symbol can carry years of
                    entries, and the dialog still has to fit the window. */}
                <div className="max-h-[60vh] overflow-x-auto overflow-y-auto border-t border-slate-100 custom-scrollbar">
                    <table className="w-full min-w-[560px] border-collapse text-left">
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

                        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur">
                            <tr className="border-b border-slate-100">
                                {!symbol && <th className={clsx(HEAD, 'px-5')} style={DISPLAY}>Symbol</th>}
                                <th className={clsx(HEAD, symbol ? 'px-5' : 'px-4')} style={DISPLAY}>Date</th>
                                <th className={clsx(HEAD, 'px-4')} style={DISPLAY}>Type</th>
                                <th className={clsx(HEAD, 'px-4 text-right')} style={DISPLAY}>Shares</th>
                                <th className={clsx(HEAD, 'px-4 text-right')} style={DISPLAY}>Price</th>
                                <th className={clsx(HEAD, 'px-4 text-right')} style={DISPLAY}>Amount</th>
                                <th className="w-px py-2.5 pl-2 pr-5" />
                            </tr>
                        </thead>

                        <tbody>
                            {ordered.map((t) => {
                                const isEditing = editingId === t.id;
                                const isBuy = t.type === 'buy';

                                return (
                                    <tr
                                        key={t.id}
                                        className="group relative border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/70"
                                    >
                                        {!symbol && (
                                            <td className="px-5 py-2.5">
                                                <span
                                                    className="text-[13px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
                                                    style={DISPLAY}
                                                >
                                                    {maskSymbol(t.symbol)}
                                                </span>
                                            </td>
                                        )}

                                        <td
                                            className={clsx('whitespace-nowrap py-2.5 text-[13px] text-slate-500', symbol ? 'px-5' : 'px-4')}
                                            style={NUMERIC}
                                        >
                                            {new Date(t.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>

                                        <td className="px-4 py-2.5">
                                            <span
                                                className={clsx(
                                                    'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.14em]',
                                                    isBuy ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                                                )}
                                                style={DISPLAY}
                                            >
                                                <span className="text-[8px]">{isBuy ? '\u25B2' : '\u25BC'}</span>
                                                {t.type}
                                            </span>
                                        </td>

                                        <td className="px-4 py-2.5 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editData.shares}
                                                    onChange={(e) => setEditData({ ...editData, shares: Number(e.target.value) })}
                                                    style={NUMERIC}
                                                    className={FIELD}
                                                />
                                            ) : (
                                                <span className="text-[13px] font-semibold tabular-nums text-slate-900" style={NUMERIC}>
                                                    {mask(t.shares.toLocaleString())}
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-2.5 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editData.pricePerShare}
                                                    onChange={(e) => setEditData({ ...editData, pricePerShare: Number(e.target.value) })}
                                                    style={NUMERIC}
                                                    className={FIELD}
                                                />
                                            ) : (
                                                <span className="text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                                    {formatCurrency(t.pricePerShare).replace(/^Rs\s*/, '')}
                                                </span>
                                            )}
                                        </td>

                                        <td
                                            className="whitespace-nowrap px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900"
                                            style={NUMERIC}
                                        >
                                            {isEditing
                                                ? formatCurrency(Math.round(editData.shares * editData.pricePerShare)).replace(/^Rs\s*/, '')
                                                : formatCurrency(Math.round(t.totalAmount)).replace(/^Rs\s*/, '')}
                                        </td>

                                        {/* Sized to the buttons (w-px + nowrap collapses it to its content),
                                            so the actions never hold a wide empty column open. Editing pins
                                            them visible; otherwise they wait for the row to be hovered. */}
                                        <td className="w-px whitespace-nowrap py-2.5 pl-2 pr-5">
                                            <div
                                                className={clsx(
                                                    'flex items-center justify-end gap-1 transition-opacity',
                                                    isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                                )}
                                            >
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSaveEdit(t.id)}
                                                            title="Save"
                                                            className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                                                        >
                                                            <Check size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            title="Cancel"
                                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
                                                        >
                                                            <ArrowLeft size={15} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEdit(t)}
                                                            title="Edit"
                                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(t.id)}
                                                            title="Delete"
                                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                        >
                                                            <Trash2 size={14} />
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
                                    className={clsx(
                                        'py-3 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500',
                                        symbol ? 'px-5' : 'px-4'
                                    )}
                                    style={DISPLAY}
                                    colSpan={symbol ? 4 : 5}
                                >
                                    Net {total >= 0 ? 'invested' : 'realised'}
                                </td>
                                <td
                                    className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900"
                                    style={NUMERIC}
                                >
                                    {formatCurrency(Math.round(Math.abs(total))).replace(/^Rs\s*/, '')}
                                </td>
                                <td className="w-px py-3 pl-2 pr-5" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;