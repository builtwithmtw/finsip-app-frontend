import React from 'react';
import clsx from 'clsx';
import { useCurrency, useMask } from '../../context/PrivacyContext';
import type { AllocationResult, AllocationRow } from '../../hooks/useAllocations';

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
}

// Sized so a full 15-row allocation clears the fold on a laptop without its own scroller.
// Anything tighter than this reads as cramped rather than dense.
const headCell = 'px-3.5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest';
const bodyCell = 'px-3.5 py-1.5 text-xs tabular-nums';
const footCell = 'px-3.5 py-2 text-right text-xs font-black tabular-nums';

const AllocationTable: React.FC<AllocationTableProps> = ({
    rows,
    summary,
    emptyMessage = 'No data available',
    editableWeights = false,
    weightValue,
    onWeightChange,
    onWeightCommit,
}) => {
    const formatCurrency = useCurrency();
    const mask = useMask();

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide-auto">
                <table className="w-full min-w-[560px] text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                            <th className={headCell}>Equity</th>
                            <th className={clsx(headCell, 'text-right')}>Price</th>
                            <th className={clsx(headCell, 'text-right')}>Weight %</th>
                            <th className={clsx(headCell, 'text-right')}>Norm %</th>
                            <th className={clsx(headCell, 'text-right')}>Amount</th>
                            <th className={clsx(headCell, 'text-right')}>Shares</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-50">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3.5 py-10 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.name} className="group hover:bg-blue-50/30 transition-colors duration-150">
                                    <td className={bodyCell}>
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
                                            <span className="font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                                {mask(r.name)}
                                            </span>
                                        </div>
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right font-bold text-slate-600')}>
                                        {r.price > 0 ? formatCurrency(r.price).replace('Rs', '') : '—'}
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
                                                    className={clsx(
                                                        'no-spinner w-[4.5rem] rounded-md py-1 pl-2.5 pr-5 text-xs font-black tabular-nums text-right outline-none transition-all',
                                                        'bg-slate-50 border border-transparent text-slate-900 placeholder:text-slate-300 placeholder:font-bold',
                                                        'hover:border-slate-200 hover:bg-white',
                                                        'focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10'
                                                    )}
                                                />
                                                <span className="absolute right-2 text-[9px] font-black text-slate-300 pointer-events-none transition-colors group-focus-within/input:text-blue-400">
                                                    %
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="font-bold text-slate-600">{r.weight.toFixed(2)}</span>
                                        )}
                                    </td>

                                    <td className={clsx(bodyCell, 'text-right font-bold text-slate-600')}>
                                        {r.normalizedWeight.toFixed(2)}
                                    </td>
                                    <td className={clsx(bodyCell, 'text-right font-black text-blue-600')}>
                                        {formatCurrency(r.finalAmount).split('.')[0].replace('Rs', '')}
                                    </td>
                                    <td className={clsx(bodyCell, 'text-right font-black text-slate-900')}>
                                        {mask(r.shares.toLocaleString())}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    {rows.length > 0 && (
                        <tfoot className="border-t border-slate-100 bg-slate-50/80">
                            <tr>
                                <td className="px-3.5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Total
                                </td>
                                <td />
                                <td className={clsx(footCell, 'text-slate-900')}>
                                    {summary.topTotalWeights.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')}>
                                    {summary.topTotalNormalizedWeights.toFixed(0)}%
                                </td>
                                <td className={clsx(footCell, 'text-blue-600')}>
                                    {formatCurrency(summary.topTotalAmount).split('.')[0].replace('Rs', '')}
                                </td>
                                <td className={clsx(footCell, 'text-slate-900')}>
                                    {mask(summary.topTotalShares.toLocaleString())}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default AllocationTable;
