"use client";

import React, { useState } from 'react';
import clsx from 'clsx';
import { Plus, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCurrency } from '../context/PrivacyContext';
import { useSipDeposits } from '../hooks/useSipDeposits';
import { DISPLAY, NUMERIC } from '../utils/typography';

const dayLabel = (date: string): string => {
    try {
        return format(parseISO(date), 'd MMM yyyy');
    } catch {
        return date;
    }
};

type EntryKind = 'deposit' | 'dividend' | 'reconciliation';

/** The three things that can reach the account, in the order they are entered. */
const KINDS: { id: EntryKind; label: string }[] = [
    { id: 'deposit', label: 'Deposit' },
    { id: 'dividend', label: 'Dividend' },
    { id: 'reconciliation', label: 'Adjust' },
];

/**
 * What each one means for the figures, said once here rather than in a paragraph on the
 * screen. Only a deposit is capital you supplied, and only a deposit is what the return
 * is measured against.
 */
const KIND_HINT: Record<EntryKind, string> = {
    deposit: 'Money you put in. Counts toward the return.',
    dividend: 'Money the holdings paid you. Adds to cash, not to what you invested.',
    reconciliation: 'A correction so the balance agrees with your broker. Cash only.',
};

/** Only a dividend or a correction is worth tagging; most rows are deposits. */
const KIND_TAG: Record<EntryKind, string | null> = {
    deposit: null,
    dividend: 'Dividend',
    reconciliation: 'Adjusted',
};

/** Today in the reader's own timezone -- the UTC date is yesterday for a Karachi morning. */
const todayKey = (): string => {
    const at = new Date();
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

/**
 * The deposit ledger: money into the brokerage account, and the corrections that keep
 * it agreeing with the statement.
 *
 * None of this can be read off the trades. The app records what was bought and sold,
 * never what was transferred in, so deposits are recorded here rather than deduced.
 * They are what the Total Deposits and Cash Available figures are built from.
 *
 * XIRR does not read them: it is measured on the capital actually put into the market,
 * which the trades do say. The two answer different questions and the panel shows both.
 */
const DepositsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    rate: number | null;
    /** Cost of what is currently held. */
    invested: number;
    /** What it is worth at today's prices. */
    worth: number;
    /** The corrections, netted. Signed. */
    reconciled: number;
    /** Deposits less invested plus corrections, or null with no deposits to compute it from. */
    cashAvailable: number | null;
}> = ({ isOpen, onClose, rate, invested, worth, reconciled, cashAvailable }) => {
    const formatCurrency = useCurrency();
    const { deposits, loading, saving, addDeposit, updateAmount, removeDeposit } = useSipDeposits();

    const [date, setDate] = useState(todayKey());
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [kind, setKind] = useState<EntryKind>('deposit');

    // Which row is being edited, and its unsaved text. One at a time: an amount is a
    // small enough edit that a whole row of open fields would be noise.
    const [editing, setEditing] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');

    if (!isOpen) return null;

    // Only deposits: a reconciliation corrects the balance, it does not fund anything.
    const total = deposits
        .filter((d) => d.kind === 'deposit')
        .reduce((sum, d) => sum + d.amount, 0);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();

        const value = Number(amount);
        if (!Number.isFinite(value) || value === 0) return;
        // Money arriving is money arriving; only a correction can go the other way.
        if (kind !== 'reconciliation' && value < 0) return;

        // The date is kept between entries: a year of back-entry is one field changing
        // by a month at a time, and re-picking it from today every row would be tedious.
        if (await addDeposit(date, value, kind, note.trim() || undefined)) {
            setAmount('');
            setNote('');
        }
    };

    const commitEdit = async (row: { id: string; amount: number }) => {
        setEditing(null);

        const next = Number(editDraft.trim());
        // An unchanged, empty or impossible value simply closes the field. The hook
        // refuses the rest -- a negative deposit, a zero -- and says why.
        if (!Number.isFinite(next) || next === row.amount) return;

        await updateAmount(row.id, next);
    };

    const field = clsx(
        'no-spinner rounded-lg border-0 bg-slate-100/70 px-2.5 py-1.5',
        'text-[12px] font-semibold tabular-nums text-slate-900 outline-none',
        'transition-all focus:bg-white focus:ring-2 focus:ring-sky-500/25'
    );

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-150"
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Deposits"
                onMouseDown={(e) => e.stopPropagation()}
                className="mt-[6vh] flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div>
                        <p
                            className="text-[13px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            Deposits
                        </p>
                        <p
                            className="mt-2 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            style={DISPLAY}
                        >
                            {deposits.length} {deposits.length === 1 ? 'deposit' : 'deposits'} ·{' '}
                            {formatCurrency(Math.round(total))} ·{' '}
                            {rate === null ? 'XIRR unavailable' : `${(rate * 100).toFixed(2)}% XIRR`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* The form sits above the list rather than below it: adding is what this
                    screen is opened to do, and a form under a year of rows is a scroll away. */}
                <form onSubmit={submit} className="shrink-0 space-y-2 border-b border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-2">
                        {/* A dropdown rather than a segmented control. Three buttons plus a
                            date, an amount and a submit was more than the row could hold,
                            and the kind is picked once and rarely changed -- it does not
                            need to show its alternatives at all times. The tooltip carries
                            what the chosen kind means for the figures. */}
                        <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value as EntryKind)}
                            aria-label="Entry kind"
                            title={KIND_HINT[kind]}
                            className={clsx(field, 'w-28 cursor-pointer appearance-none pr-2')}
                            style={DISPLAY}
                        >
                            {KINDS.map(({ id, label }) => (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            aria-label="Date"
                            className={clsx(field, 'flex-1')}
                            style={NUMERIC}
                        />

                        <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={kind === 'reconciliation' ? '± Amount' : 'Amount'}
                            aria-label="Amount"
                            className={clsx(field, 'w-28 text-right')}
                            style={NUMERIC}
                        />

                        <button
                            type="submit"
                            disabled={saving || amount.trim() === ''}
                            aria-label={`Add ${kind}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
                        >
                            <Plus size={15} />
                        </button>
                    </div>

                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note (optional) — e.g. Sipping, Opening Balance"
                        aria-label="Note"
                        maxLength={120}
                        className={clsx(field, 'w-full font-medium normal-case tabular-nums')}
                    />
                </form>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <p className="px-5 py-10 text-center text-xs font-medium text-slate-400">Loading…</p>
                    ) : deposits.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <p
                                style={DISPLAY}
                                className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-900"
                            >
                                No deposits recorded
                            </p>
                            <p className="mx-auto mt-3 max-w-xs text-[11px] font-medium leading-relaxed text-slate-400">
                                Until you add some, XIRR infers them from your buying — which is a good
                                guess, but cannot see money that sat as cash before it was spent.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100/70">
                            {/* Newest first, like every other list in the app. */}
                            {[...deposits].reverse().map((d) => (
                                <li key={d.id} className="group flex items-center justify-between gap-4 px-5 py-2.5">
                                    <span className="flex min-w-0 flex-col gap-1">
                                        <span className="flex items-center gap-2">
                                            <span className="text-[12px] tabular-nums text-slate-500" style={NUMERIC}>
                                                {dayLabel(d.date)}
                                            </span>
                                            {/* Only the odd one out is labelled: most rows are
                                                deposits, and a badge on every line is a column
                                                of badges rather than a distinction. */}
                                            {KIND_TAG[d.kind] && (
                                                <span
                                                    style={DISPLAY}
                                                    className={clsx(
                                                        'rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] ring-1',
                                                        d.kind === 'dividend'
                                                            ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/15'
                                                            : 'bg-amber-500/10 text-amber-600 ring-amber-500/15'
                                                    )}
                                                >
                                                    {KIND_TAG[d.kind]}
                                                </span>
                                            )}
                                        </span>
                                        {d.note && (
                                            <span className="truncate text-[10px] font-medium text-slate-400">
                                                {d.note}
                                            </span>
                                        )}
                                    </span>

                                    <span className="flex shrink-0 items-center gap-2">
                                        {/* Only the amount is editable. The date and the
                                            kind are what an entry *is* -- change either
                                            and it is a different entry, better deleted and
                                            re-added than quietly rewritten. */}
                                        {editing === d.id ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={editDraft}
                                                onChange={(e) => setEditDraft(e.target.value)}
                                                onBlur={() => commitEdit(d)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    // Escape abandons the edit rather than
                                                    // saving whatever is half-typed.
                                                    if (e.key === 'Escape') {
                                                        setEditing(null);
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                aria-label={`Amount for the entry dated ${d.date}`}
                                                className={clsx(field, 'w-28 text-right')}
                                                style={NUMERIC}
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(d.id);
                                                    setEditDraft(String(d.amount));
                                                }}
                                                title="Edit the amount"
                                                className={clsx(
                                                    'rounded px-1 py-0.5 text-[12px] font-semibold tabular-nums transition-colors',
                                                    'hover:bg-slate-100',
                                                    d.kind === 'reconciliation' ? 'text-slate-400' : 'text-slate-900'
                                                )}
                                                style={NUMERIC}
                                            >
                                                {d.amount < 0 ? '−' : '+'}
                                                {formatCurrency(Math.abs(d.amount)).replace(/^Rs\s*/, '')}
                                            </button>
                                        )}

                                        {/* Only on hover: a delete button on every row of a
                                            long list reads as a list of delete buttons. */}
                                        <button
                                            type="button"
                                            onClick={() => removeDeposit(d.id)}
                                            aria-label={`Remove the entry dated ${d.date}`}
                                            className="rounded p-1 text-slate-300 opacity-0 transition-all hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* The account's standing figures, in the order the money moves through
                    them: what came in, how much of it is in the market, what that is
                    worth now, and what is still waiting to be spent. */}
                <div className="shrink-0 space-y-1.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
                    {[
                        ['Total deposits', total],
                        ['Total invested', invested],
                        ['Worth', worth],
                        // Shown only when there are corrections, and shown next to the
                        // cash it corrects -- the footer is meant to add up in the
                        // reader's head, and a term that changes the total silently
                        // would defeat that.
                        ...(reconciled === 0 ? [] : [['Reconciled', reconciled] as const]),
                        ...(cashAvailable === null ? [] : [['Cash available', cashAvailable] as const]),
                    ].map(([label, value]) => (
                        <div key={label as string} className="flex items-center justify-between gap-4">
                            <span
                                className="text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                                style={DISPLAY}
                            >
                                {label}
                            </span>
                            <span
                                className={clsx(
                                    'text-[12px] font-semibold leading-none tabular-nums',
                                    (value as number) < 0 ? 'text-rose-600' : 'text-slate-900'
                                )}
                                style={NUMERIC}
                            >
                                {(value as number) < 0 ? '−' : ''}
                                {formatCurrency(Math.round(Math.abs(value as number))).replace(/^Rs\s*/, '')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DepositsModal;
