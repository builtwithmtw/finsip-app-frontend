"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { DISPLAY, NUMERIC } from "@/utils/typography";
import { Panel } from "@/components/Panel";
import useLocalStorage from "@/hooks/useLocalStorage";

// Ten first: it is what keeps the card short enough that the page never grows a
// vertical scrollbar over a long list. The rest are there for when you'd rather read
// the whole watchlist in one go than page through it.
const PAGE_SIZES = [10, 15, 20, 50];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

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
    className={clsx("text-[13px] tabular-nums", value == null ? "text-slate-300" : "font-semibold text-slate-700")}
    title={title}
    style={NUMERIC}
  >
    {value == null ? "—" : format(value)}
  </span>
);

const ChangePill: React.FC<{ value: number | null }> = ({ value }) => {
  if (value == null) return <span className="text-[13px] text-slate-300" style={NUMERIC}>—</span>;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold leading-none tabular-nums",
        value > 0 && "bg-emerald-500/10 text-emerald-600",
        value < 0 && "bg-rose-500/10 text-rose-600",
        value === 0 && "text-slate-400",
      )}
      style={NUMERIC}
    >
      {value !== 0 && <span className="text-[8px]">{value > 0 ? "\u25B2" : "\u25BC"}</span>}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
};

const WatchlistTable: React.FC<Props> = ({ rows, onRemove }) => {
  // Opens on today's move, biggest gainer first — the watchlist is read to see what
  // is happening now, and the order it was added in says nothing about that. Every
  // load re-sorts against the day's fresh figures. Clicking the active column flips
  // direction; a new column starts ascending for text and descending for numbers.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: "d1", dir: "desc" });

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

  // Frontend pagination. The size is remembered across sessions, so the choice sticks
  // the way the sort does.
  const [storedPageSize, setPageSize] = useLocalStorage<number>("finsip:watchlist-page-size", DEFAULT_PAGE_SIZE);

  // Only the sizes that mean anything for this many rows: every size below the total,
  // then the total itself as the show-everything option. Thirteen rows offer 10 and 13,
  // not 10 and 15 -- a button promising fifteen rows that can only ever produce
  // thirteen is a number the table never shows.
  const sizeOptions = useMemo(
    () => [...PAGE_SIZES.filter((size) => size < sorted.length), sorted.length],
    [sorted.length],
  );

  // A remembered 50 outlives the list that earned it. While the list is short the
  // largest offered size stands in, and the preference comes back when it grows again.
  const pageSize = sizeOptions.includes(storedPageSize)
    ? storedPageSize
    : sizeOptions[sizeOptions.length - 1];
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Clamp back into range when the row count or sort shrinks the current page away.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  // Resizing keeps the row you were already looking at on screen, rather than throwing
  // you back to the top of a list you had paged into.
  const changePageSize = (size: number) => {
    setPage(Math.floor(start / size));
    setPageSize(size);
  };

  return (
    <Panel flush>
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
                      "whitespace-nowrap px-4 py-3",
                      col.align === "left" ? "text-left" : "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      style={DISPLAY}
                      className={clsx(
                        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-none",
                        "tracking-[0.18em] transition-colors hover:text-slate-900",
                        col.align === "right" && "flex-row-reverse",
                        active ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      {col.label}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ChevronsUpDown size={11} className="opacity-30" />
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
                className="group border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/70"
              >
                {/* The accent rail only paints on hover, so the resting table stays flat
                    and the pointer has something to track. */}
                <td className="relative px-4 py-2.5">
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <span
                    className="text-[13px] font-semibold uppercase tracking-tight text-slate-900"
                    style={DISPLAY}
                  >
                    {row.symbol}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-flex max-w-[10rem] truncate rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-slate-500"
                    title={row.sector}
                    style={DISPLAY}
                  >
                    {row.sector}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Num value={row.price} format={(v) => priceFormatter.format(v)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ChangePill value={row.d1} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Num
                    value={row.marketCap}
                    format={formatMarketCap}
                    title={row.marketCap == null ? undefined : `PKR ${Math.round(row.marketCap).toLocaleString("en-US")}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Num
                    value={row.volume}
                    format={formatVolume}
                    title={row.volume == null ? undefined : row.volume.toLocaleString("en-US")}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => onRemove(row.id, row.symbol)}
                    title={`Remove ${row.symbol} from watchlist`}
                    aria-label={`Remove ${row.symbol} from watchlist`}
                    className="rounded-md p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shown from the smallest page size up, not from the current one: at 50 a
          20-row list is a single page, and the bar is the only way back to 10. */}
      {sorted.length > DEFAULT_PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] tabular-nums text-slate-400" style={NUMERIC}>
              {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
            </span>

            {/* Sizes on one recessed track — the same segmented control the app uses
                everywhere it offers a small set of choices. */}
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/70 p-0.5">
              {sizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => changePageSize(size)}
                  aria-pressed={pageSize === size}
                  title={`${size} rows per page`}
                  style={NUMERIC}
                  className={clsx(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums transition-colors",
                    pageSize === size
                      ? "bg-white text-slate-900 shadow-[0_1px_2px_0_rgba(15,23,42,0.06)]"
                      : "text-slate-400 hover:text-slate-900"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-slate-400" style={NUMERIC}>
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-900/10 transition-colors enabled:hover:bg-slate-50 enabled:hover:text-slate-900 disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
              className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-900/10 transition-colors enabled:hover:bg-slate-50 enabled:hover:text-slate-900 disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
};

export default WatchlistTable;
