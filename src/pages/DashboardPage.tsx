import React from 'react';
import HoldingsTable from '../components/HoldingsTable';
import { usePortfolio } from '../context/PortfolioContext';
import SectorAllocationChart from '../components/SectorAllocationChart';
import StockManager from '../components/StockManager';

const DashboardPage: React.FC = () => {
    const { loading } = usePortfolio();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                <div className="text-xs text-slate-400">Loading portfolio…</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Both cards stretch to the taller of the two, and no further -- the row is sized
                by its content rather than the viewport, so no dead space hangs off the bottom. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7">
                    <HoldingsTable />
                </div>

                <div className="lg:col-span-5">
                    <SectorAllocationChart />
                </div>
            </div>

            {/* Asset master list */}
            <div className="shrink-0">
                <StockManager />
            </div>

        </div>
    );
};

export default DashboardPage;
