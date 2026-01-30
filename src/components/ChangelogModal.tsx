import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, Zap, Shield, TrendingUp, Globe, Edit3 } from 'lucide-react';
import clsx from 'clsx';

interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    changes: {
        type: 'feature' | 'fix' | 'improvement';
        text: string;
        icon: React.ReactNode;
    }[];
}

const CHANGELOG_DATA: ChangelogEntry[] = [
    {
        version: '1.2.0',
        date: 'Jan 30, 2026',
        title: 'Network Resilience & Gains Settlement',
        changes: [
            {
                type: 'feature',
                text: 'Dynamic Proxy Terminal: Global API resilience system with selectable/custom gateways and failure recovery popups.',
                icon: <Globe size={14} className="text-blue-500" />
            },
            {
                type: 'feature',
                text: 'Settled P&L Engine: Visualized realized profits/losses in a new dedicated tab with historical settlement logs.',
                icon: <TrendingUp size={14} className="text-emerald-500" />
            },
            {
                type: 'feature',
                text: 'Ledger Reconciliation: One-click tool to rebuild your entire profit history from raw transaction logs.',
                icon: <Zap size={14} className="text-amber-500" />
            },
            {
                type: 'improvement',
                text: 'Granular Control: Added inline editing and deletion for all Transactions, Cash Allocations, and Payout records.',
                icon: <Edit3 size={14} className="text-purple-500" />
            },
            {
                type: 'improvement',
                text: 'Premium UI Polishing: Refined market latency indicators, updated typography, and enhanced transaction detail layouts.',
                icon: <Sparkles size={14} className="text-pink-500" />
            }
        ]
    },
    {
        version: '1.1.0',
        date: 'Jan 28, 2026',
        title: 'Core Portfolio Engine',
        changes: [
            {
                type: 'feature',
                text: 'Vault & Restore: Full JSON-based system state backup and recovery (Version 1.1).',
                icon: <Shield size={14} className="text-blue-600" />
            },
            {
                type: 'feature',
                text: 'Dividend Tracking: Dedicated dashboard for recording and viewing periodic payout receipts.',
                icon: <TrendingUp size={14} className="text-emerald-600" />
            },
            {
                type: 'improvement',
                text: 'Centralized Live Feed: Real-time price updates for all KSE asset holdings with improved sync logic.',
                icon: <Zap size={14} className="text-amber-600" />
            }
        ]
    }
];

const ChangelogModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem('last_seen_changelog');
        const latest = CHANGELOG_DATA[0].version;

        if (seen !== latest) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('last_seen_changelog', CHANGELOG_DATA[0].version);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-10 py-10 bg-slate-50 border-b border-slate-100 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                        <Sparkles size={240} />
                    </div>

                    <div className="relative">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                New Updates
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">V {CHANGELOG_DATA[0].version}</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase whitespace-pre-line">
                            Terminal{'\n'}Evolution
                        </h2>
                    </div>

                    <button
                        onClick={handleClose}
                        className="p-4 bg-white text-slate-400 hover:text-rose-500 rounded-3xl shadow-sm transition-all active:scale-90 group relative z-10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto px-10 py-8 custom-scrollbar">
                    <div className="space-y-12">
                        {CHANGELOG_DATA.map((entry, idx) => (
                            <div key={entry.version} className={clsx("relative", idx > 0 && "opacity-60")}>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{entry.title}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{entry.date} • Version {entry.version}</p>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    {entry.changes.map((change, cIdx) => (
                                        <div key={cIdx} className="group bg-slate-50 hover:bg-white p-5 rounded-3xl border border-slate-100 hover:border-blue-100 transition-all duration-300 flex gap-5 items-start shadow-sm hover:shadow-xl hover:shadow-blue-500/5">
                                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-50 transition-colors shrink-0">
                                                {change.icon}
                                            </div>
                                            <div className="pt-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={clsx(
                                                        "text-[9px] font-black uppercase tracking-[0.1em]",
                                                        change.type === 'feature' ? "text-emerald-500" :
                                                            change.type === 'fix' ? "text-rose-500" : "text-blue-500"
                                                    )}>
                                                        {change.type}
                                                    </span>
                                                    <CheckCircle2 size={10} className="text-slate-200" />
                                                </div>
                                                <p className="text-[13px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">
                                                    {change.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-10 bg-slate-900 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Matrix Protocol 2.0</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Automated Change Detection</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="px-8 h-14 bg-white text-slate-900 rounded-2xl font-black text-[11px] tracking-[0.2em] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-xl active:scale-95"
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangelogModal;
