import React, { useMemo } from 'react';
import { LineChart, ArrowDown } from 'lucide-react';
import HoldingsTable from '../components/HoldingsTable';
import { usePortfolio } from '../context/PortfolioContext';
import SectorAllocationChart from '../components/SectorAllocationChart';
import StockManager from '../components/StockManager';
import DashboardSkeleton from '../components/DashboardSkeleton';
import { computeHoldings } from '../utils/holdings';

const DashboardPage: React.FC = () => {
    const { loading, transactions } = usePortfolio();

    // Both cards render nothing without holdings, which would otherwise leave a new
    // user staring at an empty page with no idea what to do next.
    const hasHoldings = useMemo(() => computeHoldings(transactions).length > 0, [transactions]);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="flex flex-col gap-4 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {hasHoldings ? (
                /* Both cards stretch to the taller of the two, and no further -- the row is sized
                   by its content rather than the viewport, so no dead space hangs off the bottom. */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7">
                        <HoldingsTable />
                    </div>

                    <div className="lg:col-span-5">
                        <SectorAllocationChart />
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 shadow-sm px-6 py-12 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                        <LineChart size={22} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No holdings yet</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2 max-w-sm leading-relaxed">
                        Start by adding the symbols you track, then record what you bought in Monthly Entry.
                        Your allocation and sector breakdown will show up here.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                        <ArrowDown size={13} className="animate-bounce" />
                        Add your first symbol below
                    </div>
                </div>
            )}

            {/* Asset master list */}
            <div className="shrink-0">
                <StockManager />
            </div>

        </div>
    );
};

export default DashboardPage;
