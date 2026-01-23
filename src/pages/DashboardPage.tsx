import React from 'react';
import HoldingsTable from '../components/HoldingsTable';
import MonthlyView from '../components/MonthlyView';
import { PiggyBank, HandCoins, Wallet, LayoutDashboard, Activity } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import SectorAllocationChart from '../components/SectorAllocationChart';

const DashboardPage: React.FC = () => {
    const { transactions, cashEntries, payouts } = usePortfolio();

    // Total Value Calculation
    const [stockPrices, setStockPrices] = React.useState<Record<string, number>>({});
    const [isPricingLive, setIsPricingLive] = React.useState(false);

    React.useEffect(() => {
        const fetchPrices = async () => {
            try {
                const targetUrl = "https://beta-restapi.sarmaaya.pk/api/indices/KSE100/companies?page=1&limit=500";
                const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
                const response = await fetch(proxyUrl);
                const json = await response.json();
                const prices: Record<string, number> = {};
                const dataArray = (json && json.data) ? json.data : (json && json.response && json.response.data ? json.response.data : (Array.isArray(json) ? json : []));

                if (dataArray.length > 0) {
                    dataArray.forEach((item: any) => {
                        const symbol = (item.symbol || item.ticker || "").toString().toUpperCase().trim();
                        const price = Number(item.curr || item.last_price || item.price || 0);
                        if (symbol && price > 0) prices[symbol] = price;
                    });
                    setStockPrices(prices);
                    setIsPricingLive(true);
                }
            } catch (err) {
                console.error(err);
                setIsPricingLive(false);
            }
        };
        fetchPrices();
    }, []);

    const currentBalances = React.useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(t => {
            const current = map.get(t.symbol) || 0;
            const sharesNum = Number(t.shares || 0);
            if (t.type === 'sell') map.set(t.symbol, current - sharesNum);
            else map.set(t.symbol, current + sharesNum);
        });
        return map;
    }, [transactions]);

    const totalMarketValue = React.useMemo(() => {
        let val = 0;
        currentBalances.forEach((shares, symbol) => {
            if (shares > 0) val += shares * (stockPrices[symbol] || 0);
        });
        return val;
    }, [currentBalances, stockPrices]);

    // Net Investment = Total Buys - Total Sells
    const totalInvested = transactions.reduce((sum, t) => {
        const amount = Number(t.totalAmount) || 0;
        return sum + (t.type === 'sell' ? -amount : amount);
    }, 0);

    // Total Budget = Total from Cash Allocations
    const totalCash = cashEntries.reduce((sum, e) => sum + e.amount, 0);

    // Total Dividends/Payouts
    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

    // Remaining Cash = Budget - Net Investment
    const remainingCash = totalCash - totalInvested;

    return (
        <div className="space-y-12 pb-20 max-w-[1600px] mx-auto uppercase">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mr-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 w-8 bg-blue-600 rounded-full" />
                        <span className="text-[10px] font-black text-blue-600 tracking-[0.3em]">System Monitoring</span>
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
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalInvested)}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-emerald-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <Wallet size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Budget</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalCash)}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                            <HandCoins size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Payouts</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{formatCurrency(totalPayouts)}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-amber-900/5 group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                            <PiggyBank size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Liquidity</span>
                    </div>
                    <div className="text-2xl font-black leading-tight tracking-tighter" style={{ color: remainingCash < 0 ? '#ef4444' : '#d97706' }}>
                        {formatCurrency(remainingCash)}
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
