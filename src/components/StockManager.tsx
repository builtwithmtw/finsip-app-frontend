"use client";

import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useConfirm } from '../context/ConfirmContext';
import { usePartialMask } from '../context/PrivacyContext';
import { Plus, Trash2, Search, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { getSectorForSymbol } from '../data/psxSectors';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, PanelHeader } from './Panel';

const StockManager: React.FC = () => {
    const { stocks, addStock, removeStock, reorderStocks } = usePortfolio();
    const { confirm } = useConfirm();
    const maskSymbol = usePartialMask();
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
        <Panel className="space-y-3.5 !p-4">
            <PanelHeader title="Asset Master List" caption="Drag to reorder">
                <span
                    className="text-lg font-semibold leading-none tabular-nums text-slate-900"
                    style={NUMERIC}
                >
                    {stocks.length}
                </span>
            </PanelHeader>

            {/* Fields sit on a recessed slate fill with no border at all — the focus ring
                is the only edge that ever appears, which keeps the row quiet until used. */}
            <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
                <div className="group relative flex-1">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500">
                        <Search size={14} />
                    </div>
                    <input
                        type="text"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        placeholder="ADD SYMBOL, E.G. MEBL"
                        style={DISPLAY}
                        className={clsx(
                            'h-10 w-full rounded-xl border-0 bg-slate-100/70 pl-10 pr-3 uppercase',
                            'text-[13px] font-semibold tracking-[0.06em] text-slate-900',
                            'placeholder:font-medium placeholder:tracking-[0.14em] placeholder:text-slate-400',
                            'transition-all focus:bg-white focus:ring-2 focus:ring-sky-500/25'
                        )}
                    />
                </div>

                <div className="relative sm:w-44">
                    <select
                        value={selectedSector}
                        onChange={(e) => { setSelectedSector(e.target.value); setAutoDetected(false); }}
                        style={DISPLAY}
                        className={clsx(
                            'h-10 w-full cursor-pointer rounded-xl border-0 bg-slate-100/70 px-3.5',
                            'text-[13px] font-semibold text-slate-700',
                            'transition-all focus:bg-white focus:ring-2 focus:ring-sky-500/25'
                        )}
                    >
                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {autoDetected && (
                        <span
                            title="Sector auto-detected from symbol"
                            className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-emerald-500"
                        >
                            <Sparkles size={12} />
                        </span>
                    )}
                </div>

                {/* Slate rather than blue: the accent is spent on data across this dashboard,
                    so the one action reads as material instead of another coloured surface. */}
                <button
                    type="submit"
                    disabled={!newStock.trim()}
                    style={DISPLAY}
                    className={clsx(
                        'flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-5',
                        'bg-slate-900 text-[10px] font-semibold uppercase tracking-[0.18em] text-white',
                        'ring-1 ring-slate-900/10 transition-all hover:bg-slate-800 active:scale-95',
                        'disabled:opacity-30'
                    )}
                >
                    <Plus size={14} />
                    Add
                </button>
            </form>

            {stocks.length === 0 ? (
                <p
                    className="py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                    style={DISPLAY}
                >
                    No assets yet
                </p>
            ) : (
                // Caps its own height so the dashboard never grows a page scrollbar.
                <div className="scrollbar-hide-auto flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
                    {displayed.map((stock, index) => (
                        <div
                            key={stock.id}
                            draggable
                            onDragStart={() => setDragIndex(index)}
                            onDragEnter={() => dragIndex !== null && dragIndex !== index && moveChip(dragIndex, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={commitOrder}
                            className={clsx(
                                'group flex cursor-grab items-center gap-1.5 rounded-lg py-1.5 pl-1.5 pr-1',
                                'ring-1 transition-all active:cursor-grabbing',
                                dragIndex === index
                                    ? 'bg-white opacity-60 ring-sky-400/40'
                                    : 'bg-slate-100/70 ring-transparent hover:bg-white hover:ring-slate-900/10'
                            )}
                        >
                            <GripVertical size={12} className="shrink-0 text-slate-300 group-hover:text-slate-400" />
                            {/* Ticker over sector rather than beside it: stacked, the chip is only
                                as wide as its longer line instead of the sum of both, so a long
                                sector name stops stretching the chip across the row. */}
                            <span className="flex min-w-0 flex-col gap-1">
                                <span
                                    className="truncate text-[12px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                                    style={DISPLAY}
                                >
                                    {maskSymbol(stock.symbol)}
                                </span>
                                <span
                                    className="truncate text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-slate-400"
                                    title={stock.sector || 'Others'}
                                    style={DISPLAY}
                                >
                                    {stock.sector || 'Others'}
                                </span>
                            </span>
                            <button
                                onClick={() => handleRemove(stock.id, stock.symbol)}
                                className="rounded p-0.5 text-slate-300 transition-colors hover:text-rose-500"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};

export default StockManager;