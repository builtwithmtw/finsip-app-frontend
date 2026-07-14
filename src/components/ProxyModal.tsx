import React, { useState } from 'react';
import { useProxy } from '../context/ProxyContext';
import { Globe, Plus, Trash2, Check, X, Server, Link2 } from 'lucide-react';
import clsx from 'clsx';

const ProxyModal: React.FC = () => {
    const { showModal, setShowModal, proxies, selectedProxy, selectProxy, addCustomProxy, removeProxy } = useProxy();
    const [isAdding, setIsAdding] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customUrl, setCustomUrl] = useState('');

    if (!showModal) return null;

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (customName && customUrl) {
            addCustomProxy(customName, customUrl);
            setCustomName('');
            setCustomUrl('');
            setIsAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-xl shadow-sm w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-4 py-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
                            <Globe size={28} className="text-blue-600" />
                            Proxy Terminal
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mt-1">Select Gateway for Market Feed</p>
                    </div>
                    <button
                        onClick={() => setShowModal(false)}
                        className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-lg shadow-sm transition-all active:scale-90"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {proxies.map((proxy) => (
                            <div
                                key={proxy.id}
                                onClick={() => selectProxy(proxy)}
                                className={clsx(
                                    "p-5 rounded-lg border-2 transition-all cursor-pointer group flex items-center justify-between",
                                    selectedProxy.id === proxy.id
                                        ? "border-blue-600 bg-blue-50/50":"border-slate-100 bg-slate-50 hover:border-slate-300"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-xl flex items-center justify-center ",
                                        selectedProxy.id === proxy.id ? "bg-blue-600 text-white":"bg-white text-slate-400 group-hover:text-slate-600"
                                    )}>
                                        <Server size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-sm tracking-tight uppercase">{proxy.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">{proxy.url}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {proxy.isCustom && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeProxy(proxy.id);
                                            }}
                                            className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    {selectedProxy.id === proxy.id && (
                                        <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-sm ">
                                            <Check size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Custom Trigger */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full mt-6 h-14 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 font-black text-[10px] tracking-widest hover:border-blue-400 hover:text-blue-500 transition-all uppercase flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Register Custom Proxy
                        </button>
                    ) : (
                        <form onSubmit={handleAdd} className="mt-6 p-6 bg-slate-50 rounded-lg border border-slate-100 space-y-4 animate-in slide-in-from-top-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Gateway Name</label>
                                    <input
                                        autoFocus
                                        required
                                        type="text"
                                        placeholder="E.G. PERSONAL NODE"
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Bridge URL</label>
                                    <div className="relative">
                                        <Link2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <input
                                            required
                                            type="url"
                                            placeholder="HTTPS://PROXY.ORG/?"
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs font-bold focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all tabular-nums text-slate-900"
                                            value={customUrl}
                                            onChange={e => setCustomUrl(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-sm  active:scale-95 transition-all"
                                >
                                    Activate
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-6 h-12 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] tracking-widest uppercase active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">System Operational</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">LOCAL STORAGE SYNCED</p>
                </div>
            </div>
        </div>
    );
};

export default ProxyModal;
