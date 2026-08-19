"use client";

import React from 'react';
import clsx from 'clsx';
import { BarChart3, CalendarRange, Gauge, Percent } from 'lucide-react';
import MonthlyView from '../components/MonthlyView';
import MonthlyInvestedChart from '../components/MonthlyInvestedChart';
import LedgerAnalytics from '../components/LedgerAnalytics';
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

const LedgerPage: React.FC = () => {
    // The chart is off by default -- the grid is what the ledger is for, and the chart
    // is a second reading of the same months. The percentages are on: they're the
    // reading the grid is built around, but they widen every cell, so a long history
    // can trade them away for months on screen. Both remembered across sessions.
    const [showChart, setShowChart] = useLocalStorage<boolean>('finsip:ledger-chart', false);
    // Analytics is the whole book rather than the month on screen, so it's opt-in too.
    const [showAnalytics, setShowAnalytics] = useLocalStorage<boolean>('finsip:ledger-analytics', false);
    // Not a second grid -- the same grid with its months folded into years. Turning it
    // on is what hides the monthly columns.
    const [yearly, setYearly] = useLocalStorage<boolean>('finsip:ledger-yearly', false);
    const [showPercentages, setShowPercentages] = useLocalStorage<boolean>('finsip:ledger-percentages', true);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-2 flex items-center justify-end gap-1.5">
                <Toggle
                    label="Analytics"
                    active={showAnalytics}
                    title={showAnalytics ? 'Hide the whole-book figures' : 'Show the whole-book figures'}
                    onClick={() => setShowAnalytics(v => !v)}
                >
                    <Gauge size={12} />
                </Toggle>

                <Toggle
                    label="Histogram"
                    active={showChart}
                    title={showChart ? 'Hide the monthly histogram' : 'Show the monthly histogram'}
                    onClick={() => setShowChart(v => !v)}
                >
                    <BarChart3 size={12} />
                </Toggle>

                <Toggle
                    label="Yearly"
                    active={yearly}
                    title={yearly ? 'Show the grid month by month' : 'Fold the grid into years'}
                    onClick={() => setYearly(v => !v)}
                >
                    <CalendarRange size={12} />
                </Toggle>

                <Toggle
                    label="Share"
                    active={showPercentages}
                    title={
                        showPercentages
                            ? "Hide each cell's share of its month"
                            : "Show each cell's share of its month"
                    }
                    onClick={() => setShowPercentages(v => !v)}
                >
                    <Percent size={12} />
                </Toggle>
            </div>

            {/* Above the grid, coarse to fine: the standing figures, then the months read
                as a shape, then the grid itself. */}
            {showAnalytics && <LedgerAnalytics />}
            {showChart && <MonthlyInvestedChart />}
            <MonthlyView showPercentages={showPercentages} period={yearly ? 'year' : 'month'} />
        </div>
    );
};

export default LedgerPage;