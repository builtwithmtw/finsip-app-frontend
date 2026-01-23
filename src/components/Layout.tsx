import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, Calendar, LineChart, List, Menu, X, TrendingUp, FileJson, Sparkles } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';

const Layout: React.FC = () => {
    const { transactions } = usePortfolio();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [stockPrices, setStockPrices] = useState<Record<string, number>>({});
    const [isPricingLive, setIsPricingLive] = useState(false);

    const navItems = [
        { path: '/', label: 'Overview', icon: LayoutDashboard },
        { path: '/stocks', label: 'Manage Stocks', icon: List },
        { path: '/entry', label: 'Monthly Entry', icon: Calendar },
        { path: '/cash', label: 'Cash Allocation', icon: Wallet },
        { path: '/payouts', label: 'Payouts', icon: TrendingUp },
        { path: '/data', label: 'Backup & Restore', icon: FileJson },
    ];

    // Fetch Live Prices from Sarmaaya API
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const targetUrl =
                    "https://beta-restapi.sarmaaya.pk/api/indices/KSE100/companies?page=1&limit=500";
                const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);

                // Logging API results for status check as requested
                console.log(" API calling:");
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Network response was not ok');

                const json = await response.json();

                // Logging API results for status check as requested
                console.log("Sarmaaya API Response:", json);

                const prices: Record<string, number> = {};
                const dataArray = (json && json.response.data) ? json.response.data : (Array.isArray(json) ? json : []);

                if (dataArray.length > 0) {
                    dataArray.forEach((item: any) => {
                        const symbol = (item.symbol || item.ticker || "").toString().toUpperCase().trim();
                        // Using 'curr' field for price as requested
                        const price = Number(item.curr || item.last_price || item.price || 0);
                        if (symbol && price > 0) {
                            prices[symbol] = price;
                        }
                    });

                    if (Object.keys(prices).length > 0) {
                        setStockPrices(prices);
                        setIsPricingLive(true);
                    }
                }
            } catch (error) {
                console.error("Live pricing fetch error:", error);
                setIsPricingLive(false);
            }
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 5000000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const currentNav = navItems.find(item => item.path === location.pathname);
        const title = currentNav ? `${currentNav.label} | SIP Tracker` : 'SIP Tracker';
        document.title = title;
    }, [location.pathname]);

    // Calculate Current Share Balance per Ticker
    const currentBalances = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(t => {
            const current = map.get(t.symbol) || 0;
            const sharesNum = Number(t.shares || 0);
            if (t.type === 'sell') {
                map.set(t.symbol, current - sharesNum);
            } else {
                map.set(t.symbol, current + sharesNum);
            }
        });
        return map;
    }, [transactions]);

    // Total Live Value vs Aggregate Invested Cost
    const { totalMarketValue, totalInvestedCost } = useMemo(() => {
        let marketValue = 0;
        let cumulativeCost = 0;

        currentBalances.forEach((balance, symbol) => {
            if (balance <= 0) return;
            const livePrice = stockPrices[symbol] || 0;
            marketValue += balance * livePrice;
        });

        cumulativeCost = transactions.reduce((sum, t) => {
            const amount = Number(t.totalAmount) || 0;
            return sum + (t.type === 'sell' ? -amount : amount);
        }, 0);

        return { totalMarketValue: marketValue, totalInvestedCost: cumulativeCost };
    }, [currentBalances, stockPrices, transactions]);

    const displayWorth = (isPricingLive && totalMarketValue > 0) ? totalMarketValue : totalInvestedCost;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                        <LineChart className="text-white" size={18} />
                    </div>
                    <span className="font-black text-slate-900 tracking-tight text-lg">SIP Tracker</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 bg-slate-50 rounded-xl">
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Sidebar Navigation */}
            <aside className={clsx(
                "bg-white border-r border-slate-100 w-full md:w-64 flex-shrink-0 fixed md:sticky top-16 md:top-0 h-[calc(100vh-64px)] md:h-screen z-40 transition-all duration-300 ease-in-out md:translate-x-0 flex flex-col shadow-[1px_0_10px_rgba(0,0,0,0.02)]",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-8 hidden md:flex items-center gap-4 mb-4">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-2xl shadow-xl shadow-blue-500/30 ring-4 ring-blue-50">
                        <LineChart className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 leading-none tracking-tighter">SIP TRACKER</h1>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Sparkles size={10} className="text-blue-500" />
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Premium View</span>
                        </div>
                    </div>
                </div>

                <nav className="px-4 space-y-2 overflow-y-auto flex-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-4 mb-4">Core Navigator</div>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) => clsx(
                                "group flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-x-1"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon size={20} className={clsx("transition-transform duration-300 group-hover:scale-110")} />
                            <span className="tracking-tight">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-6">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2.5rem] shadow-2xl shadow-slate-900/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-white/5 group-hover:scale-125 transition-transform duration-500">
                            <Sparkles size={64} />
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Portfolio Worth</div>
                            <div className={clsx(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-500",
                                (isPricingLive && totalMarketValue > 0) ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-slate-500/10 border-slate-500/20"
                            )}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full", (isPricingLive && totalMarketValue > 0) ? "bg-emerald-500 animate-pulse" : "bg-slate-500")} />
                                <span className={clsx("text-[9px] font-black tracking-widest uppercase", (isPricingLive && totalMarketValue > 0) ? "text-emerald-500" : "text-slate-500")}>
                                    {(isPricingLive && totalMarketValue > 0) ? 'Live' : 'Static'}
                                </span>
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white leading-tight tracking-tighter mb-2">
                            {formatCurrency(displayWorth)}
                        </div>

                        {(isPricingLive && totalMarketValue > 0) && (
                            <div className="flex flex-col gap-1 border-t border-white/5 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Change</span>
                                    <span className={clsx(
                                        "text-[10px] font-black",
                                        totalMarketValue >= totalInvestedCost ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {totalMarketValue >= totalInvestedCost ? '+' : '-'} {formatCurrency(Math.abs(totalMarketValue - totalInvestedCost)).split('.')[0]}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Growth %</span>
                                    <span className={clsx(
                                        "text-[10px] font-black px-2 py-0.5 rounded-lg",
                                        totalMarketValue >= totalInvestedCost ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                    )}>
                                        {totalInvestedCost > 0 ? ((totalMarketValue - totalInvestedCost) / totalInvestedCost * 100).toFixed(2) : '0.00'}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 text-center">
                        <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest bg-slate-50 py-1.5 px-3 rounded-full inline-block border border-slate-100">
                            Built with love by Mtw
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-8 flex-1 w-full">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <Outlet />
                    </div>
                </div>
            </main>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};

export default Layout;
