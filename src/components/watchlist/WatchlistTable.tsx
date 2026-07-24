"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const PAGE_SIZE = 10;

export interface WatchlistRow {
  id: string;
  symbol: string;
  sector: string;
  price: number | null;
  d1: number | null;
  marketCap: number | null;
  volume: number | null;
}

interface Props {
  rows: WatchlistRow[];
  onRemove: (id: string, symbol: string) => void;
}

type SortKey = "symbol" | "sector" | "price" | "d1" | "marketCap" | "volume";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; numeric: boolean }[] = [
  { key: "symbol", label: "Ticker", align: "left", numeric: false },
  { key: "sector", label: "Sector", align: "left", numeric: false },
  { key: "price", label: "Price", align: "right", numeric: true },
  { key: "d1", label: "1D", align: "right", numeric: true },
  { key: "marketCap", label: "Mkt Cap", align: "right", numeric: true },
  { key: "volume", label: "Volume", align: "right", numeric: true },
];

const priceFormatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function formatMarketCap(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  const [divisor, suffix] = v >= 1e9 ? [1e9, "B"] : [1e6, "M"];
  return `${Math.round(v / divisor).toLocaleString("en-US")}${suffix}`;
}

function formatVolume(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return v.toLocaleString("en-US");
}

/** A numeric cell that falls back to "—" when the feed has no reading. */
const Num: React.FC<{ value: number | null; format: (v: number) => string; title?: string }> = ({
  value,
  format,
  title,
}) => (
  <span
    className={clsx("text-sm tabular-nums", value == null ? "text-slate-300" : "font-semibold text-slate-800")}
    title={title}
  >
    {value == null ? "—" : format(value)}
  </span>
);

const ChangePill: React.FC<{ value: number | null }> = ({ value }) => {
  if (value == null) return <span className="text-sm text-slate-300">—</span>;
  return (
    <span
      className={clsx(
        "inline-block rounded-md px-2 py-0.5 text-sm font-bold tabular-nums",
        value > 0 && "bg-emerald-500/10 text-emerald-600",
        value < 0 && "bg-rose-500/10 text-rose-600",
        value === 0 && "text-slate-400",
      )}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
};

const WatchlistTable: React.FC<Props> = ({ rows, onRemove }) => {
  // No sort by default — rows stay in the order they were added until a header
  // is clicked. Clicking the active column flips direction; a new column starts
  // ascending for text and descending for numbers (largest-first reads best).
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const toggleSort = (col: (typeof COLUMNS)[number]) => {
    setSort((prev) =>
      prev?.key === col.key
        ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: col.key, dir: col.numeric ? "desc" : "asc" },
    );
  };

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // Missing readings always sink to the bottom, whichever way we're sorting.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return cmp * factor;
    });
  }, [rows, sort]);

  // Frontend pagination, 10 rows a page — keeps the card short so the page never
  // grows a vertical scrollbar over a long list.
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  // Clamp back into range when the row count or sort shrinks the current page away.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {COLUMNS.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                      col.align === "left" ? "text-left" : "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className={clsx(
                        "inline-flex items-center gap-1 transition-colors hover:text-slate-700",
                        col.align === "right" && "flex-row-reverse",
                        active ? "text-blue-600" : "text-slate-400",
                      )}
                    >
                      {col.label}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-black text-slate-900 uppercase">{row.symbol}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold text-slate-500 truncate" title={row.sector}>
                    {row.sector}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Num value={row.price} format={(v) => priceFormatter.format(v)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ChangePill value={row.d1} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Num
                    value={row.marketCap}
                    format={formatMarketCap}
                    title={row.marketCap == null ? undefined : `PKR ${Math.round(row.marketCap).toLocaleString("en-US")}`}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Num
                    value={row.volume}
                    format={formatVolume}
                    title={row.volume == null ? undefined : row.volume.toLocaleString("en-US")}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onRemove(row.id, row.symbol)}
                    title={`Remove ${row.symbol} from watchlist`}
                    aria-label={`Remove ${row.symbol} from watchlist`}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors enabled:hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
              className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors enabled:hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistTable;
