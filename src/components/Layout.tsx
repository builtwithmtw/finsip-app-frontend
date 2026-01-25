import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, Calendar, LineChart, List, Menu, X, TrendingUp, FileJson, Sparkles, Landmark, LogOut } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import clsx from 'clsx';

const Layout: React.FC = () => {
    const { transactions, livePrices, isMarketLive } = usePortfolio();
    const { signOut } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { path: '/', label: 'Overview', icon: LayoutDashboard },
        { path: '/live', label: 'Live Portfolio', icon: Landmark },
        { path: '/stocks', label: 'Manage Stocks', icon: List },
        { path: '/entry', label: 'Monthly Entry', icon: Calendar },
        { path: '/cash', label: 'Cash Allocation', icon: Wallet },
        { path: '/payouts', label: 'Payouts', icon: TrendingUp },
        { path: '/data', label: 'Backup & Restore', icon: FileJson },
    ];

    useEffect(() => {
        const currentNav = navItems.find(item => item.path === location.pathname);
        const title = currentNav ? `${currentNav.label} | FINSIP` : 'FINSIP';
        document.title = title;
    }, [location.pathname]);

    // Total Live Value vs Aggregate Invested Cost (of current holdings)
    const { totalMarketValue, totalInvestedCost } = useMemo(() => {
        let marketValue = 0;
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

        map.forEach((data, symbol) => {
            const livePrice = livePrices[symbol] || 0;
            marketValue += data.totalShares * livePrice;
        });

        const invested = Array.from(map.values()).reduce((sum, h) => sum + h.totalCostBasis, 0);

        return { totalMarketValue: marketValue, totalInvestedCost: invested };
    }, [livePrices, transactions]);

    const displayWorth = (isMarketLive && totalMarketValue > 0) ? totalMarketValue : totalInvestedCost;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                        <LineChart className="text-white" size={18} />
                    </div>
                    <span className="font-black text-slate-900 tracking-tight text-lg">FINSIP</span>
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
                        <h1 className="text-xl font-black text-slate-900 leading-none tracking-tighter">FINSIP</h1>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">SIP Manager</span>
                            <Sparkles size={10} className="text-blue-500" />
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
                    <button
                        onClick={signOut}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 transition-all duration-300 w-full text-left"
                    >
                        <LogOut size={20} />
                        <span className="tracking-tight">Lock System</span>
                    </button>
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
                                (isMarketLive && totalMarketValue > 0) ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-slate-500/10 border-slate-500/20"
                            )}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full", (isMarketLive && totalMarketValue > 0) ? "bg-emerald-500 animate-pulse" : "bg-slate-500")} />
                                <span className={clsx("text-[9px] font-black tracking-widest uppercase", (isMarketLive && totalMarketValue > 0) ? "text-emerald-500" : "text-slate-500")}>
                                    {(isMarketLive && totalMarketValue > 0) ? 'Live' : 'Static'}
                                </span>
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white leading-tight tracking-tighter mb-2">
                            {formatCurrency(displayWorth).split('.')[0]}
                        </div>

                        {(isMarketLive && totalMarketValue > 0) && (
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
                            Made with ❤️ by Mtw
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
