"use client";

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useCurrency, useMask } from '../../context/PrivacyContext';
import type { AllocationResult, AllocationRow } from '../../hooks/useAllocations';
import { DISPLAY, NUMERIC } from '../../utils/typography';
import { Panel } from '../Panel';
import { usePortfolio } from '../../context/PortfolioContext';
import { useShariah } from '../../hooks/useShariah';
import { computeHoldings } from '../../utils/holdings';

interface AllocationTableProps {
    rows: AllocationRow[];
    summary: AllocationResult;
    emptyMessage?: string;
    /**
     * Renders the weight column as an input. Index weights come from the exchange and
     * stay read-only; the user's own symbols are theirs to set.
     */
    editableWeights?: boolean;
    /** Live value for a row's weight input, so typing recomputes without a round trip. */
    weightValue?: (row: AllocationRow) => string;
    onWeightChange?: (row: AllocationRow, value: string) => void;
    onWeightCommit?: (row: AllocationRow) => void;
    /**
     * Mark the Shariah-compliant rows. Off for KMI, where every constituent is
     * compliant by construction and the badge would sit on all fifteen saying nothing
     * -- the same reason the screener drops its marker once the Shariah filter is on.
     */
    showShariah?: boolean;
    /** Mark the rows already held, so an index list says what is new to you. */
    showPortfolio?: boolean;
}

/**
 * Shariah compliance, drawn rather than typed.
 *
 * lucide has no mosque, so this is one in its house style -- 24 unit box, 2 unit
 * strokes, round caps, `currentColor` -- which is what keeps it a sibling of every
 * other icon in the app instead of a picture pasted next to them. That is also the
 * whole difference from the 🕌 it replaces: an emoji arrives at whatever size, weight
 * and colour the reader's font vendor chose, full-bleed and usually multicolour, which
 * is why it read as an ornament. This one is a hairline in the row's own green.
 *
 * Kept to seven strokes -- finial, dome, two walls, two minarets, ground -- because it
 * is drawn at 13px and an arched doorway at that size is a smudge.
 */
const ShariahMark: React.FC = () => (
    <svg
        role="img"
        aria-label="Shariah compliant"
        viewBox="0 0 24 24"
        width={13}
        height={13}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-emerald-600"
    >
        <title>Shariah compliant</title>
        <path d="M12 4v1.5" />
        <path d="M7.5 12.5a4.5 4.5 0 0 1 9 0" />
        <path d="M7.5 12.5V20" />
        <path d="M16.5 12.5V20" />
        <path d="M4 9.5V20" />
        <path d="M20 9.5V20" />
        <path d="M3 20h18" />
    </svg>
);

/** The "you already hold this" marker, in the dress the global search uses for it. */
const Badge: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <span
        title={title}
        style={DISPLAY}
        className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] text-sky-600 ring-1 ring-sky-500/15"
    >
        {children}
    </span>
);

// Sized so a full 15-row allocation clears the fold on a laptop without its own scroller.
// Anything tighter than this reads as cramped rather than dense.
const headCell = 'px-3.5 py-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400';
// `leading-5` pins the line box at 20px so a row is the same height whether its
// weight cell holds plain text (KMI 30) or the editable input (My Symbols) --
// the input is sized to match it exactly.
const bodyCell = 'px-3.5 py-2 text-[13px] leading-5 tabular-nums';
const footCell = 'px-3.5 py-2.5 text-right text-[13px] font-semibold tabular-nums';

const AllocationTable: React.FC<AllocationTableProps> = ({
    rows,
    summary,
    emptyMessage = 'No data available',
    editableWeights = false,
    weightValue,
    onWeightChange,
    onWeightCommit,
    showShariah = false,
    showPortfolio = false,
}) => {
    const formatCurrency = useCurrency();
    const mask = useMask();

    // The app's one answer to both questions. `useShariah` rides the same /api/stocks
    // cache the screener's own badges come from, so an index row and a screener row can
    // never disagree about a symbol; holdings come from the ledger the rest of the app
    // is computed off.
    const { isShariah } = useShariah();
    const { transactions } = usePortfolio();

    const heldSymbols = useMemo(
        () => new Set(computeHoldings(transactions).map((h) => h.symbol.toUpperCase())),
        [transactions]
    );

    return (
        <Panel flush>
            <div className="overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[560px] text-left border-collapse">
                    <thead className="border-b border-slate-100 bg-slate-50/60">
                        <tr>
                            <th className={headCell} style={DISPLAY}>Equity</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Price</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Weight %</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Norm %</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Amount</th>
                            <th className={clsx(headCell, 'text-right')} style={DISPLAY}>Shares</th>
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
                                <tr key={r.name} className="group transition-colors hover:bg-slate-50/70">
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
                                                    // A broken logo host shouldn't leave a torn-image icon in the row.
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                            <span
                                                className="font-semibold uppercase tracking-[-0.03em] text-slate-900"
                                                style={DISPLAY}
                                            >
                                                {mask(r.name)}
                                            </span>

                                            {showShariah && isShariah(r.name) && <ShariahMark />}

                                            {showPortfolio && heldSymbols.has(r.name.toUpperCase()) && (
                                                <Badge title="You already hold this">Portfolio</Badge>
                                            )}
                                        </div>
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.price > 0 ? formatCurrency(r.price).replace(/^Rs\s*/, '') : '—'}
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right')}>
                                        {editableWeights ? (
                                            <div className="relative inline-flex items-center group/input">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    aria-label={`Allocation weight for ${r.name}`}
                                                    value={weightValue?.(r) ?? ''}
                                                    onChange={(e) => onWeightChange?.(r, e.target.value)}
                                                    onBlur={() => onWeightCommit?.(r)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                    }}
                                                    // Select-all on focus: these are two-digit values that get
                                                    // replaced far more often than they get edited.
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    placeholder="0"
                                                    style={NUMERIC}
                                                    className={clsx(
                                                        // h-5/py-0/leading-5 undoes @tailwindcss/forms, which gives
                                                        // every input a 24px line box and 8px of padding -- that is
                                                        // what made these rows 16px taller than the read-only tables.
                                                        'no-spinner h-5 w-[4.75rem] rounded-lg py-0 pl-2.5 pr-5 text-[13px] leading-5 font-semibold tabular-nums text-right outline-none transition-all',
                                                        'border-0 bg-slate-100/70 text-slate-900 placeholder:font-normal placeholder:text-slate-300',
                                                        'hover:bg-slate-100',
                                                        'focus:bg-white focus:ring-2 focus:ring-sky-500/25'
                                                    )}
                                                />
                                                <span className="pointer-events-none absolute right-2 text-[10px] font-semibold text-slate-300 transition-colors group-focus-within/input:text-sky-500">
                                                    %
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500" style={NUMERIC}>{r.weight.toFixed(2)}</span>
                                        )}
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right text-slate-500')} style={NUMERIC}>
                                        {r.normalizedWeight.toFixed(2)}
                                    </td>
                                    {/* Amount and shares are what the page exists to produce, so they carry
                                        the weight the reference columns give up. */}
                                    <td className={clsx(bodyCell, 'text-right font-semibold text-slate-700')} style={NUMERIC}>
                                        {formatCurrency(Math.round(r.finalAmount)).replace(/^Rs\s*/, '')}
                                    </td>
                                    <td className={clsx(bodyCell, 'text-right font-semibold text-slate-900')} style={NUMERIC}>
                                        {mask(r.shares.toLocaleString())}
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
                                <td />
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {summary.topTotalWeights.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {summary.topTotalNormalizedWeights.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {formatCurrency(Math.round(summary.topTotalAmount)).replace(/^Rs\s*/, '')}
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')} style={NUMERIC}>
                                    {mask(summary.topTotalShares.toLocaleString())}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </Panel>
    );
};

export default AllocationTable;