"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { DISPLAY, NUMERIC } from '../utils/typography';

const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Monday first: the PSX week, and the one the reader's own calendar starts on. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Today in the reader's timezone. Matches PortfolioContext's own key exactly. */
const todayKey = (): string => {
    const at = new Date();
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

const key = (year: number, monthIndex: number, day: number): string =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** 'YYYY-MM-DD' -> [year, monthIndex, day]. Falls back to today if unparseable. */
const parse = (value: string): [number, number, number] => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
        const now = new Date();
        return [now.getFullYear(), now.getMonth(), now.getDate()];
    }
    return [year, month - 1, day];
};

const daysInMonth = (year: number, monthIndex: number): number =>
    new Date(year, monthIndex + 1, 0).getDate();

/** How many blanks precede the 1st, with Monday as column 0. */
const leadingBlanks = (year: number, monthIndex: number): number =>
    (new Date(year, monthIndex, 1).getDay() + 6) % 7;

/**
 * The date new entries are filed under.
 *
 * It sits beside the month picker wearing the same slab, and between them they read as
 * one date -- "21" then "Aug 2026". What it carries is not decoration: a transaction
 * has a month and no trade date of its own, so `created_at` is the only day-level fact
 * about it, and it is what the ledger's date column, the activity grouping and the SIP
 * date range all read. Left alone it is the day the row was written, which is wrong for
 * every month caught up later. Setting it here is what lets a backfilled October say
 * October.
 *
 * A day grid rather than `input[type=date]`, for the reason MonthPicker gives about the
 * native month control: it is a different widget in every browser and ignores the app's
 * type entirely.
 */
const EntryDatePicker: React.FC = () => {
    const { entryDate, setEntryDate } = usePortfolio();

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const [selectedYear, selectedMonth, selectedDay] = parse(entryDate);

    // The month the grid is showing, which is the selected one until you page away.
    const [viewYear, setViewYear] = useState(selectedYear);
    const [viewMonth, setViewMonth] = useState(selectedMonth);

    /*
     * Today is read once on mount rather than at render: the server has no idea what day
     * it is where the reader is, so comparing against it during SSR would ship one
     * timezone's answer into another's markup.
     */
    const [today, setToday] = useState<string | null>(null);
    useEffect(() => {
        setToday(todayKey());

        const id = window.setInterval(() => {
            setToday((prev) => {
                const next = todayKey();
                return prev === next ? prev : next;
            });
        }, 60_000);

        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const toggle = () => {
        setViewYear(selectedYear);
        setViewMonth(selectedMonth);
        setOpen((prev) => !prev);
    };

    const step = (delta: number) => {
        const next = viewMonth + delta;
        if (next < 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else if (next > 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth(next);
        }
    };

    const cells = useMemo(() => {
        const blanks = leadingBlanks(viewYear, viewMonth);
        const total = daysInMonth(viewYear, viewMonth);

        return [
            ...Array.from({ length: blanks }, () => null),
            ...Array.from({ length: total }, (_, i) => i + 1),
        ];
    }, [viewYear, viewMonth]);

    const isToday = today !== null && entryDate === today;

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                title={`Entries are filed under ${LONG[selectedMonth]} ${selectedDay}, ${selectedYear}`}
                className={clsx(
                    'group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl bg-slate-950 py-2 pl-3.5 pr-3 ring-1 transition-all',
                    open ? 'ring-sky-400/40' : 'ring-white/10 hover:ring-white/25'
                )}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />

                {/* Mono, like every other figure in the app, and tabular so the slab
                    keeps its width as the day steps from 9 to 10. */}
                <span className="text-[13px] font-semibold leading-none tabular-nums text-white" style={NUMERIC}>
                    {selectedDay}
                </span>

                {/* Same grammar as the month picker's dot: green while the entry date is
                    actually today, amber the moment it isn't -- because filing a month
                    under the wrong day is silent otherwise. Held back until the client
                    knows what day it is, rather than guessing during SSR. */}
                <span
                    aria-hidden
                    className={clsx(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                        today === null ? 'bg-slate-600' : isToday ? 'bg-emerald-400' : 'bg-amber-400'
                    )}
                />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Select entry date"
                    className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white p-3 shadow-[0_24px_48px_-24px_rgba(2,6,23,0.45)] ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <p
                        style={DISPLAY}
                        className="mb-2.5 text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                    >
                        New entries filed on
                    </p>

                    <div className="mb-2.5 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            aria-label="Previous month"
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <ChevronLeft size={14} />
                        </button>

                        <span className="text-[13px] font-semibold tabular-nums text-slate-900" style={NUMERIC}>
                            {LONG[viewMonth]} {viewYear}
                        </span>

                        <button
                            type="button"
                            onClick={() => step(1)}
                            aria-label="Next month"
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map((label, i) => (
                            <span
                                // The letters repeat (T, T and S, S), so the index has to
                                // carry the key.
                                key={`${label}-${i}`}
                                style={DISPLAY}
                                className="pb-1 text-center text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-300"
                            >
                                {label}
                            </span>
                        ))}

                        {cells.map((day, i) => {
                            if (day === null) return <span key={`blank-${i}`} />;

                            const cellKey = key(viewYear, viewMonth, day);
                            const active = cellKey === entryDate;
                            const isNow = cellKey === today;

                            return (
                                <button
                                    key={cellKey}
                                    type="button"
                                    onClick={() => {
                                        setEntryDate(cellKey);
                                        setOpen(false);
                                    }}
                                    style={NUMERIC}
                                    className={clsx(
                                        'relative rounded-lg py-1.5 text-[11px] font-semibold tabular-nums transition-colors',
                                        active
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                    )}
                                >
                                    {day}
                                    {isNow && !active && (
                                        <span
                                            aria-hidden
                                            className="absolute inset-x-0 -bottom-px mx-auto h-1 w-1 rounded-full bg-sky-500"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {today !== null && !isToday && (
                        <button
                            type="button"
                            onClick={() => {
                                setEntryDate(today);
                                setOpen(false);
                            }}
                            style={DISPLAY}
                            className="mt-2.5 w-full rounded-lg bg-slate-100/70 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            Back to today
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EntryDatePicker;
