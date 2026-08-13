"use client";

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DISPLAY, NUMERIC, WORDMARK } from '../utils/typography';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** 'YYYY-MM' -> [year, monthIndex]. Falls back to today for anything unparseable. */
const parse = (value: string): [number, number] => {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) {
        const now = new Date();
        return [now.getFullYear(), now.getMonth()];
    }
    return [year, month - 1];
};

const stamp = (year: number, monthIndex: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

interface MonthPickerProps {
    value: string; // YYYY-MM
    onChange: (value: string) => void;
}

/**
 * The nav bar's month control.
 *
 * A custom popover rather than `input[type=month]`: the native picker is a different
 * widget in every browser, ignores the app's type entirely, and on Firefox is a bare
 * text field. This is one grid of twelve, so picking a month is a single click instead
 * of a spinner, and the panel can carry what the native one can't -- which month is
 * selected, which is the real one, and how far the year is from today.
 */
const MonthPicker: React.FC<MonthPickerProps> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [selectedYear, selectedMonth] = parse(value);

    // The year the grid is showing, which is only the selected year until you page away
    // from it. Reset on each open so the panel always lands on the current selection.
    const [viewYear, setViewYear] = useState(selectedYear);

    const rootRef = useRef<HTMLDivElement>(null);
    const [currentYear, currentMonth] = parse(thisMonth());

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
        setOpen((prev) => !prev);
    };

    const pick = (monthIndex: number) => {
        onChange(stamp(viewYear, monthIndex));
        setOpen(false);
    };

    const isCurrent = selectedYear === currentYear && selectedMonth === currentMonth;

    return (
        <div ref={rootRef} className="relative">
            {/* The trigger reads as one dark slab, the same one the Allocation tab's
                Invest field uses -- a figure the nav is built around, not a form input. */}
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={clsx(
                    'group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-xl bg-slate-950 py-2 pl-3.5 pr-3 ring-1 transition-all',
                    open ? 'ring-sky-400/40' : 'ring-white/10 hover:ring-white/25'
                )}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />

                {/* Two-tone: the month leads in the wordmark face, the year trails in mono
                    and dimmed, so a long history doesn't read as four equal digits. */}
                <span className="flex items-baseline gap-1.5 leading-none">
                    <span className="text-[13px] font-semibold text-white" style={WORDMARK}>
                        {MONTHS[selectedMonth]}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-400" style={NUMERIC}>
                        {selectedYear}
                    </span>
                </span>

                {/* A live dot, not a chevron: what matters at a glance is whether the app is
                    showing the month you're actually in. */}
                <span
                    aria-hidden
                    className={clsx(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                        isCurrent ? 'bg-emerald-400' : 'bg-amber-400'
                    )}
                />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Select month"
                    className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white p-3 shadow-[0_24px_48px_-24px_rgba(2,6,23,0.45)] ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <div className="mb-2.5 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y - 1)}
                            aria-label="Previous year"
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <ChevronLeft size={14} />
                        </button>

                        <span className="text-[13px] font-semibold tabular-nums text-slate-900" style={NUMERIC}>
                            {viewYear}
                        </span>

                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y + 1)}
                            aria-label="Next year"
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                        {MONTHS.map((label, index) => {
                            const active = viewYear === selectedYear && index === selectedMonth;
                            const isNow = viewYear === currentYear && index === currentMonth;

                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => pick(index)}
                                    title={`${LONG[index]} ${viewYear}`}
                                    style={DISPLAY}
                                    className={clsx(
                                        'relative rounded-lg py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                                        active
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                    )}
                                >
                                    {label}
                                    {/* Today's month keeps a marker even while another is selected,
                                        so paging back a few years never loses the way home. */}
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

                    {!isCurrent && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange(thisMonth());
                                setOpen(false);
                            }}
                            style={DISPLAY}
                            className="mt-2.5 w-full rounded-lg bg-slate-100/70 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            Jump to {MONTHS[currentMonth]} {currentYear}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default MonthPicker;
