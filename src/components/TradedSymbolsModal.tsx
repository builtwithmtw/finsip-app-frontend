"use client";

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { format, intervalToDuration, parseISO } from 'date-fns';
import { ArrowRight, Search, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useMask, usePartialMask } from '../context/PrivacyContext';
import { computeTradeCycles, type TradeCycle } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';

const HEAD = 'px-4 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';
const CELL = 'px-4 py-2.5 text-[12px] leading-5';

/**
 * "Mar 2026".
 *
 * Month-level because that is the precision the ledger actually has: a
 * transaction carries the month it belongs to, and no trade date of its own.
 * Falls back to the raw key rather than rendering "Invalid Date".
 */
const monthLabel = (day: string): string => {
    try {
        return format(parseISO(day), 'MMM yyyy');
    } catch {
        return day;
    }
};

/**
 * How long a position was held, as "1y 2m 5d".
 *
 * Measured between the two dates rather than divided out of a day count: months
 * are not a fixed number of days, so 145 / 30 would report a hold that ran
 * March to August as "4m 25d" in one place and "4m 23d" in another depending on
 * which months it happened to cross. `intervalToDuration` walks the calendar,
 * so the figure is the one you would get counting on your fingers.
 *
 * Zero parts are dropped -- "0y 4m 23d" says nothing the shorter form doesn't --
 * and a hold that opened and closed on the same day still reads "0d" rather
 * than going blank.
 */
const heldLabel = (from: string, to: string): string => {
    try {
        const { years = 0, months = 0, days = 0 } = intervalToDuration({
            start: parseISO(from),
            end: parseISO(to),
        });

        const parts: string[] = [];
        if (years) parts.push(`${years}y`);
        if (months) parts.push(`${months}m`);
        if (days) parts.push(`${days}d`);

        // Bought and sold inside one month. There is no shorter true thing to
        // say: the ledger knows the month and not the day, so "0d" would be
        // claiming a precision it doesn't have.
        return parts.length > 0 ? parts.join(' ') : 'Same month';
    } catch {
        return '—';
    }
};

/**
 * Every round trip this ledger contains: when each position was opened, when it
 * was fully exited, and how long it was held.
 *
 * Opened from the "Traded" count on the Ledger tab, because that count is what
 * raises the question -- it counts every symbol the book has touched including
 * the ones since sold out, and those are exactly the ones no holdings table can
 * show you.
 *
 * A symbol bought, exited and bought again gets a row per cycle. Collapsing them
 * into one line per symbol would have to pick a single entry and exit date for a
 * position that had two of each, and there is no honest way to choose.
 */
const TradedSymbolsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { transactions } = usePortfolio();
    const mask = useMask();
    const maskSymbol = usePartialMask();

    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const cycles = useMemo(() => {
        // Longest hold first. Sorted on the day count rather than on the written
        // label, which is a rendering of it -- "1y" and "11m 30d" compare the
        // wrong way round as text.
        const rows = computeTradeCycles(transactions);
        return rows.sort((a, b) => {
            const byHeld = b.days - a.days;
            // Equal holds fall back to the oldest entry, so the order is stable
            // rather than however the ledger happened to be walked.
            return byHeld !== 0 ? byHeld : a.openedOn.localeCompare(b.openedOn);
        });
    }, [transactions]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return cycles;
        return cycles.filter((c) => c.symbol.toLowerCase().includes(needle));
    }, [cycles, query]);

    /**
     * Two different units, and they do not add up to each other on purpose.
     *
     * `symbols` counts distinct tickers -- the same figure the "Traded" line on
     * the tile shows, which is what was clicked to get here. `trades` counts
     * cycles, and a symbol exited and bought back is two of those. So 18
     * symbols can be 20 trades, and the header has to say which is which or the
     * holding/exited split below reads as if it should sum to the symbol count.
     */
    const summary = useMemo(() => ({
        symbols: new Set(cycles.map((c) => c.symbol)).size,
        trades: cycles.length,
        holding: cycles.filter((c) => c.isOpen).length,
        closed: cycles.filter((c) => !c.isOpen).length,
    }), [cycles]);

    // After the hooks, never before them: an early return above would change the
    // hook order between renders.
    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Traded symbols"
                className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent"
                />

                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5">
                    <div className="min-w-0">
                        <span
                            className="mb-1.5 block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                            style={DISPLAY}
                        >
                            Traded Symbols
                        </span>
                        <h2
                            className="text-[17px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            {summary.symbols} Symbol{summary.symbols === 1 ? '' : 's'}
                        </h2>
                        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400" style={DISPLAY}>
                            {summary.trades} Trade{summary.trades === 1 ? '' : 's'} · {summary.holding} Holding · {summary.closed} Exited
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 rounded-xl p-2 text-slate-400 ring-1 ring-slate-900/5 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X size={15} />
                    </button>
                </div>

                {cycles.length > 0 && (
                    <div className="relative border-b border-slate-100 p-3">
                        <Search
                            size={13}
                            className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search symbol"
                            aria-label="Search traded symbols"
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
                                className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide-auto">
                    {visible.length === 0 ? (
                        <p
                            className="px-4 py-14 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                            style={DISPLAY}
                        >
                            {cycles.length === 0 ? 'Nothing traded yet' : `Nothing matches “${query}”`}
                        </p>
                    ) : (
                        <table className="w-full min-w-[560px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Symbol
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Entry → Exit
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 text-right shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Held
                                    </th>
                                    <th style={DISPLAY} className={clsx(HEAD, 'sticky top-0 z-10 bg-slate-50 text-right shadow-[inset_0_-1px_0_0_#F1F5F9]')}>
                                        Qty
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {visible.map((c: TradeCycle) => (
                                        <tr
                                            key={`${c.symbol}-${c.round}`}
                                            className="group border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/70"
                                        >
                                            <td className={clsx(CELL, 'relative whitespace-nowrap')}>
                                                <span
                                                    aria-hidden
                                                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                                />
                                                <span className="flex items-center gap-1.5">
                                                    <span
                                                        className="text-[12px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
                                                        style={DISPLAY}
                                                    >
                                                        {maskSymbol(c.symbol)}
                                                    </span>

                                                    {/* Where the position stands, said on the row
                                                        itself. It rides beside the symbol rather
                                                        than in the date column so that column can
                                                        be dates and nothing else -- an open
                                                        position has no exit date to show, and a
                                                        word standing in for one reads as if it
                                                        were one. */}
                                                    <span
                                                        className={clsx(
                                                            'inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.14em]',
                                                            c.isOpen
                                                                ? 'bg-amber-500/10 text-amber-600'
                                                                : 'bg-rose-500/10 text-rose-600'
                                                        )}
                                                        style={DISPLAY}
                                                    >
                                                        {c.isOpen ? 'Hold' : 'Exit'}
                                                    </span>

                                                    {/* Only a re-entry is marked. A "#1" on every
                                                        row would be noise saying nothing. */}
                                                    {c.round > 1 && (
                                                        <span
                                                            className="rounded-md bg-slate-100 px-1 py-0.5 text-[9px] font-semibold leading-none tabular-nums text-slate-400"
                                                            style={NUMERIC}
                                                        >
                                                            #{c.round}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>

                                            {/* Dates only. A position that was never sold has
                                                no exit date, so the cell simply ends after the
                                                entry -- the arrow goes with it, since an arrow
                                                pointing at nothing still promises something. */}
                                            <td className={clsx(CELL, 'whitespace-nowrap')}>
                                                <span className="flex items-center gap-2">
                                                    <span className="text-[11px] font-semibold tabular-nums text-slate-600" style={NUMERIC}>
                                                        {monthLabel(c.openedOn)}
                                                    </span>
                                                    {c.closedOn && (
                                                        <>
                                                            <ArrowRight size={11} className="shrink-0 text-slate-300" />
                                                            <span className="text-[11px] font-semibold tabular-nums text-slate-600" style={NUMERIC}>
                                                                {monthLabel(c.closedOn)}
                                                            </span>
                                                        </>
                                                    )}
                                                </span>
                                            </td>

                                            {/* The day count stays reachable on hover -- it is
                                                what the sort runs on -- but it is measured from
                                                month starts, like every date here. */}
                                            <td
                                                className={clsx(
                                                    CELL,
                                                    'whitespace-nowrap text-right font-semibold tabular-nums',
                                                    c.isOpen ? 'text-sky-600' : 'text-slate-700'
                                                )}
                                                style={NUMERIC}
                                                title={`${c.days} day${c.days === 1 ? '' : 's'}`}
                                            >
                                                {heldLabel(c.openedOn, c.heldUntil)}
                                            </td>

                                            {/* What was bought over the cycle, and what is still
                                                on the book of it. */}
                                            <td className={clsx(CELL, 'text-right tabular-nums text-slate-500')} style={NUMERIC}>
                                                {mask(c.sharesBought.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                                                {c.isOpen && c.sharesHeld < c.sharesBought && (
                                                    <span className="text-slate-300">
                                                        {' '}· {mask(c.sharesHeld.toLocaleString(undefined, { maximumFractionDigits: 0 }))} left
                                                    </span>
                                                )}
                                            </td>

                                        </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TradedSymbolsModal;
