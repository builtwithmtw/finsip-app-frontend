"use client";

import React from 'react';
import clsx from 'clsx';
import { NUMERIC } from '../../utils/typography';

/**
 * The day's move off the live feed, in the pill the Live Portfolio's 1D column uses.
 * Null is "the feed carried no change for this symbol", shown as a dash rather than a
 * fictional flat 0%.
 */
export const DayChange: React.FC<{ value: number | null }> = ({ value }) =>
    value == null ? (
        <span className="text-[13px] tabular-nums text-slate-300" style={NUMERIC}>—</span>
    ) : (
        <span
            className={clsx(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-none tabular-nums',
                value > 0 && 'bg-emerald-500/10 text-emerald-600',
                value < 0 && 'bg-rose-500/10 text-rose-600',
                value === 0 && 'text-slate-400'
            )}
            style={NUMERIC}
        >
            {value !== 0 && <span className="text-[8px]">{value > 0 ? '▲' : '▼'}</span>}
            {Math.abs(value).toFixed(2)}%
        </span>
    );
