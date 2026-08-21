"use client";

import React from 'react';
import clsx from 'clsx';
import { BarChart3, CalendarRange, Percent, Table2 } from 'lucide-react';
import MonthlyView from '../components/MonthlyView';
import MonthlyInvestedChart from '../components/MonthlyInvestedChart';
import TransactionLog from '../components/TransactionLog';
import { LedgerActivity, LedgerReturns } from '../components/LedgerAnalytics';
import useLocalStorage from '../hooks/useLocalStorage';
import { useSettings } from '../context/SettingsContext';
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
 * Which way the grid is cut. Whether it is shown at all is no longer asked here -- that
 * is the "Display transactions ledger" setting, since the choice is between the two
 * readings of the book rather than between a page and an extra on it.
 */
type GridPeriod = 'month' | 'year';

const NEXT_PERIOD: Record<GridPeriod, GridPeriod> = { month: 'year', year: 'month' };
const PERIOD_LABEL: Record<GridPeriod, string> = { month: 'Monthly', year: 'Yearly' };
const PERIOD_TITLE: Record<GridPeriod, string> = {
    month: 'Fold the grid into years',
    year: 'Break the grid back into months',
};

const LedgerPage: React.FC = () => {
    /*
     * Which reading the page opens on lives in Settings, because it is a standing
     * preference rather than something toggled while reading. Everything else here is a
     * view option and stays on the page, remembered across sessions.
     *
     * The percentages are on -- they're the reading the grid is built around -- but they
     * widen every cell, so a long history can trade them away for months on screen.
     */
    const { showTransactionsLedger } = useSettings();

    const [storedPeriod, setPeriod] = useLocalStorage<GridPeriod | 'off'>('finsip:ledger-grid', 'month');
    const [showChart, setShowChart] = useLocalStorage<boolean>('finsip:ledger-chart', false);
    const [showPercentages, setShowPercentages] = useLocalStorage<boolean>('finsip:ledger-percentages', true);

    // 'off' was the third state of the old cycle and is still in storage for anyone who
    // left the page on it. It no longer means anything -- the setting decides that now --
    // so it reads as the monthly cut.
    const period: GridPeriod = storedPeriod === 'off' ? 'month' : storedPeriod;

    const gridOn = !showTransactionsLedger;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-2 flex items-center justify-end gap-1.5">
                {/* Only while the grid is the page: with the log up there is no grid to
                    cut either way, and a control that governs something not on screen is
                    worse than no control. */}
                {gridOn && (
                    <Toggle
                        label={PERIOD_LABEL[period]}
                        active
                        title={PERIOD_TITLE[period]}
                        onClick={() => setPeriod(NEXT_PERIOD[period])}
                    >
                        {period === 'year' ? <CalendarRange size={12} /> : <Table2 size={12} />}
                    </Toggle>
                )}

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
                {gridOn && (
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
                takes the middle and the width. All of it stands down while the grid has
                the page. */}
            {!gridOn && (
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
            )}

            {/* Both of these need the full width -- the histogram to keep its months
                apart, the grid because it is a column per month. The histogram keeps its
                own switch either way: it is the one thing here that reads *with* the
                grid rather than competing with it, both being a month at a time. */}
            {showChart && (
                <div className={clsx(!gridOn && 'mt-4')}>
                    <MonthlyInvestedChart />
                </div>
            )}

            {/* The grid only needs a top gap when the histogram is above it; otherwise it
                is the first thing under the controls and sets its own. */}
            {gridOn && (
                <div className={clsx(showChart && 'mt-4')}>
                    <MonthlyView showPercentages={showPercentages} period={period} />
                </div>
            )}
        </div>
    );
};

export default LedgerPage;
