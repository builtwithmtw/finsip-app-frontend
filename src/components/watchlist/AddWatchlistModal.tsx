"use client";

import React, { useMemo, useState } from "react";
import { X, Search, Plus, Loader2 } from "lucide-react";
import type { Stock } from "@/lib/types";
import clsx from "clsx";
import { DISPLAY, NUMERIC } from "@/utils/typography";

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
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-32px_rgba(2,6,23,0.5)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent"
        />

        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h2
              className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
              style={DISPLAY}
            >
              Add to Watchlist
            </h2>
            <p
              className="mt-2 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
              style={DISPLAY}
            >
              Search a symbol or sector
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="group relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500">
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
              placeholder="Search symbol, e.g. MEBL"
              style={DISPLAY}
              className={clsx(
                "h-10 w-full rounded-xl border-0 bg-slate-100/70 pl-9 pr-3 uppercase",
                "text-[13px] font-semibold tracking-[-0.03em] text-slate-900 outline-none",
                "placeholder:font-semibold placeholder:tracking-[0.14em] placeholder:text-slate-400",
                "transition-all hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-sky-500/25",
              )}
            />
          </div>
        </div>

        <div className="min-h-[8rem] overflow-y-auto border-t border-slate-100 px-2 py-2 custom-scrollbar">
          {stocksLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-12 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
              style={DISPLAY}
            >
              <Loader2 size={14} className="animate-spin text-sky-500" />
              Loading PSX symbols
            </div>
          ) : matches.length === 0 ? (
            <p
              className="py-12 text-center text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
              style={DISPLAY}
            >
              {query.trim() ? "No matching symbols" : "Nothing left to add"}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {matches.map((s) => (
                <li key={s.ticker}>
                  <button
                    onClick={() => handleAdd(s)}
                    disabled={adding}
                    className={clsx(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-[13px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                        style={DISPLAY}
                      >
                        {s.ticker}
                      </span>
                      <span
                        className="mt-1.5 block truncate text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                        style={DISPLAY}
                      >
                        {s.sector}
                      </span>
                    </div>
                    <span
                      className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-500"
                      style={NUMERIC}
                    >
                      {s.price == null ? "—" : priceFormatter.format(s.price)}
                    </span>
                    <span className="shrink-0 text-slate-300 transition-colors group-hover:text-sky-600">
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
