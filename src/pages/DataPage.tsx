import React, { useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Download, Upload, AlertTriangle, FileJson, ShieldCheck, RefreshCcw, History } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

const DataPage: React.FC = () => {
    const { transactions, stocks, cashEntries, payouts, importAllData } = usePortfolio();
    const { confirm } = useConfirm();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            const data = {
                transactions,
                stocks,
                cashEntries,
                payouts,
                version: '1.0',
                exportedAt: new Date().toISOString(),
                stats: {
                    assets: stocks.length,
                    transactions: transactions.length,
                    allocations: cashEntries.length,
                    payouts: payouts.length,
                }
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sip-portfolio-full-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Backup generated successfully!');
        } catch (err) {
            toast.error('Failed to export data');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);

                const stocks = data.stocks || data.stock_records || data.portfolio || [];
                const transactions = data.transactions || data.transaction_records || [];
                const cashEntries = data.cashEntries || data.cash_entries || data.cash || [];
                const payouts = data.payouts || data.payout_records || data.dividends || [];

                if (stocks.length === 0 && transactions.length === 0 && cashEntries.length === 0 && payouts.length === 0) {
                    throw new Error('The backup file seems to be empty or in an unrecognized format.');
                }

                const isConfirmed = await confirm({
                    title: 'System Recovery',
                    message: 'Wipe all current data and restore from this backup file? This action is immediate and cannot be reversed.',
                    variant: 'danger',
                    confirmText: 'Restore Now',
                    cancelText: 'Cancel'
                });

                if (isConfirmed) {
                    toast.promise(
                        importAllData({
                            transactions,
                            stocks,
                            cashEntries,
                            payouts,
                        }),
                        {
                            loading: 'Restoring data...',
                            success: 'System restored successfully!',
                            error: 'Failed to restore system data.'
                        }
                    );
                }
            } catch (err) {
                toast.error('Restore Failed: ' + (err instanceof Error ? err.message : 'Invalid file structure'));
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="space-y-12 max-w-[1200px] mx-auto animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 w-8 bg-blue-600 rounded-full" />
                        <span className="text-[10px] font-black text-blue-600 tracking-[0.3em] uppercase">Security Engine</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-blue-600" size={32} />
                        Vault & Restore
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 pl-1 italic">Protect your financial history with local backups.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Export Card */}
                <div className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 text-blue-50/50 group-hover:scale-110 transition-transform duration-700">
                        <Download size={180} />
                    </div>

                    <div className="relative">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <Download size={28} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Generate Backup</h2>
                        <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-xs">
                            Create a complete snapshot of your stocks, transactions, cash budget, and payouts in a secure JSON format.
                        </p>

                        <div className="space-y-4 mb-10">
                            {[
                                { label: 'Asset Definitions', count: stocks.length },
                                { label: 'Accumulation Records', count: transactions.length },
                                { label: 'Budget Provisions', count: cashEntries.length },
                                { label: 'Dividend Receipts', count: payouts.length }
                            ].map(stat => (
                                <div key={stat.label} className="flex items-center justify-between border-b border-slate-50 pb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                    <span className="text-sm font-black text-slate-900">{stat.count}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleExport}
                            className="w-full bg-slate-900 hover:bg-blue-600 text-white h-16 rounded-2xl transition-all duration-300 font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 group/btn"
                        >
                            <FileJson size={20} className="group-hover/btn:rotate-12 transition-transform" />
                            SECURE EXPORT
                        </button>
                    </div>
                </div>

                {/* Import Card */}
                <div className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-amber-900/10 transition-all duration-500 relative overflow-hidden border-dashed border-2">
                    <div className="absolute -right-8 -top-8 text-amber-50/50 group-hover:scale-110 transition-transform duration-700">
                        <History size={180} />
                    </div>

                    <div className="relative">
                        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <RefreshCcw size={28} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">System Recovery</h2>
                        <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-xs">
                            Restore your entire platform's state from a previously generated backup file. This process is immediate.
                        </p>

                        <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 mb-10">
                            <div className="flex gap-4">
                                <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
                                <div className="text-xs text-amber-700 font-bold leading-relaxed uppercase tracking-tight">
                                    Warning: This will overwrite all current local data. Ensure your current state is backed up first.
                                </div>
                            </div>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            accept=".json"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-white hover:bg-amber-500 text-slate-900 hover:text-white h-16 rounded-2xl border-2 border-slate-900 hover:border-amber-500 transition-all duration-300 font-black flex items-center justify-center gap-3 active:scale-95 group/btn"
                        >
                            <Upload size={20} className="group-hover/btn:-translate-y-1 transition-transform" />
                            UPLOAD SNAPSHOT
                        </button>
                    </div>
                </div>
            </div>

            {/* Support section */}
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <FileJson className="text-blue-500" size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase">Universal Portability</h4>
                        <p className="text-xs text-slate-400 font-medium">Backup files are standard JSON and can be read by any text editor.</p>
                    </div>
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Encrypted Storage: Local Only</div>
            </div>
        </div>
    );
};

export default DataPage;
