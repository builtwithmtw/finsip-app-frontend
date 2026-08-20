"use client";

import React from 'react';
import clsx from 'clsx';
import { useCurrency, useMask } from '../../context/PrivacyContext';
import { DISPLAY, NUMERIC } from '../../utils/typography';
import { Panel } from '../Panel';
import { SortHeader, sortRows, useTableSort } from './sorting';
import type { RebalancePlan } from '../../utils/rebalance';

interface RebalanceTableProps {
    plan: RebalancePlan;
    emptyMessage?: string;
}

const bodyCell = 'px-3.5 py-2 text-[13px] tabular-nums';
const footCell = 'px-3.5 py-2.5 text-right text-[13px] font-semibold tabular-nums';

type SortKey = 'symbol' | 'targetShare' | 'marketShare' | 'drift' | 'tradeShares' | 'tradeAmount';

/** Execution order: what you sell, then what you buy with it, then what you leave alone. */
const ACTION_ORDER: Record<'sell' | 'buy' | 'hold', number> = { sell: 0, buy: 1, hold: 2 };

const RebalanceTable: React.FC<RebalanceTableProps> = ({ plan, emptyMessage = 'Nothing to rebalance' }) => {
    const mask = useMask();
    const currency = useCurrency();

    // Opens on Action, which is the order the plan is executed in: sells first (they fund
    // the buys), then buys, then the holds that need no trade at all.
    const { sort, toggle } = useTableSort<SortKey>({ key: 'tradeShares', direction: 'asc' });

    const rows = React.useMemo(
        () =>
            sortRows(plan.rows, sort, (row, key) =>
                // Action is a group before it is a number: rank first so sells, buys and
                // holds stay in blocks, then the largest trade leads inside each block.
                // Subtracting the amount keeps that descending under an ascending sort.
                key === 'tradeShares'
                    ? ACTION_ORDER[row.action] * 1e15 - row.tradeAmount
                    : row[key]
            ),
        [plan.rows, sort]
    );

    return (
        <Panel flush>
            <div className="overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[640px] text-left border-collapse">
                    <thead className="border-b border-slate-100 bg-slate-50/60">
                        <tr>
                            <SortHeader label="Equity" sortKey="symbol" sort={sort} onToggle={toggle} naturalDirection="asc" align="left" />
                            <SortHeader label="Target" sortKey="targetShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="Market" sortKey="marketShare" sort={sort} onToggle={toggle} />
                            <SortHeader label="Drift" sortKey="drift" sort={sort} onToggle={toggle} />
                            <SortHeader label="Action" sortKey="tradeShares" sort={sort} onToggle={toggle} />
                            <SortHeader label="Amount" sortKey="tradeAmount" sort={sort} onToggle={toggle} />
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
                            rows.map((r) => (
                                <tr key={r.symbol} className="group transition-colors hover:bg-slate-50/70">
                                    <td className={clsx(bodyCell, 'relative')}>
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
                                            {!r.isPriced && (
                                                <span
                                                    className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-600"
                                                    style={DISPLAY}
                                                >
                                                    No price
                                                </span>
                                            )}
                                            {/* A held symbol with no weight isn't drifting, it's been dropped
                                                from the plan -- and that reads very differently from a sell. */}
                                            {r.targetShare === 0 && r.heldShares > 0 && (
                                                <span
                                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                                                    style={DISPLAY}
                                                >
                                                    Unweighted
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.targetShare.toFixed(2)}%
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right font-semibold text-slate-700')} style={NUMERIC}>
                                        {r.marketShare.toFixed(2)}%
                                    </td>

                                    <td
                                        className={clsx(
                                            bodyCell,
                                            'text-right font-semibold',
                                            Math.abs(r.drift) < 0.005
                                                ? 'text-slate-400'
                                                : r.drift > 0
                                                    ? 'text-emerald-600'
                                                    : 'text-rose-600'
                                        )}
                                        style={NUMERIC}
                                    >
                                        {r.drift > 0 ? '+' : ''}{r.drift.toFixed(2)}%
                                    </td>

                                    {/* The answer the tab exists for: how many shares, which way,
                                        and the price they're sized off -- the price column was a
                                        separate reading of the same number. */}
                                    <td className={clsx(bodyCell, 'text-right')} style={NUMERIC}>
                                        {r.action === 'hold' ? (
                                            <span className="text-slate-300">—</span>
                                        ) : (
                                            <span
                                                className={clsx(
                                                    'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                                                    r.action === 'buy'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-rose-50 text-rose-700'
                                                )}
                                            >
                                                <span
                                                    className="text-[9px] uppercase tracking-[0.14em]"
                                                    style={DISPLAY}
                                                >
                                                    {r.action}
                                                </span>
                                                {mask(`${r.tradeShares} @ ${r.price.toFixed(2)}`)}
                                            </span>
                                        )}
                                    </td>

                                    <td
                                        className={clsx(
                                            bodyCell,
                                            'text-right font-semibold',
                                            r.action === 'hold' ? 'text-slate-300' : 'text-slate-900'
                                        )}
                                        style={NUMERIC}
                                    >
                                        {r.action === 'hold' ? '—' : currency(r.tradeAmount)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    {rows.length > 0 && (
                        <tfoot className="border-t border-slate-100 bg-slate-50/60">
                            <tr>
                                <td
                                    colSpan={4}
                                    style={DISPLAY}
                                    className="px-3.5 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                                >
                                    Sell / Buy
                                </td>
                                <td className={clsx(footCell, 'text-rose-600')} style={NUMERIC}>
                                    {currency(plan.sellTotal)}
                                </td>
                                <td className={clsx(footCell, 'text-emerald-700')} style={NUMERIC}>
                                    {currency(plan.buyTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </Panel>
    );
};

export default RebalanceTable;
