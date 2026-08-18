"use client";

import React from 'react';
import clsx from 'clsx';
import { LineChart, Percent } from 'lucide-react';
import MonthlyView from '../components/MonthlyView';
import MonthlyInvestedChart from '../components/MonthlyInvestedChart';
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
    const [showPercentages, setShowPercentages] = useLocalStorage<boolean>('finsip:ledger-percentages', true);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-2 flex items-center justify-end gap-1.5">
                <Toggle
                    label="Flow"
                    active={showChart}
                    title={showChart ? 'Hide the monthly flow chart' : 'Show the monthly flow chart'}
                    onClick={() => setShowChart(v => !v)}
                >
                    <LineChart size={12} />
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

            {/* Above the grid: the same months the table lists, read as a shape. */}
            {showChart && <MonthlyInvestedChart />}
            <MonthlyView showPercentages={showPercentages} />
        </div>
    );
};

export default LedgerPage;