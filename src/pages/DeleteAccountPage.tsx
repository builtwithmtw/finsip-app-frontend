import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { AlertTriangle, Trash2, ShieldAlert, CheckCircle2, UserX, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const DeleteAccountPage: React.FC = () => {
    const { signOut } = useAuth();
    const { clearAllData, stocks, transactions } = usePortfolio();
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const hasData = stocks.length > 0 || transactions.length > 0;

    const handleClearData = async () => {
        if (!window.confirm("WARNING: This will permanently delete all your financial records. This action cannot be undone.")) {
            return;
        }

        setLoading(true);
        try {
            await clearAllData();
            setStep(2);
        } catch (error) {
            // Error is handled in context
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (confirmText !== 'DELETE') {
            toast.error("Please type DELETE to confirm.");
            return;
        }

        setLoading(true);
        try {
            // Call the secure RPC function to delete the user account
            const { error } = await supabase.rpc('delete_own_account');

            if (error) throw error;

            toast.success("Account terminated successfully.");
            await signOut();
            navigate('/', { replace: true });
        } catch (error: any) {
            console.error('Account deletion error:', error);
            toast.error("Failed to delete account: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // If step 1 is done (data cleared) automatically move to step 2 if the user navigates back here
    // But for now, let's just rely on the flow.

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden selection:bg-red-500/30">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-full max-h-[500px] bg-red-600/5 blur-[100px] rounded-full animate-pulse-slow" />
            </div>

            <button
                onClick={() => navigate(-1)}
                className="absolute top-6 left-6 text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
            >
                <ArrowLeft size={16} /> <span className="text-xs font-bold tracking-widest uppercase">Abort</span>
            </button>

            <div className="w-full max-w-lg relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-3xl mb-6 shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-2">Protocol Termination</h1>
                    <p className="text-red-400/60 font-mono text-xs tracking-widest">IRREVERSIBLE ACTION DETECTED</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-red-500/10 rounded-[2rem] overflow-hidden shadow-2xl">
                    {/* Progress Steps */}
                    <div className="flex border-b border-white/5 bg-slate-950/30">
                        <div className={`flex-1 p-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest border-r border-white/5 transition-colors ${step === 1 ? 'text-red-400 bg-red-500/5' : 'text-slate-600'}`}>
                            {step > 1 ? <CheckCircle2 size={14} className="text-emerald-500" /> : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px]">1</span>}
                            PURGE DATA
                        </div>
                        <div className={`flex-1 p-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest transition-colors ${step === 2 ? 'text-red-400 bg-red-500/5' : 'text-slate-600'}`}>
                            <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px]">2</span>
                            TERMINATE ID
                        </div>
                    </div>

                    <div className="p-8">
                        {step === 1 ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4">
                                    <Trash2 className="text-red-500 shrink-0" size={20} />
                                    <div>
                                        <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-1">Data Purge Required</h3>
                                        <p className="text-xs text-red-400/70 leading-relaxed font-medium">
                                            Before you can delete your account, you must wipe all stored portfolio data from our secure vaults.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    {(hasData || true) ? (
                                        <button
                                            onClick={handleClearData}
                                            disabled={loading}
                                            className="w-full bg-red-600 hover:bg-red-500 text-white h-14 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-red-900/20"
                                        >
                                            {loading ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Trash2 size={16} /> PURGE ALL DATA
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="text-center p-6 bg-slate-950/50 rounded-2xl border border-white/5">
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">No Data Detected</p>
                                            <button
                                                onClick={() => setStep(2)}
                                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold tracking-widest transition-colors"
                                            >
                                                PROCEED TO STEP 2
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4">
                                    <UserX className="text-red-500 shrink-0" size={20} />
                                    <div>
                                        <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-1">Final Authorization</h3>
                                        <p className="text-xs text-red-400/70 leading-relaxed font-medium">
                                            This action terminates your user access permanently. You will be logged out immediately.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-500 ml-2 tracking-widest uppercase">Type "DELETE" to confirm</label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        className="w-full bg-slate-950 border border-red-500/20 rounded-2xl py-4 px-6 text-red-500 font-black text-sm tracking-widest focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all text-center"
                                    />
                                </div>

                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={loading || confirmText !== 'DELETE'}
                                    className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white h-14 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-red-900/20"
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <ShieldAlert size={16} /> ELIMINATE ACCOUNT
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountPage;
