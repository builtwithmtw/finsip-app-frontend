import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, Calculator, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
    const [pin, setPin] = useState('');
    const { login } = useAuth();
    const [iserror, setIsError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (login(pin)) {
            toast.success('Access Granted', {
                description: 'Welcome back to your portfolio tracker.'
            });
        } else {
            setIsError(true);
            setPin('');
            toast.error('Invalid PIN', {
                description: 'Please enter the correct authorization code.'
            });
            setTimeout(() => setIsError(false), 500);
        }
    };

    const addDigit = (digit: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + digit);
        }
    };

    const clearPin = () => setPin('');

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-md relative animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] shadow-2xl shadow-blue-500/20 mb-6">
                        <Calculator className="text-white" size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">SIP Tracker</h1>
                    <div className="flex items-center justify-center gap-1.5 opacity-50">
                        <Sparkles size={12} className="text-blue-400" />
                        <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">Authorized Access Only</span>
                    </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                    <div className="flex justify-center gap-4 mb-10">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i
                                    ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                    : 'border-slate-600'
                                    } ${iserror ? 'animate-bounce border-rose-500 bg-rose-500' : ''}`}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => addDigit(num.toString())}
                                    className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xl border border-white/5 transition-all active:scale-90 flex items-center justify-center"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearPin}
                                className="h-16 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black text-sm border border-rose-500/5 transition-all active:scale-90 flex items-center justify-center uppercase tracking-widest"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => addDigit('0')}
                                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xl border border-white/5 transition-all active:scale-90 flex items-center justify-center"
                            >
                                0
                            </button>
                            <button
                                type="submit"
                                disabled={pin.length < 4}
                                className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black text-xl border-0 shadow-lg shadow-blue-900/40 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:shadow-none"
                            >
                                <ChevronRight />
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center mt-10 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
                    Enterprise Security Standard v2.0
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
