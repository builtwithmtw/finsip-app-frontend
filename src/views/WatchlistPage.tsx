"use client";

import React, { useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStocks } from "@/hooks/useStocks";
import { useConfirm } from "@/context/ConfirmContext";
import { toast } from "sonner";
import AddWatchlistModal from "@/components/watchlist/AddWatchlistModal";
import WatchlistTable, { type WatchlistRow } from "@/components/watchlist/WatchlistTable";
import WatchlistTableSkeleton from "@/components/watchlist/WatchlistTableSkeleton";

const WatchlistPage: React.FC = () => {
  const { items, loading, adding, addItem, removeItem } = useWatchlist();
  const { data: stocks = [], isLoading: stocksLoading } = useStocks();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);

  // Live figures come from the same feed the screener uses, joined by ticker.
  const stockBySymbol = useMemo(
    () => new Map(stocks.map((s) => [s.ticker.toUpperCase(), s])),
    [stocks],
  );

  const rows = useMemo<WatchlistRow[]>(
    () =>
      items.map((item) => {
        const s = stockBySymbol.get(item.symbol.toUpperCase());
        return {
          id: item.id,
          symbol: item.symbol,
          sector: s?.sector ?? item.sector ?? "—",
          price: s?.price ?? null,
          d1: s?.d1 ?? null,
          marketCap: s?.marketCap ?? null,
          volume: s?.volume ?? null,
        };
      }),
    [items, stockBySymbol],
  );

  const existing = useMemo(
    () => new Set(items.map((i) => i.symbol.toUpperCase())),
    [items],
  );

  const handleRemove = async (id: string, symbol: string) => {
    const ok = await confirm({
      title: "Remove from Watchlist",
      message: `Remove ${symbol} from your watchlist?`,
      variant: "danger",
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (ok) {
      removeItem(id);
      toast.success(`${symbol} removed from watchlist.`);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Star size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">Watchlist</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {items.length} {items.length === 1 ? "symbol" : "symbols"} tracked
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="h-9 bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 shrink-0"
        >
          <Plus size={14} />
          Add Item
        </button>
      </div>

      {/* Hold the full-screen loader until BOTH the saved list and the live feed
          are in, so the table never flashes rows with "—" prices that fill in a
          moment later. If the list is empty there's nothing to price, so we don't
          wait on the feed. */}
      {loading || (items.length > 0 && stocksLoading) ? (
        // Skeleton mirrors the real table so values land in place — no spinner,
        // no jump. Row count tracks the saved list (capped at a page) when it's
        // already in, so the placeholder is the right height.
        <WatchlistTableSkeleton rows={items.length > 0 ? Math.min(items.length, 10) : 8} />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Star size={22} className="text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">Your watchlist is empty</p>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Add a PSX symbol to start tracking its price and daily move.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-1.5 h-9 bg-slate-900 hover:bg-slate-800 text-white px-4 rounded-md transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
          >
            <Plus size={14} />
            Add your first symbol
          </button>
        </div>
      ) : (
        <WatchlistTable rows={rows} onRemove={handleRemove} />
      )}

      <AddWatchlistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stocks={stocks}
        stocksLoading={stocksLoading}
        existing={existing}
        adding={adding}
        onAdd={addItem}
      />
    </div>
  );
};

export default WatchlistPage;
