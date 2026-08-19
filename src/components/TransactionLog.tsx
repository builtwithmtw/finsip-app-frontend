"use client";

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { format, parseISO } from 'date-fns';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { MetricLabel, Panel, PanelHeader } from './Panel';
import TransactionDetailModal from './TransactionDetailModal';
import type { Transaction } from '../types';

const HEAD = 'px-4 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';

/** `null` for a row with no usable timestamp, so the caller can fall back to its month. */
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
 * The date column is `createdAt` -- when the entry was recorded. It is the only real
 * date the ledger holds: a transaction carries a month (YYYY-MM) and nothing finer, so
 * a trade backfilled later is dated the day it was typed, not the day it was made.
 * Ordering follows the same field, so the column the reader sorts by mentally is the
 * one the rows are actually in.
 */
const TransactionLog: React.FC = () => {
    const { transactions } = usePortfolio();
    const formatCurrency = useCurrency();
    const mask = useMask();
    const maskSymbol = usePartialMask();

    const [selected, setSelected] = useState<Transaction | null>(null);

    const rows = useMemo(
        () =>
            transactions
                .filter((t) => t.shares > 0 && t.pricePerShare > 0)
                .slice()
                .sort((a, b) => {
                    const byDate = (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
                    return byDate !== 0 ? byDate : b.month.localeCompare(a.month);
                }),
        [transactions]
    );

    return (
        <>
            <Panel flush className="flex h-full flex-col">
                <div className="px-4 pt-4">
                    <PanelHeader title="Transaction Ledger" caption="Newest First">
                        <MetricLabel label="Entries" className="justify-end" />
                        <span
                            className="mt-2 block text-lg font-semibold leading-none tabular-nums text-slate-900"
                            style={NUMERIC}
                        >
                            {rows.length}
                        </span>
                    </PanelHeader>
                </div>

                {rows.length === 0 ? (
                    <p
                        className="px-4 pb-6 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                        style={DISPLAY}
                    >
                        No transactions yet
                    </p>
                ) : (
                    // Capped rather than unbounded: the log is the longest thing on the page
                    // and would otherwise set the height of a row whose other two columns are
                    // a few hundred pixels tall.
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
                                {rows.map((t) => {
                                    const isSell = t.type === 'sell';
                                    return (
                                        <tr
                                            key={t.id}
                                            onClick={() => setSelected(t)}
                                            title={`All transactions for ${t.symbol} in ${formatMonth(t.month)}`}
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
                                                    {entryDate(t.createdAt) ?? formatMonth(t.month)}
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
