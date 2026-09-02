"use client";

import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCurrency } from '../context/PrivacyContext';
import type { SipDay } from '../utils/sipStreak';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';

/** 1 -> "1st", 22 -> "22nd". The teens are the exception every naive version gets wrong. */
const ordinal = (day: number): string => {
    if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
    if (day % 10 === 1) return `${day}st`;
    if (day % 10 === 2) return `${day}nd`;
    if (day % 10 === 3) return `${day}rd`;
    return `${day}th`;
};

const monthLabel = (month: string): string => {
    try {
        return format(parseISO(`${month}-01`), 'MMMM yyyy');
    } catch {
        return month;
    }
};

/**
 * Every month's SIP, behind the average that summarises them.
 *
 * The average alone cannot say whether the plan is steady or lumpy, and that is usually
 * the next question -- so the figure opens into the months it was taken over, newest
 * first.
 *
 * Each row carries the SIP and, when the month bought more than that, what the top-ups
 * added beside it. That second figure is the whole reason the average changed: the SIP
 * is the heaviest day of the month, not the month's total, and showing both is what
 * makes the difference legible instead of merely asserted.
 */
const SipHistoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    months: SipDay[];
    average: number;
}> = ({ isOpen, onClose, months, average }) => {
    const formatCurrency = useCurrency();

    if (!isOpen) return null;

    // Newest first: the months you are actually asking about are the recent ones.
    const rows = [...months].sort((a, b) => b.month.localeCompare(a.month));

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-150"
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="SIP by month"
                onMouseDown={(e) => e.stopPropagation()}
                className="mt-[8vh] flex max-h-[74vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div>
                        <p
                            className="text-[13px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            SIP by month
                        </p>
                        <p
                            className="mt-2 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            style={DISPLAY}
                        >
                            {rows.length} {rows.length === 1 ? 'month' : 'months'} · averaging{' '}
                            {formatCurrency(Math.round(average))}
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

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    <ul className="divide-y divide-slate-100/70">
                        {rows.map((row) => {
                            const topUps = row.monthTotal - row.amount;

                            return (
                                <li
                                    key={row.month}
                                    className="flex items-center justify-between gap-4 px-5 py-3"
                                >
                                    <span className="flex min-w-0 flex-col gap-1.5">
                                        <span
                                            className="truncate text-[12px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                                            style={DISPLAY}
                                        >
                                            {monthLabel(row.month)}
                                        </span>
                                        <span
                                            className="text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                                            style={DISPLAY}
                                        >
                                            {row.day === null ? 'Date not recorded' : `On the ${ordinal(row.day)}`}
                                        </span>
                                    </span>

                                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                                        <Amount value={formatCurrency(Math.round(row.amount))} size="text-[13px]" />

                                        {/* Only when there was more to the month than the SIP.
                                            Rounded before the comparison so a sub-rupee remainder
                                            never prints as "+Rs 0". */}
                                        {Math.round(topUps) > 0 && (
                                            <span
                                                className="text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                                                style={DISPLAY}
                                            >
                                                +{formatCurrency(Math.round(topUps))} in top-ups
                                            </span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className={clsx(
                    'flex shrink-0 items-center justify-between gap-4 border-t border-slate-100',
                    'bg-slate-50/70 px-5 py-3'
                )}>
                    <span
                        className="text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                        style={DISPLAY}
                    >
                        Average SIP
                    </span>
                    <span
                        className="text-[15px] font-semibold leading-none tabular-nums text-slate-900"
                        style={NUMERIC}
                    >
                        {formatCurrency(Math.round(average))}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SipHistoryModal;
