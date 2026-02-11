import React from 'react';
import HoldingsTable from '../components/HoldingsTable';
import MonthlyView from '../components/MonthlyView';
import { PiggyBank, HandCoins, Wallet, LayoutDashboard } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import SectorAllocationChart from '../components/SectorAllocationChart';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const { transactions, cashEntries, payouts, loading } = usePortfolio();

    // Use dummy internal vars just to keep logic structural if needed,
    // but we can remove the entire useEffect block entirely.



    // Total Invested = Sum of Cost Basis of CURRENT holdings (Matching Table)
    const { totalInvested, totalCash, totalPayouts, remainingCash } = React.useMemo(() => {
        const map = new Map<string, { totalShares: number; totalCostBasis: number }>();

        [...transactions]
            .filter(t => t.shares > 0 && t.pricePerShare > 0)
            .sort((a, b) => a.month.localeCompare(b.month))
            .forEach(t => {
                const current = map.get(t.symbol) || { totalShares: 0, totalCostBasis: 0 };
                const sharesNum = Number(t.shares || 0);
                const priceNum = Number(t.pricePerShare || 0);
                const amountNum = Number(t.totalAmount || (sharesNum * priceNum));

                if (t.type === 'buy') {
                    current.totalShares += sharesNum;
                    current.totalCostBasis += amountNum;
                } else {
                    const avgPriceBeforeSell = current.totalShares > 0 ? current.totalCostBasis / current.totalShares : 0;
                    current.totalShares -= sharesNum;
                    current.totalCostBasis -= sharesNum * avgPriceBeforeSell;
                }
                if (current.totalShares > 0.001) map.set(t.symbol, current);
                else map.delete(t.symbol);
            });

        const invested = Array.from(map.values()).reduce((sum, h) => sum + h.totalCostBasis, 0);
        const cash = cashEntries.reduce((sum, e) => sum + (e.type === 'withdraw' ? -e.amount : e.amount), 0);
        const payoutsVal = payouts.reduce((sum, p) => sum + p.amount, 0);

        // For remaining cash, we still use the "Net Cash Out" logic as it represents bank balance
        const netCashOut = transactions.reduce((sum, t) => {
            const amount = Number(t.totalAmount) || 0;
            return sum + (t.type === 'sell' ? -amount : amount);
        }, 0);

        return {
            totalInvested: invested,
            totalCash: cash,
            totalPayouts: payoutsVal,
            remainingCash: cash - netCashOut
        };
    }, [transactions, cashEntries, payouts]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-700">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Syncing Portfolio Ledger</div>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20 max-w-[1600px] mx-auto uppercase animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mr-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 w-8 bg-blue-600 rounded-full" />
                        <span className="text-[10px] font-black text-blue-600 tracking-[0.3em]">
                            {user?.user_metadata?.display_name ? `WELCOME ${user.user_metadata.display_name.toUpperCase()}` : 'System Monitoring'}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="text-blue-600" size={32} />
                        Overview
                    </h1>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-blue-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                            <PiggyBank size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Invested</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalInvested).split('.')[0]}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-emerald-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <Wallet size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Budget</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalCash).split('.')[0]}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                            <HandCoins size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Payouts</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalPayouts).split('.')[0]}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-amber-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                            <PiggyBank size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Liquidity</span>
                    </div>
                    <div className="text-2xl font-black leading-tight tracking-tighter" style={{ color: remainingCash < 0 ? '#ef4444' : '#d97706' }}>
                        {formatCurrency(remainingCash).split('.')[0]}
                    </div>
                </div>
            </div>

            {/* 1. Monthly Purchase Matrix */}


            {/* 2 & 3 Side by Side Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-200">
                {/* Holdings - 7 columns */}
                <div className="lg:col-span-7 flex flex-col">
                    <div className="flex-1">
                        <HoldingsTable />
                    </div>
                </div>

                {/* Sectors - 5 columns */}
                <div className="lg:col-span-5 flex flex-col">
                    <div className="flex-1">
                        <SectorAllocationChart />
                    </div>
                </div>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">
                <MonthlyView />
            </div>

        </div>
    );
};

export default DashboardPage;
