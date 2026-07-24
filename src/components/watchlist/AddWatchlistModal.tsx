"use client";

import React, { useMemo, useState } from "react";
import { X, Search, Plus, Loader2 } from "lucide-react";
import type { Stock } from "@/lib/types";
import clsx from "clsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The live PSX universe, used both as the pickable list and the price preview. */
  stocks: Stock[];
  stocksLoading: boolean;
  /** Symbols already on the watchlist — hidden from the picker. */
  existing: Set<string>;
  adding: boolean;
  onAdd: (symbol: string, sector: string | null) => Promise<boolean>;
}

const priceFormatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/**
 * Picks a symbol from the live universe rather than taking free text, so every
 * watchlist row is guaranteed a sector and a price. Filtering is client-side on
 * ticker or sector.
 */
const AddWatchlistModal: React.FC<Props> = ({
  isOpen,
  onClose,
  stocks,
  stocksLoading,
  existing,
  adding,
  onAdd,
}) => {
  const [query, setQuery] = useState("");
  // Which row's add is in flight, so only that row shows a spinner.
  const [pending, setPending] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks
      .filter((s) => !existing.has(s.ticker.toUpperCase()))
      .filter(
        (s) =>
          !q ||
          s.ticker.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [stocks, existing, query]);

  if (!isOpen) return null;

  const handleAdd = async (s: Stock) => {
    setPending(s.ticker);
    // Deliberately stays open on success: the just-added symbol drops out of the
    // list (it's now in `existing`), which is the feedback, so several can be
    // added in one sitting. The user closes with the X when done.
    await onAdd(s.ticker, s.sector);
    setPending(null);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Add to Watchlist
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Search a PSX symbol or sector, then tap to track it.
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="shrink-0 -mr-2 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-3">
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <Search size={14} />
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the top result, so a full type-and-hit-Enter never
                // needs the mouse. No-op while a request is already in flight.
                if (e.key === "Enter" && matches.length > 0 && !adding) {
                  e.preventDefault();
                  handleAdd(matches[0]);
                }
              }}
              placeholder="SEARCH SYMBOL, E.G. MEBL"
              className="w-full h-10 bg-slate-50 border-0 rounded-md pl-9 pr-3 text-slate-900 text-sm font-black placeholder:text-slate-300 placeholder:font-bold focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all uppercase"
            />
          </div>
        </div>

        <div className="px-3 pb-4 overflow-y-auto custom-scrollbar min-h-[8rem]">
          {stocksLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm font-semibold">
              <Loader2 size={16} className="animate-spin" />
              Loading PSX symbols…
            </div>
          ) : matches.length === 0 ? (
            <p className="text-center text-sm font-medium text-slate-400 py-12">
              {query.trim() ? "No matching symbols." : "Nothing left to add."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {matches.map((s) => (
                <li key={s.ticker}>
                  <button
                    onClick={() => handleAdd(s)}
                    disabled={adding}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group",
                      "hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-black text-slate-900 uppercase">
                        {s.ticker}
                      </span>
                      <span className="block truncate text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {s.sector}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-500 tabular-nums shrink-0">
                      {s.price == null ? "—" : `Rs ${priceFormatter.format(s.price)}`}
                    </span>
                    <span className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors">
                      {pending === s.ticker ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Plus size={16} />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddWatchlistModal;
