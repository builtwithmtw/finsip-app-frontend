import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { Plus, Trash2, Search, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { getSectorForSymbol } from '../data/psxSectors';

const StockManager: React.FC = () => {
    const { stocks, addStock, removeStock, reorderStocks } = usePortfolio();
    const { confirm } = useConfirm();
    const [newStock, setNewStock] = useState('');
    const [selectedSector, setSelectedSector] = useState('Others');
    // True while the sector below was filled in from the PSX lookup rather than
    // picked by hand -- used to show the little "auto" hint. Cleared the moment
    // the user changes the dropdown themselves.
    const [autoDetected, setAutoDetected] = useState(false);

    // Auto-fill the sector when the typed symbol matches a known PSX ticker.
    // Unknown symbols leave the current selection untouched (still editable).
    useEffect(() => {
        const detected = getSectorForSymbol(newStock);
        if (detected) {
            setSelectedSector(detected);
            setAutoDetected(true);
        } else {
            setAutoDetected(false);
        }
    }, [newStock]);

    // Chips reorder live under the cursor; the new order is only written once the drag ends.
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOrder, setDragOrder] = useState<string[] | null>(null);

    // What the list looks like right now: the in-flight order while dragging, else the real one.
    const displayed = dragOrder
        ? dragOrder.flatMap(id => stocks.find(s => s.id === id) ?? [])
        : stocks;

    const moveChip = (from: number, to: number) => {
        const ids = displayed.map(s => s.id);
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);

        setDragOrder(ids);
        setDragIndex(to);
    };

    const commitOrder = () => {
        if (dragOrder) reorderStocks(dragOrder);
        setDragIndex(null);
        setDragOrder(null);
    };

    // Short PSX sector labels -- they show up in tight spots (chart legend, entry rows), so the
    // full exchange names don't fit. The original eight are kept verbatim: sectors are stored as
    // free text on the stock row, so renaming one would orphan every stock already tagged with it.
    const sectors = [
        'Autos',        // assemblers + parts
        'Banks',
        'Cables',
        'Cement',
        'Chemicals',    // + synthetics
        'Engineering',
        'Fertilizer',
        'Foods',        // + vanaspati
        'Glass',
        'Insurance',
        'Investments',  // + leasing, modarabas, mutual funds
        'Leather',
        'Oil & Gas',    // + exploration, marketing, refinery
        'Packaging',    // paper & board
        'Pharma',
        'Power',
        'Property',
        'REITS',
        'Sugar',
        'Tech',
        'Textiles',     // composite + spinning + weaving + woollen
        'Tobacco',
        'Transport',
        'Others',
    ];

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

    const handleRemove = async (id: string, symbol: string) => {
        const isConfirmed = await confirm({
            title: 'Retire Asset',
            message: `Are you sure you want to remove ${symbol}? Transactions for this stock will still remain but it won't appear in new entry forms.`,
            variant: 'danger',
            confirmText: 'Remove Asset',
            cancelText: 'Cancel'
        });

        if (isConfirmed) {
            removeStock(id);
            toast.success(`${symbol} retired from active list.`);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 space-y-3">
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <Search size={14} />
                    </div>
                    <input
                        type="text"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        placeholder="ADD SYMBOL, E.G. MEBL"
                        className="w-full h-9 bg-slate-50 border-0 rounded-md pl-9 pr-3 text-slate-900 text-sm font-black placeholder:text-slate-300 placeholder:font-bold focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all uppercase"
                    />
                </div>

                <div className="relative sm:w-40">
                    <select
                        value={selectedSector}
                        onChange={(e) => { setSelectedSector(e.target.value); setAutoDetected(false); }}
                        className="h-9 w-full bg-slate-50 border-0 rounded-md px-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all cursor-pointer"
                    >
                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {autoDetected && (
                        <span
                            title="Sector auto-detected from symbol"
                            className="absolute right-7 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"
                        >
                            <Sparkles size={12} />
                        </span>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={!newStock.trim()}
                    className="h-9 bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 disabled:opacity-40 justify-center whitespace-nowrap"
                >
                    <Plus size={14} />
                    Add
                </button>
            </form>

            {stocks.length === 0 ? (
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] py-2">No assets yet</p>
            ) : (
                // Caps its own height so the dashboard never grows a page scrollbar.
                <div className="flex flex-wrap gap-1.5 max-h-[92px] overflow-y-auto scrollbar-hide-auto">
                    {displayed.map((stock, index) => (
                        <div
                            key={stock.id}
                            draggable
                            onDragStart={() => setDragIndex(index)}
                            onDragEnter={() => dragIndex !== null && dragIndex !== index && moveChip(dragIndex, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={commitOrder}
                            className={clsx(
                                'group bg-slate-50 hover:bg-white border rounded-md pl-1.5 pr-1 py-1 flex items-center gap-1.5 transition-colors cursor-grab active:cursor-grabbing',
                                dragIndex === index
                                    ? 'border-blue-300 bg-white opacity-60'
                                    : 'border-slate-100 hover:border-blue-100'
                            )}
                        >
                            <GripVertical size={12} className="text-slate-300 group-hover:text-slate-400 shrink-0" />
                            <span className="text-xs font-black text-slate-900 uppercase">{stock.symbol}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.sector || 'Others'}</span>
                            <button
                                onClick={() => handleRemove(stock.id, stock.symbol)}
                                className="p-0.5 text-slate-300 hover:text-rose-500 rounded transition-all"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StockManager;
