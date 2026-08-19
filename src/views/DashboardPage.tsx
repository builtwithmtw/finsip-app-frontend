"use client";

import React, { useMemo } from 'react';
import { LineChart, ArrowDown } from 'lucide-react';
import HoldingsTable from '../components/HoldingsTable';
import { usePortfolio } from '../context/PortfolioContext';
import SectorAllocationChart from '../components/SectorAllocationChart';
import StockManager from '../components/StockManager';
import {
    HoldingsCardSkeleton,
    AllocationCardSkeleton,
    StockManagerSkeleton
} from '../components/DashboardSkeleton';
import { computeHoldings } from '../utils/holdings';
import { DISPLAY } from '../utils/typography';

const DashboardPage: React.FC = () => {
    const { transactions, stocksLoading, transactionsLoading } = usePortfolio();

    // Both cards render nothing without holdings, which would otherwise leave a new
    // user staring at an empty page with no idea what to do next.
    const hasHoldings = useMemo(() => computeHoldings(transactions).length > 0, [transactions]);

    // The page shell is never swapped out for a loader any more: each region
    // waits only on the query it actually reads. Holdings and the sector chart
    // both need transactions *and* stocks (to resolve a symbol's sector); the
    // asset list below needs only stocks, so it can land first.
    const cardsLoading = transactionsLoading || stocksLoading;

    return (
        <div className="flex flex-col gap-4 max-w-[1600px] mx-auto lg:h-full animate-in fade-in duration-500">
            {cardsLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <HoldingsCardSkeleton />
                    <AllocationCardSkeleton />
                </div>
            ) : hasHoldings ? (
                /* On the desktop shell this row takes exactly the height left over above the
                   asset list, so Overview never pushes the page into scroll no matter how many
                   holdings or sectors there are -- the holdings table scrolls inside itself and
                   the donut flexes down. `minmax(0,1fr)` is what lets the track shrink below its
                   content; a bare `1fr` would still grow to max-content. Below `lg` the cards
                   stack and stay content-sized. */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]">
                    <div className="lg:col-span-7 lg:min-h-0">
                        <HoldingsTable />
                    </div>

                    <div className="lg:col-span-5 lg:min-h-0">
                        <SectorAllocationChart />
                    </div>
                </div>
            ) : (
                /* The one dashed edge in the app — it says "nothing here yet" without a
                   line of copy, which is why this panel doesn't use the shared shell. */
                <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 ring-1 ring-slate-900/10">
                        <LineChart size={20} />
                    </div>
                    <h3
                        className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                        style={DISPLAY}
                    >
                        No holdings yet
                    </h3>
                    <p className="mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
                        Start by adding the symbols you track, then record what you bought in Monthly Entry.
                        Your allocation and sector breakdown will show up here.
                    </p>
                    <div
                        className="mt-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                        style={DISPLAY}
                    >
                        <ArrowDown size={13} className="animate-bounce text-sky-500" />
                        Add your first symbol below
                    </div>
                </div>
            )}

            {/* Asset master list */}
            <div className="shrink-0">
                {stocksLoading ? <StockManagerSkeleton /> : <StockManager />}
            </div>

        </div>
    );
};

export default DashboardPage;