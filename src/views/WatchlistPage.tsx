"use client";

import React, { useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStocks } from "@/hooks/useStocks";
import { usePortfolio } from "@/context/PortfolioContext";
import { computeHoldings } from "@/utils/holdings";
import { useConfirm } from "@/context/ConfirmContext";
import { toast } from "sonner";
import AddWatchlistModal from "@/components/watchlist/AddWatchlistModal";
import WatchlistTable, { type WatchlistRow } from "@/components/watchlist/WatchlistTable";
import WatchlistTableSkeleton from "@/components/watchlist/WatchlistTableSkeleton";
import { DISPLAY } from "@/utils/typography";

const WatchlistPage: React.FC = () => {
  const { items, loading, adding, addItem, removeItem } = useWatchlist();
  const { data: stocks = [], isLoading: stocksLoading } = useStocks();
  const { transactions } = usePortfolio();
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

  // Anything you actually hold is already on Live Portfolio, priced and with its P/L --
  // repeating it here makes the watchlist a list of things you own rather than a list of
  // things you are watching. Held rows are hidden, not deleted: sell out of a position
  // and the symbol comes straight back to the watchlist you put it on.
  const held = useMemo(
    () => new Set(computeHoldings(transactions).map((h) => h.symbol.toUpperCase())),
    [transactions],
  );

  const visibleRows = useMemo(
    () => rows.filter((r) => !held.has(r.symbol.toUpperCase())),
    [rows, held],
  );

  const hiddenCount = rows.length - visibleRows.length;

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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 ring-1 ring-slate-900/10">
            <Star size={17} />
          </div>
          <div>
            <h1
              className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
              style={DISPLAY}
            >
              Watchlist
            </h1>
            <p className="mt-2 flex items-center">
              <span
                className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500"
                style={DISPLAY}
              >
                {visibleRows.length} {visibleRows.length === 1 ? "symbol" : "symbols"} tracked
              </span>
              {/* Says what the filter took out, so a symbol you know you saved can't
                  look like it went missing. */}
              {hiddenCount > 0 && (
                <span
                  className="ml-2 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-300"
                  style={DISPLAY}
                >
                  · {hiddenCount} held
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={DISPLAY}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white ring-1 ring-slate-900/10 transition-all hover:bg-slate-800 active:scale-95"
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
      ) : visibleRows.length === 0 && rows.length > 0 ? (
        // Saved symbols exist, they are all held. Saying "empty" here would read as
        // data loss rather than as the filter doing its job.
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Star size={20} />
          </div>
          <p
            className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
            style={DISPLAY}
          >
            Everything here is in your portfolio
          </p>
          <p className="mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
            All {rows.length} watched {rows.length === 1 ? "symbol" : "symbols"} are positions you
            already hold, so they live on Live Portfolio instead. Add a symbol you don&apos;t own to
            start watching it.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            style={DISPLAY}
            className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 active:scale-95"
          >
            <Plus size={14} />
            Add a symbol
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Star size={20} />
          </div>
          <p
            className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
            style={DISPLAY}
          >
            Your watchlist is empty
          </p>
          <p className="mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
            Add a PSX symbol to start tracking its price and daily move.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            style={DISPLAY}
            className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 active:scale-95"
          >
            <Plus size={14} />
            Add your first symbol
          </button>
        </div>
      ) : (
        <WatchlistTable rows={visibleRows} onRemove={handleRemove} />
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
