import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart,
    Wallet,
    TrendingUp,
    PieChart,
    Landmark,
    ArrowRight,
    ShieldCheck,
    Zap,
    Layers,
    Repeat,
    Database
} from 'lucide-react';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    const features = [
        {
            icon: LineChart,
            title: "Stock Management",
            description: "Effortlessly track your equity investments with real-time value updates and performance metrics."
        },
        {
            icon: Repeat,
            title: "SIP Entries",
            description: "Streamlined monthly entry system for systematic investment plans. Bulk add transactions with ease."
        },
        {
            icon: Landmark,
            title: "Live Portfolio",
            description: "Direct integration with market APIs to show your portfolio's worth in real-time."
        },
        {
            icon: PieChart,
            title: "Asset Allocation",
            description: "Visual breakdown of your investments across different assets and sectors."
        },
        {
            icon: Wallet,
            title: "Cash Management",
            description: "Track uninvested cash and liquidity to maintain a balanced financial ecosystem."
        },
        {
            icon: TrendingUp,
            title: "Dividend Tracking",
            description: "Record and monitor payouts to see the true compounding effect of your portfolio."
        },
        {
            icon: Layers,
            title: "Sector Analysis",
            description: "Deep dive into sector-wise exposure to ensure proper diversification."
        },
        {
            icon: Database,
            title: "Secure Backup",
            description: "Full JSON data import/export capabilities to keep your financial records safe and portable."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-900 font-sans text-slate-100 selection:bg-blue-500/30">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                            <LineChart className="text-white" size={20} />
                        </div>
                        <span className="font-black text-xl tracking-tight text-white">FINSIP</span>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        Member Login
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-[120px] rounded-full translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-1/2 h-full bg-indigo-600/10 blur-[120px] rounded-full -translate-x-1/2" />

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Zap size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Enterprise Grade Portfolio Tracking</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-8 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                        Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Wealth</span><br />
                        With Precision Data.
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                        The ultimate tool for tracking SIPs, monitoring live equity performance, and managing sector allocation.
                        Designed for the modern investor who demands clarity.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-sm tracking-wide transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-blue-600/25"
                        >
                            ACCESS DASHBOARD <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-slate-900/50 relative border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">Complete Financial Command</h2>
                        <p className="text-slate-400">Everything you need to manage your portfolio architecture.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="bg-slate-800/20 backdrop-blur-sm border border-white/5 p-6 rounded-3xl hover:bg-slate-800/40 transition-all duration-300 group hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600/20 transition-colors">
                                    <feature.icon className="text-slate-300 group-hover:text-blue-400" size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Privacy / Security Stub */}
            <section className="py-20 border-t border-white/5">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex p-4 rounded-full bg-emerald-500/10 mb-6">
                        <ShieldCheck className="text-emerald-400" size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight mb-4">Your Data, Encrypted & Secure</h2>
                    <p className="text-slate-400 mb-8">
                        We use row-level security and enterprise-grade encryption.
                        Your financial footprint belongs to you, and only you.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-slate-950">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="font-black text-slate-500 tracking-widest text-xs uppercase">SIP Portfolio Tracker</span>
                    </div>
                    <div className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                        Made with ❤️ by Mtw
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
