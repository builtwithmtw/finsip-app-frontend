"use client";

import React from 'react';
import clsx from 'clsx';
import { useMask } from '../../context/PrivacyContext';
import { DISPLAY, NUMERIC } from '../../utils/typography';
import { Panel } from '../Panel';
import { SortHeader, sortRows, useTableSort } from './sorting';

export interface CurrentAllocationRow {
    symbol: string;
    logo?: string;
    /** Share of the portfolio's cost basis. */
    investedShare: number;
    /** The Custom tab's weight for this symbol, normalised. Null when none is set. */
    customShare: number | null;
    /** The symbol's weight in KMI 30. Null when it isn't a constituent. */
    kmiShare: number | null;
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

const bodyCell = 'px-3.5 py-2 text-[13px] leading-5 tabular-nums';
const footCell = 'px-3.5 py-2.5 text-right text-[13px] font-semibold tabular-nums';

type SortKey = 'symbol' | 'investedShare' | 'customShare' | 'kmiShare' | 'marketShare' | 'difference';

const CurrentAllocationTable: React.FC<CurrentAllocationTableProps> = ({
    rows,
    emptyMessage = 'No holdings yet',
}) => {
    const mask = useMask();

    // Opens on the heaviest position, which is the order the tab arrives in.
    const { sort, toggle } = useTableSort<SortKey>({ key: 'marketShare', direction: 'desc' });

    const sorted = React.useMemo(
        () => sortRows(rows, sort, (row, key) => row[key]),
        [rows, sort]
    );

    const totalInvested = rows.reduce((sum, r) => sum + r.investedShare, 0);
    const totalMarket = rows.reduce((sum, r) => sum + r.marketShare, 0);
    const totalCustom = rows.reduce((sum, r) => sum + (r.customShare ?? 0), 0);
    const totalKmi = rows.reduce((sum, r) => sum + (r.kmiShare ?? 0), 0);

    return (
        <Panel flush>
            <div className="overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                    <thead className="border-b border-slate-100 bg-slate-50/60">
                        <tr>
                            <SortHeader label="Equity" sortKey="symbol" sort={sort} onToggle={toggle} naturalDirection="asc" align="left" />
                            <SortHeader label="Invested Allocation" sortKey="investedShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="Custom Allocation" sortKey="customShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="KMI Allocation" sortKey="kmiShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="Market Price Allocation" sortKey="marketShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="Difference" sortKey="difference" sort={sort} onToggle={toggle} />
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100/70">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    style={DISPLAY}
                                    className="px-3.5 py-12 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            sorted.map((r) => (
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
                                                className="font-semibold uppercase tracking-[-0.03em] text-slate-900"
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

                                    {/* The plan and the index, for comparison only -- neither is
                                        what the book is, both are what it could be measured against.
                                        A dash means no weight set / not a constituent, which is a
                                        different thing from a weight of zero. */}
                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.customShare == null ? (
                                            <span className="text-slate-300">—</span>
                                        ) : (
                                            `${r.customShare.toFixed(2)}%`
                                        )}
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.kmiShare == null ? (
                                            <span className="text-slate-300">—</span>
                                        ) : (
                                            `${r.kmiShare.toFixed(2)}%`
                                        )}
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
                                {/* Both of these total whatever the plan or the index assigns to
                                    symbols you hold -- not to 100, unless you hold exactly the
                                    plan or exactly the index. */}
                                <td className={clsx(footCell, 'text-slate-500')} style={NUMERIC}>
                                    {totalCustom > 0 ? `${totalCustom.toFixed(0)}%` : '—'}
                                </td>
                                <td className={clsx(footCell, 'text-slate-500')} style={NUMERIC}>
                                    {totalKmi > 0 ? `${totalKmi.toFixed(0)}%` : '—'}
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
