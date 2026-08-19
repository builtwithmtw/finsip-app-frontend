"use client";

import React from 'react';
import clsx from 'clsx';
import { BarChart3, CalendarRange, Percent, Table2 } from 'lucide-react';
import MonthlyView from '../components/MonthlyView';
import MonthlyInvestedChart from '../components/MonthlyInvestedChart';
import TransactionLog from '../components/TransactionLog';
import { LedgerActivity, LedgerReturns } from '../components/LedgerAnalytics';
import useLocalStorage from '../hooks/useLocalStorage';
import { DISPLAY } from '../utils/typography';

// One control, in the voice the Allocation tab's buttons already use: white pane at
// rest, the dark slab when the option is on.
const Toggle: React.FC<{
    label: string;
    active: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ label, active, title, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={title}
        style={DISPLAY}
        className={clsx(
            'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 transition-colors',
            active
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-500 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] hover:text-slate-900'
        )}
    >
        {children}
        <span className="max-sm:hidden">{label}</span>
    </button>
);

/**
 * The summary grid cycles rather than toggles: off -> monthly -> yearly -> off. It is
 * one question with three answers ("don't show it / by month / by year"), and three
 * answers on one button beats two buttons whose combinations include a meaningless one.
 */
type GridMode = 'off' | 'month' | 'year';

const NEXT_MODE: Record<GridMode, GridMode> = { off: 'month', month: 'year', year: 'off' };
const MODE_LABEL: Record<GridMode, string> = { off: 'Grid', month: 'Monthly', year: 'Yearly' };
const MODE_TITLE: Record<GridMode, string> = {
    off: 'Show the grid month by month',
    month: 'Fold the grid into years',
    year: 'Hide the grid',
};

const LedgerPage: React.FC = () => {
    // Off by default: the log below is the ledger in the literal sense, and the grid is
    // a second reading of the same rows. The percentages are on -- they're the reading
    // the grid is built around -- but they widen every cell, so a long history can trade
    // them away for months on screen. All remembered across sessions.
    const [gridMode, setGridMode] = useLocalStorage<GridMode>('finsip:ledger-grid', 'off');
    const [showChart, setShowChart] = useLocalStorage<boolean>('finsip:ledger-chart', false);
    const [showPercentages, setShowPercentages] = useLocalStorage<boolean>('finsip:ledger-percentages', true);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-2 flex items-center justify-end gap-1.5">
                <Toggle
                    label={MODE_LABEL[gridMode]}
                    active={gridMode !== 'off'}
                    title={MODE_TITLE[gridMode]}
                    onClick={() => setGridMode(NEXT_MODE[gridMode])}
                >
                    {gridMode === 'year' ? <CalendarRange size={12} /> : <Table2 size={12} />}
                </Toggle>

                <Toggle
                    label="Histogram"
                    active={showChart}
                    title={showChart ? 'Hide the monthly histogram' : 'Show the monthly histogram'}
                    onClick={() => setShowChart(v => !v)}
                >
                    <BarChart3 size={12} />
                </Toggle>

                {/* Only means anything while the grid is up -- it's the grid's own cells
                    that carry the share. */}
                {gridMode !== 'off' && (
                    <Toggle
                        label="Share"
                        active={showPercentages}
                        title={
                            showPercentages
                                ? "Hide each cell's share of its column"
                                : "Show each cell's share of its column"
                        }
                        onClick={() => setShowPercentages(v => !v)}
                    >
                        <Percent size={12} />
                    </Toggle>
                )}
            </div>

            {/* The standing figures flank the log rather than stacking above it: they are
                read once on arrival, while the log is what the page is actually for, so it
                takes the middle and the width. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-3">
                    <LedgerReturns />
                </div>

                <div className="lg:col-span-6">
                    <TransactionLog />
                </div>

                <div className="lg:col-span-3">
                    <LedgerActivity />
                </div>
            </div>

            {/* Both of these need the full width -- the histogram to keep its months
                apart, the grid because it is a column per month. */}
            {showChart && (
                <div className="mt-4">
                    <MonthlyInvestedChart />
                </div>
            )}

            {gridMode !== 'off' && (
                <div className="mt-4">
                    <MonthlyView showPercentages={showPercentages} period={gridMode} />
                </div>
            )}
        </div>
    );
};

export default LedgerPage;
