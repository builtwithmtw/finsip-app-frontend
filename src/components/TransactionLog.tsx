"use client";

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { format, parseISO } from 'date-fns';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { MetricLabel, Panel, PanelHeader } from './Panel';
import TransactionDetailModal from './TransactionDetailModal';
import type { Transaction } from '../types';

const HEAD = 'px-4 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';

/** "Oct 2025" -- short enough for a narrow column, and unambiguous across years. */
const monthShort = (month: string): string => {
    try {
        return format(parseISO(`${month}-01`), 'MMM yyyy');
    } catch {
        return month;
    }
};

/** `null` for a row with no usable timestamp; only used for the "recorded on" tooltip. */
const entryDate = (createdAt?: string): string | null => {
    if (!createdAt) return null;
    try {
        return format(parseISO(createdAt), 'dd MMM yyyy');
    } catch {
        return null;
    }
};
const CELL = 'px-4 py-2 text-[12px] leading-5';

/**
 * The ledger as a ledger: every transaction, newest first, one line each.
 *
 * The grid beside it answers "how was this month split" -- this answers "what did I
 * actually do, and when", which the matrix can't, because a matrix cell is already
 * several trades added together.
 *
 * The date column is the month traded, not `createdAt`. `createdAt` is when the row was
 * typed, and a ledger that was backfilled in one sitting has every row stamped with that
 * one day -- which made a year of 2025 trades all read "25 Jan 2026" and put them nowhere
 * near where anyone would look for them. The month is the only date that describes the
 * trade rather than the data entry, so it is what the column shows and what the rows are
 * ordered by. When the entry was recorded is still there, in the row's tooltip.
 */
const TransactionLog: React.FC = () => {
    const { transactions } = usePortfolio();
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();

    const [selected, setSelected] = useState<Transaction | null>(null);
    const [query, setQuery] = useState('');

    const rows = useMemo(
        () =>
            transactions
                .filter((t) => t.shares > 0 && t.pricePerShare > 0)
                .slice()
                .sort((a, b) => {
                    const byMonth = b.month.localeCompare(a.month);
                    // Within a month, the order they were entered in.
                    return byMonth !== 0 ? byMonth : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
                }),
        [transactions]
    );

    /**
     * Matches the symbol, the side, and the month as it is written on screen -- so
     * "gcil", "sell" and "august" all find something, which is how someone actually
     * looks for a row they half remember. Deliberately not the figures: a search that
     * matches "25000" against an amount would also match it against a share count.
     */
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return rows;

        return rows.filter((t) =>
            [t.symbol, t.type, formatMonth(t.month), entryDate(t.createdAt) ?? '']
                .join(' ')
                .toLowerCase()
                .includes(needle)
        );
    }, [rows, query]);

    return (
        <>
            <Panel flush className="flex h-full flex-col">
                <div className="px-4 pt-4">
                    <PanelHeader title="Transaction Ledger" caption="Newest First">
                        <MetricLabel label={query ? 'Matches' : 'Entries'} className="justify-end" />
                        <span
                            className="mt-2 block text-lg font-semibold leading-none tabular-nums text-slate-900"
                            style={NUMERIC}
                        >
                            {query ? `${visible.length}/${rows.length}` : rows.length}
                        </span>
                    </PanelHeader>
                </div>

                {rows.length > 0 && (
                    <div className="relative mb-3 px-4">
                        <Search
                            size={13}
                            className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-300"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search symbol, side or month"
                            aria-label="Search transactions"
                            style={DISPLAY}
                            // border-0/py-0 strips @tailwindcss/forms, which would draw its
                            // own border inside the ring and force a 40px line box.
                            className="h-9 w-full rounded-xl border-0 bg-slate-100/70 py-0 pl-9 pr-9 text-[12px] font-medium text-slate-700 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-sky-500/25"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                aria-label="Clear search"
                                className="absolute right-6 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                )}

                {rows.length === 0 ? (
                    <p
                        className="px-4 pb-6 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                        style={DISPLAY}
                    >
                        No transactions yet
                    </p>
                ) : visible.length === 0 ? (
                    <p
                        className="px-4 pb-6 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                        style={DISPLAY}
                    >
                        Nothing matches “{query}”
                    </p>
                ) : (
                    // Capped rather than unbounded: the log is the longest thing on the page
                    // and would otherwise set the height of a row whose other two columns are
                    // a few hundred pixels tall. Every row is here -- the list scrolls inside
                    // the card to reach them.
                    <div className="scrollbar-hide-auto max-h-[560px] overflow-y-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    {/* Stuck to the top of this scroller, with the hairline drawn as an
                                        inset shadow -- a collapsed-border table won't carry a border
                                        along with a sticky cell. */}
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Date
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Symbol
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 text-right shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Qty
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 text-right shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Price
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 text-right shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Amount
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {visible.map((t) => {
                                    const isSell = t.type === 'sell';
                                    return (
                                        <tr
                                            key={t.id}
                                            onClick={() => setSelected(t)}
                                            title={
                                                `All transactions for ${t.symbol} in ${formatMonth(t.month)}` +
                                                (entryDate(t.createdAt) ? ` · recorded ${entryDate(t.createdAt)}` : '')
                                            }
                                            className="group cursor-pointer border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/70"
                                        >
                                            <td className={clsx(CELL, 'relative whitespace-nowrap text-slate-400')} style={DISPLAY}>
                                                {/* The accent rail only paints on hover, so the resting log
                                                    stays flat and the pointer has something to track. */}
                                                <span
                                                    aria-hidden
                                                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                                />
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                                                    {monthShort(t.month)}
                                                </span>
                                            </td>

                                            <td className={clsx(CELL, 'whitespace-nowrap')}>
                                                <span
                                                    className={clsx(
                                                        'text-[12px] font-semibold uppercase tracking-[-0.03em]',
                                                        isSell ? 'text-rose-600' : 'text-slate-900'
                                                    )}
                                                    style={DISPLAY}
                                                >
                                                    {maskSymbol(t.symbol)}
                                                </span>
                                            </td>

                                            {/* Accounting style: a sold quantity is bracketed rather than
                                                signed, so the minus can't be lost against the column edge. */}
                                            <td
                                                className={clsx(
                                                    CELL,
                                                    'text-right tabular-nums',
                                                    isSell ? 'text-rose-600' : 'text-slate-500'
                                                )}
                                                style={NUMERIC}
                                            >
                                                {isSell
                                                    ? `(${mask(t.shares.toLocaleString())})`
                                                    : mask(t.shares.toLocaleString())}
                                            </td>

                                            <td className={clsx(CELL, 'text-right tabular-nums text-slate-500')} style={NUMERIC}>
                                                {formatCurrency(t.pricePerShare).replace(/^Rs\s*/, '')}
                                            </td>

                                            {/* Sign and colour carry buy/sell, the way the grid does it --
                                                a separate type column would cost a column to say what the
                                                figure already says. */}
                                            <td
                                                className={clsx(
                                                    CELL,
                                                    'text-right font-semibold tabular-nums',
                                                    isSell ? 'text-rose-600' : 'text-slate-900'
                                                )}
                                                style={NUMERIC}
                                            >
                                                {isSell ? '−' : ''}
                                                {formatCurrency(Math.round(t.totalAmount)).replace(/^Rs\s*/, '')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {/* Opens the symbol's whole month, not the single row: the modal is where a
                transaction is edited, and editing one of three same-month entries makes
                far more sense with the other two in front of you. */}
            <TransactionDetailModal
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                transactions={
                    selected
                        ? transactions.filter((t) => t.symbol === selected.symbol && t.month === selected.month)
                        : []
                }
                symbol={selected?.symbol}
                month={selected?.month}
            />
        </>
    );
};

export default TransactionLog;
