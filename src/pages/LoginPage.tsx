import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, Mail, UserPlus, LogIn, Activity, ShieldCheck, Database, Key } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
    const { signIn, signUp, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // Auth Form State
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

    const signUpPaused = false;

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);

        try {
            const { error, data } = isRegisterMode
                ? await signUp(email, password, username)
                : await signIn(email, password);

            console.log('Auth response:', { error, data });

            if (error) {
                console.error('Auth error:', error);
                toast.error(isRegisterMode ? 'Protocol Initialization Failed' : 'Access Denied', {
                    description: error.code || 'An unexpected error occurred. Please try again.'
                });
                setAuthLoading(false);
            } else if (isRegisterMode) {
                // Check if email confirmation is required
                if (data?.user && !data.session) {
                    console.log('Email confirmation required');
                    setEmailConfirmationSent(true);
                    toast.success('Verification Uplink Sent', {
                        description: 'Please confirm your identity email to complete registration.',
                        duration: 10000
                    });
                    // Clear form
                    setEmail('');
                    setPassword('');
                    setUsername('');
                } else {
                    console.log('Account created with immediate session');
                    toast.success('Identity Established', {
                        description: 'Your secure vault is ready for initialization.'
                    });
                }
                setAuthLoading(false);
            } else {
                // Login successful - loading will be handled by auth state change
                toast.success('Welcome Back, Operator');
            }
        } catch (err: any) {
            console.error('Auth exception:', err);
            toast.error('System Failure', {
                description: err?.message || 'An unexpected error occurred. Please try again.'
            });
            setAuthLoading(false);
        }
    };

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
                    <h1 className="text-3xl font-black text-white tracking-widest mb-2">Secure Gateway</h1>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        SYSTEM OPERATIONAL
                    </div>
                </div>

                {/* Glass Card */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-2 rounded-[2.5rem] border border-white/5 shadow-2xl ring-1 ring-white/5">
                    <div className="bg-slate-950/50 rounded-[2rem] p-6 sm:p-8">

                        {emailConfirmationSent && (
                            <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Mail className="text-emerald-400" size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-emerald-400 tracking-wider">UPLINK SUCCESSFUL</p>
                                        <p className="text-[9px] text-slate-400 mt-1 font-bold normal-case leading-relaxed">Verification link has been sent to your inbox.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Toggle */}
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl mb-8 border border-white/5">
                            <button
                                onClick={() => {
                                    setIsRegisterMode(false);
                                    setEmailConfirmationSent(false);
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all duration-300 ${!isRegisterMode
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <LogIn size={12} /> AUTHENTICATE
                            </button>
                            {signUpPaused ? null : (
                                <button
                                    onClick={() => {
                                        setIsRegisterMode(true);
                                        setEmailConfirmationSent(false);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all duration-300 ${isRegisterMode
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    <UserPlus size={12} /> INITIALIZE
                                </button>
                            )}
                        </div>

                        {/* Form */}
                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                            {isRegisterMode && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[9px] font-bold text-slate-500 ml-4 tracking-widest">Operator Alias</label>
                                    <div className="relative group">
                                        <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors duration-300" size={16} />
                                        <input
                                            type="text"
                                            placeholder="ENTER NAME"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold tracking-wider focus:border-blue-500/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-700"
                                            required={isRegisterMode}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 ml-4 tracking-widest">Identity</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors duration-300" size={16} />
                                    <input
                                        type="email"
                                        placeholder="EMAIL ADDRESS"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold tracking-wider focus:border-blue-500/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 ml-4 tracking-widest">Passcode</label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors duration-300" size={16} />
                                    <input
                                        type="password"
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold tracking-wider focus:border-blue-500/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full bg-white hover:bg-slate-200 text-slate-950 h-14 rounded-2xl font-black text-[10px] tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl mt-6 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {authLoading ? (
                                    <div className="w-4 h-4 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {isRegisterMode ? 'INITIALIZE LINK' : 'ESTABLISH LINK'}
                                        <ChevronRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-12 flex flex-col items-center gap-3">
                    <Database size={16} className="text-slate-700" />
                    <div className="space-y-1">
                        <p className="text-slate-500 text-[10px] font-black tracking-[0.2em]">FINSIP PROTOCOL V1.2</p>
                        <p className="text-slate-700 text-[8px] font-bold tracking-widest">ENCRYPTED CONNECTION</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
