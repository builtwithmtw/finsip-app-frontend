import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart,
    Wallet,
    TrendingUp,
    PieChart,
    ArrowRight,
    Zap,
    Repeat,
    Database,
    Globe,
    Activity,
    Lock
} from 'lucide-react';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: LineChart,
            title: "Equity Command",
            description: "Precision tracking for your stock portfolio with real-time valuation and instant performance metrics."
        },
        {
            icon: Zap,
            title: "Live Terminal",
            description: "Direct feed integration with market APIs. Monitor latency, switch proxies, and track velocity in real-time."
        },
        {
            icon: Repeat,
            title: "SIP Automobile",
            description: "Automated monthly entry pathways for systematic investment plans. Bulk processing capabilities included."
        },
        {
            icon: Database,
            title: "Data Vault",
            description: "Full JSON-based archival system. Export your entire financial state and restore it instantly on any device."
        },
        {
            icon: Wallet,
            title: "Liquidity Engine",
            description: "Track uninvested capital allocations and manage cash flow with granular precision."
        },
        {
            icon: TrendingUp,
            title: "Yield Harvester",
            description: "Dedicated modules for dividend tracking and realized profit settlement logs."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-blue-500/30 overflow-x-hidden">

            {/* Ambient Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse-slow delay-1000" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-500/5 blur-[120px] rounded-full" />
            </div>

            {/* Navigation */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-default">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-2.5 rounded-xl border border-white/10 relative">
                                <LineChart className="text-blue-400" size={20} />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black text-xl tracking-tight text-white leading-none">FINSIP</span>
                            <span className="text-[9px] font-bold text-slate-500 tracking-[0.3em] uppercase">Matrix Protocol</span>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="group relative px-6 py-2.5 rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10 font-bold text-xs uppercase tracking-widest text-white group-hover:text-blue-200 transition-colors flex items-center gap-2">
                            Initialize <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-48 pb-32 lg:pb-48">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-white/10 shadow-xl mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 backdrop-blur-md">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">System Operational • V1.2.0</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-500 mb-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100 select-none">
                            WEALTH<br />
                            ARCHITECTURE
                        </h1>

                        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-14 leading-relaxed font-medium tracking-wide animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                            The definitive environment for modern portfolio orchestration.
                            Live market telemetry, granular asset control, and enterprise-grade ledger resolution.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 w-full sm:w-auto">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto h-16 px-10 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] group"
                            >
                                <Zap size={18} className="group-hover:text-yellow-300 transition-colors" />
                                Access Terminal
                            </button>
                            <a
                                href="#features"
                                className="w-full sm:w-auto h-16 px-10 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3"
                            >
                                System Specs
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dashboard Preview / Glass Card */}
            <section className="relative px-6 pb-32">
                <div className="max-w-6xl mx-auto">
                    <div className="relative rounded-[2.5rem] bg-slate-900/50 border border-white/10 p-4 backdrop-blur-sm shadow-2xl animate-in fade-in slide-in-from-bottom-24 duration-1000 delay-500 overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                        {/* Mock UI Header */}
                        <div className="h-12 bg-slate-900/50 rounded-t-[1.5rem] border-b border-white/5 flex items-center px-6 justify-between">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                            </div>
                            <div className="px-4 py-1 rounded-full bg-black/20 border border-white/5 text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                <Lock size={10} />
                                PRED_MARKET_V2.TSX
                            </div>
                        </div>

                        {/* Mock UI Content Area */}
                        <div className="aspect-[16/9] bg-slate-950/80 rounded-b-[1.5rem] flex items-center justify-center relative overflow-hidden font-mono">
                            {/* Neural Network Visualization */}
                            <div className="absolute inset-0 opacity-20">
                                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl animate-pulse-slow" />
                                <div className="absolute top-3/4 right-1/4 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl animate-pulse-slow delay-700" />
                                <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
                            </div>

                            <div className="relative z-10 w-full max-w-4xl p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Col 1 */}
                                <div className="space-y-6 pt-12 hidden md:block">
                                    <div className="bg-slate-900/50 border border-white/10 p-5 rounded-2xl backdrop-blur-md hover:border-blue-500/50 transition-colors group/card">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <Activity size={16} />
                                            </div>
                                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">+24.5%</span>
                                        </div>
                                        <div className="h-2 w-16 bg-slate-800 rounded mb-2 group-hover/card:bg-slate-700 transition-colors" />
                                        <div className="h-6 w-32 bg-slate-800 rounded mb-4 group-hover/card:bg-slate-700 transition-colors" />
                                        <div className="flex gap-1 h-8 items-end">
                                            {[40, 60, 45, 70, 50, 80].map((h, i) => (
                                                <div key={i} style={{ height: `${h}%` }} className="w-full bg-blue-500/20 rounded-sm group-hover/card:bg-blue-500/40 transition-colors" />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 border border-white/10 p-5 rounded-2xl backdrop-blur-md opacity-60">
                                        <div className="flex gap-4 items-center">
                                            <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-purple-500 animate-spin" />
                                            <div className="space-y-2">
                                                <div className="h-2 w-24 bg-slate-800 rounded" />
                                                <div className="h-2 w-16 bg-slate-800 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Col 2 - Center */}
                                <div className="space-y-6">
                                    <div className="bg-slate-900 border border-white/10 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />
                                        <div className="relative text-center">
                                            <div className="inline-flex items-center gap-2 mb-4">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase ">Live Feed</span>
                                            </div>
                                            <div className=" font-black text-slate-900 uppercase tracking-tight text-5xl font-black rounded-full text-white mb-2">187453</div>
                                            <div className="text-sm font-medium text-emerald-400 mb-8">+$12,402 (1.4%) Today</div>

                                            <div className="flex justify-center gap-2">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 animate-progress" style={{ animationDelay: `${i * 0.2}s` }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 border border-white/10 p-5 rounded-2xl backdrop-blur-md flex justify-between items-center group/item hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <TrendingUp size={18} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white mb-1">Dividend </div>
                                                <div className="text-[10px] text-slate-500">Last 30 Days</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">$4,290</div>
                                            <div className="text-[10px] text-emerald-400">+12%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Col 3 */}
                                <div className="space-y-6 pt-8 hidden md:block">
                                    <div className="bg-slate-900/50 border border-white/10 p-5 rounded-2xl backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Allocation</div>
                                            <PieChart size={14} className="text-slate-500" />
                                        </div>
                                        <div className="relative w-32 h-32 mx-auto">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-blue-500" strokeDasharray="351" strokeDashoffset="100" strokeLinecap="round" />
                                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-emerald-500" strokeDasharray="351" strokeDashoffset="280" strokeLinecap="round" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                                100%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex gap-3 items-center">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full w-2/3 bg-amber-500 rounded-full" />
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">SYNCING</span>
                                    </div>
                                </div>
                            </div>

                            {/* Overlay Vignette */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                        <div>
                            <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-6">SYSTEM<br /><span className="text-slate-600">CAPABILITIES</span></h2>
                            <p className="text-slate-400 max-w-md text-lg leading-relaxed">Engineered for the uncompromising investor. Every pixel serves a purpose.</p>
                        </div>
                        <div className="hidden md:block">
                            <div className="w-24 h-24 border border-slate-800 rounded-full flex items-center justify-center animate-spin-slow">
                                <Globe size={32} className="text-slate-600" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group bg-slate-900/40 hover:bg-slate-900/80 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 p-8 rounded-[2rem] transition-all duration-500 hover:-translate-y-2 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center mb-8 border border-white/5 group-hover:border-blue-500/30 group-hover:scale-110 transition-all duration-500 relative z-10 shadow-lg">
                                    <feature.icon className="text-slate-400 group-hover:text-blue-400 transition-colors" size={24} />
                                </div>

                                <h3 className="text-xl font-black text-white mb-4 tracking-tight uppercase relative z-10">{feature.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium relative z-10 group-hover:text-slate-300 transition-colors">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 border-t border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
                <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex p-6 rounded-full bg-slate-950 border border-white/5 mb-8 shadow-2xl">
                        <Activity className="text-emerald-500" size={48} />
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8">INITIALIZE<br />YOUR PROTOCOL</h2>
                    <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Data is the currency of the modern age. Take control of your financial narrative with a platform built for clarity.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="h-20 px-16 bg-white hover:bg-slate-200 text-slate-950 rounded-3xl font-black text-sm tracking-[0.25em] uppercase transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/10"
                    >
                        Begin Session
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-slate-950 relative z-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="font-black text-slate-500 tracking-[0.2em] text-[10px] uppercase">FinSip Protocol V1.2</span>
                    </div>
                    <div className="text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] flex gap-6">
                        <a href="#" className="hover:text-slate-400 transition-colors">Documentation</a>
                        <a href="#" className="hover:text-slate-400 transition-colors">Security</a>
                        <a href="#" className="hover:text-slate-400 transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
