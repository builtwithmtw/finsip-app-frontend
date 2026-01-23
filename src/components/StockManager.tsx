import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, Trash2, LayoutGrid, Info, Search } from 'lucide-react';
import { toast } from 'sonner';

const StockManager: React.FC = () => {
    const { stocks, addStock, removeStock } = usePortfolio();
    const [newStock, setNewStock] = useState('');
    const [selectedSector, setSelectedSector] = useState('Others');

    const sectors = ['Banks', 'Cement', 'Fertilizer', 'Others', 'Oil & Gas', 'Power', 'Tech', 'REITS'];

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const symbol = newStock.trim().toUpperCase();
        if (symbol) {
            if (stocks.some(s => s.symbol === symbol)) {
                toast.error(`${symbol} already exists in your list.`);
                return;
            }
            addStock(symbol, selectedSector);
            toast.success(`${symbol} added to portfolio master list.`);
            setNewStock('');
        }
    };

    const handleRemove = (id: string, symbol: string) => {
        if (window.confirm(`Are you sure you want to remove ${symbol}? Transactions for this stock will still remain but it won't appear in new entry forms.`)) {
            removeStock(id);
            toast.success(`${symbol} retired from active list.`);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <LayoutGrid className="text-blue-600" size={24} />
                    Asset Master List
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Configure the stocks and sectors available for your monthly SIP.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
                <form onSubmit={handleAdd} className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Symbol</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                value={newStock}
                                onChange={(e) => setNewStock(e.target.value)}
                                placeholder="E.G. MEBL..."
                                className="w-full h-14 bg-slate-50 border-0 rounded-2xl pl-12 pr-4 text-slate-900 font-black placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all uppercase"
                            />
                        </div>
                    </div>

                    <div className="w-full lg:w-64">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Sector Class</label>
                        <select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="w-full h-14 bg-slate-50 border-0 rounded-2xl px-6 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all cursor-pointer appearance-none"
                        >
                            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="lg:pt-6 flex items-end">
                        <button
                            type="submit"
                            disabled={!newStock.trim()}
                            className="w-full lg:w-auto h-14 bg-blue-600 hover:bg-blue-500 text-white px-10 rounded-2xl transition-all duration-300 font-black flex items-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95 disabled:opacity-50 justify-center whitespace-nowrap"
                        >
                            <Plus size={20} />
                            Add to List
                        </button>
                    </div>
                </form>
            </div>

            {stocks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-inner">
                    <div className="inline-flex p-4 bg-slate-50 rounded-full mb-4">
                        <LayoutGrid className="text-slate-300" size={32} />
                    </div>
                    <p className="text-slate-400 font-bold">No assets added yet. Start by adding one above.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {stocks.map((stock) => (
                        <div
                            key={stock.id}
                            className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-3">
                                <button
                                    onClick={() => handleRemove(stock.id, stock.symbol)}
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{stock.sector || 'Others'}</span>
                                <span className="text-2xl font-black text-slate-900 group-hover:translate-x-1 transition-transform">{stock.symbol}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                <Info size={18} className="text-amber-600 flex-shrink-0" />
                <p className="text-[11px] text-amber-700 font-bold uppercase tracking-wide">
                    Retired stocks will not appear in forms but historical data remains stored in your database.
                </p>
            </div>
        </div>
    );
};

export default StockManager;
