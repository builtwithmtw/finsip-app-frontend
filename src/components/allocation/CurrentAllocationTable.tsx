"use client";

import React from 'react';
import clsx from 'clsx';
import { useMask } from '../../context/PrivacyContext';
import { DISPLAY, NUMERIC } from '../../utils/typography';
import { Panel } from '../Panel';

export interface CurrentAllocationRow {
    symbol: string;
    logo?: string;
    /** Share of the portfolio's cost basis. */
    investedShare: number;
    /** Share of the portfolio valued at the live price. */
    marketShare: number;
    /** Market share minus invested share, in percentage points. */
    difference: number;
    /** False when the feed carried no price, so market share is standing on cost. */
    isPriced: boolean;
}

interface CurrentAllocationTableProps {
    rows: CurrentAllocationRow[];
    emptyMessage?: string;
}

const headCell = 'px-3.5 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';
const bodyCell = 'px-3.5 py-2 text-[13px] tabular-nums';
const footCell = 'px-3.5 py-2.5 text-right text-[13px] font-semibold tabular-nums';

const CurrentAllocationTable: React.FC<CurrentAllocationTableProps> = ({
    rows,
    emptyMessage = 'No holdings yet',
}) => {
    const mask = useMask();

    const totalInvested = rows.reduce((sum, r) => sum + r.investedShare, 0);
    const totalMarket = rows.reduce((sum, r) => sum + r.marketShare, 0);

    return (
        <Panel flush>
            <div className="overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[560px] text-left border-collapse">
                    <thead className="border-b border-slate-100 bg-slate-50/60">
                        <tr>
                            <th className={headCell} style={DISPLAY}>Equity</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Invested Allocation</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Market Price Allocation</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Difference</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100/70">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    style={DISPLAY}
                                    className="px-3.5 py-12 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.symbol} className="group transition-colors hover:bg-slate-50/70">
                                    <td className={clsx(bodyCell, 'relative')}>
                                        {/* The accent rail only paints on hover, so the resting table stays
                                            flat and the pointer has something to track. */}
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                        />
                                        <div className="flex items-center gap-2">
                                            {r.logo && (
                                                <img
                                                    src={r.logo}
                                                    alt=""
                                                    width={18}
                                                    height={18}
                                                    className="w-[18px] h-[18px] rounded object-contain shrink-0"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                            <span
                                                className="font-semibold uppercase tracking-tight text-slate-900"
                                                style={DISPLAY}
                                            >
                                                {mask(r.symbol)}
                                            </span>
                                            {/* An unpriced symbol is held at cost, so its market share is
                                                cost wearing a different hat -- say so rather than let the
                                                difference read as a real drift. */}
                                            {!r.isPriced && (
                                                <span
                                                    className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-600"
                                                    style={DISPLAY}
                                                >
                                                    No price
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.investedShare.toFixed(2)}%
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right font-semibold text-slate-700')} style={NUMERIC}>
                                        {r.marketShare.toFixed(2)}%
                                    </td>

                                    {/* The whole point of the tab: which positions the market has
                                        pushed above or below the weight they were bought at. */}
                                    <td
                                        className={clsx(
                                            bodyCell,
                                            'text-right font-semibold',
                                            Math.abs(r.difference) < 0.005
                                                ? 'text-slate-400'
                                                : r.difference > 0
                                                    ? 'text-emerald-600'
                                                    : 'text-rose-600'
                                        )}
                                        style={NUMERIC}
                                    >
                                        {r.difference > 0 ? '+' : ''}{r.difference.toFixed(2)}%
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    {rows.length > 0 && (
                        <tfoot className="border-t border-slate-100 bg-slate-50/60">
                            <tr>
                                <td
                                    style={DISPLAY}
                                    className="px-3.5 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                                >
                                    Total
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {totalInvested.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {totalMarket.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-slate-400')} style={NUMERIC}>
                                    —
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </Panel>
    );
};

export default CurrentAllocationTable;
