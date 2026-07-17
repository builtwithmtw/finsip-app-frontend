"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, ShieldCheck, Key, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const ResetPasswordPage: React.FC = () => {
    const { updatePassword, isAuthenticated, loading: authLoadingState } = useAuth();
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSessionValid, setIsSessionValid] = useState(true);

    useEffect(() => {
        // Supabase should have automatically established a session from the recovery link hash
        // If there's no session after loading finishes, the link might be invalid/expired
        if (!authLoadingState && !isAuthenticated) {
            setIsSessionValid(false);
        }
    }, [isAuthenticated, authLoadingState]);

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Sync Mismatch', {
                description: 'The passcodes entered do not match. Please verify and retry.'
            });
            return;
        }

        if (password.length < 6) {
            toast.error('Complexity Requirement', {
                description: 'Passcode must be at least 6 characters long.'
            });
            return;
        }

        setLoading(true);

        try {
            const { error } = await updatePassword(password);

            if (error) {
                console.error('Password reset error:', error);
                toast.error('Re-initialization Failed', {
                    description: error.message || 'An error occurred while updating your passcode.'
                });
            } else {
                toast.success('Passcode Re-established', {
                    description: 'Your security credentials have been updated successfully.'
                });
                // Redirect to dashboard or login
                setTimeout(() => {
                    router.replace('/dashboard');
                }, 2000);
            }
        } catch (err: any) {
            console.error('Reset exception:', err);
            toast.error('System Failure', {
                description: err?.message || 'An unexpected error occurred. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isSessionValid && !authLoadingState) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans uppercase">
                <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full animate-pulse-slow" />
                </div>

                <div className="w-full max-w-md relative z-10 text-center">
                    <div className="inline-flex p-4 bg-slate-900 border border-red-500/20 rounded-3xl shadow-2xl mb-8">
                        <AlertCircle className="text-red-500" size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-widest mb-4">Invalid Access Uplink</h1>
                    <p className="text-slate-400 text-[10px] font-bold tracking-widest leading-loose mb-8">
                        The security token has expired or is invalid. Please request a new recovery uplink.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="bg-slate-900 hover:bg-slate-800 text-white border border-white/5 py-3 px-8 rounded-xl text-[9px] font-black tracking-widest transition-all"
                    >
                        RETURN TO GATEWAY
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans uppercase selection:bg-blue-500/30">
            {/* Ambient Lighting */}
            <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse-slow delay-1000" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">

                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-slate-900 border border-white/5 rounded-3xl shadow-2xl mb-8 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <ShieldCheck className="text-blue-500 relative z-10" size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-widest mb-2">Credential Reset</h1>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        SECURITY RECOVERY ACTIVE
                    </div>
                </div>

                {/* Glass Card */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-2 rounded-[2.5rem] border border-white/5 shadow-2xl ring-1 ring-white/5">
                    <div className="bg-slate-950/50 rounded-[2rem] p-6 sm:p-8">
                        
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest mb-8 text-center leading-relaxed">
                            ESTABLISH A NEW ENCRYPTED PASSCODE TO REGAIN ACCESS TO THE FINSIP PROTOCOL.
                        </p>

                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 ml-4 tracking-widest">New Passcode</label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors duration-300" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white text-xs font-bold tracking-wider focus:border-blue-500/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-700"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(prev => !prev)}
                                        aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-500 transition-colors duration-300"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 ml-4 tracking-widest">Confirm Passcode</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors duration-300" size={16} />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white text-xs font-bold tracking-wider focus:border-blue-500/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-700"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(prev => !prev)}
                                        aria-label={showConfirmPassword ? 'Hide passcode' : 'Show passcode'}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-500 transition-colors duration-300"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || authLoadingState}
                                className="w-full bg-white hover:bg-slate-200 text-slate-950 h-14 rounded-2xl font-black text-[10px] tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl mt-6 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {loading || authLoadingState ? (
                                    <div className="w-4 h-4 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        UPDATE GATEWAY ACCESS
                                        <ChevronRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-12 flex flex-col items-center gap-3">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-[10px] font-black tracking-[0.2em]">FINSIP PROTOCOL SECURE RECOVERY</p>
                        <p className="text-slate-700 text-[8px] font-bold tracking-widest">RSA-4096 ENCRYPTED TRANSACTION</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;