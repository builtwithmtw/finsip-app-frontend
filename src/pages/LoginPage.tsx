import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, Mail, Lock, UserPlus, LogIn, Activity } from 'lucide-react';
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

    const signUpPaused = false;

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);

        try {
            const { error } = isRegisterMode
                ? await signUp(email, password, username)
                : await signIn(email, password);

            if (error) {
                toast.error('Authentication Failed', { description: error.message });
            } else if (isRegisterMode) {
                toast.success('Account Created', { description: 'Your secure portfolio is now ready.' });
            }
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans uppercase">
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-sm relative animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-2xl mb-6">
                        <Activity className="text-white" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-1">Portfolio Ledger</h1>
                    <p className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">Enterprise Authentication Gateway</p>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                    <div className="flex gap-2 p-1 bg-slate-900/50 rounded-2xl mb-8">
                        <button
                            onClick={() => setIsRegisterMode(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${!isRegisterMode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <LogIn size={14} /> SIGN IN
                        </button>
                        {signUpPaused ? null : <button
                            onClick={() => setIsRegisterMode(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${isRegisterMode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <UserPlus size={14} /> CREATE
                        </button>}
                    </div>

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                        {isRegisterMode && (
                            <div className="relative group animate-in slide-in-from-top-2 duration-300">
                                <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="DISPLAY NAME"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold focus:border-blue-500 outline-none transition-all"
                                    required={isRegisterMode}
                                />
                            </div>
                        )}
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="email"
                                placeholder="IDENTITY EMAIL"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold focus:border-blue-500 outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="password"
                                placeholder="ACCESS PASSWORD"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold focus:border-blue-500 outline-none transition-all"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-2xl font-black text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 disabled:opacity-50"
                        >
                            {authLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isRegisterMode ? 'INITIALIZE ACCOUNT' : 'ESTABLISH LINK'}
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-10 space-y-2">
                    <p className="text-slate-600 text-[10px] font-black tracking-[0.2em]">KSE GATEWAY SECURED v3.0</p>
                    <p className="text-slate-700 text-[8px] font-bold">256-BIT END-TO-END ENCRYPTED</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
