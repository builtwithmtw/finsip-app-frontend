"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, ChevronsUpDown, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { DISPLAY, NUMERIC } from "@/utils/typography";
import { Panel } from "@/components/Panel";

/** Offered smallest-first; the list's own total is appended as the "everything" pick. */
const PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

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
  // Opens on 1D, biggest move first — the watchlist is read to see what moved
  // today, and insertion order answered a question nobody was asking. Symbols the
  // feed has no reading for sink to the bottom (see `sorted`), so a stale ticker
  // never takes the top row. Any header still re-sorts: clicking the active column
  // flips direction, a new column starts ascending for text and descending for
  // numbers (largest-first reads best).
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

  // Frontend pagination — keeps the card short so the page never grows a vertical
  // scrollbar over a long list. Always opens on 10: a size picked once shouldn't
  // decide how tall the card is every session afterwards, so the choice lasts for
  // the visit rather than being remembered.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const total = sorted.length;

  // Never offer a size the list can't fill: options stop below the total and the
  // total itself closes the list, so 15 saved symbols offer "10" and "15" rather
  // than a "50" that would show the same 15 rows and read as a bigger list.
  const sizeOptions = useMemo(() => {
    const opts = PAGE_SIZE_OPTIONS.filter((n) => n < total);
    opts.push(total);
    return opts;
  }, [total]);

  // A remembered size can outrun a list that has since shrunk, so it's clamped on
  // the way out — which also keeps the select's value on one of its own options.
  const size = Math.min(pageSize, total) || PAGE_SIZE_OPTIONS[0];
  const pageCount = Math.max(1, Math.ceil(total / size));

  // Clamp back into range when the row count, sort, or page size shrinks the
  // current page away.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * size;
  const pageRows = sorted.slice(start, start + size);

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
                    className="text-[13px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
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

      {/* The footer earns its place as soon as the list outgrows the smallest page
          size, even when the reader has since chosen to show everything — that's
          where the size control lives. */}
      {total > PAGE_SIZE_OPTIONS[0] && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-100 px-4 py-2.5">
          {/* Always counted against the full list, never against the page. The word
              sits in the text face and only the figures are mono -- same split as
              every other label-plus-figure pairing in the app. */}
          <span className="text-[11px] text-slate-400" style={DISPLAY}>
            <span className="tabular-nums" style={NUMERIC}>
              {start + 1}–{Math.min(start + size, total)}
            </span>{" "}
            of{" "}
            <span className="tabular-nums" style={NUMERIC}>
              {total}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400 max-sm:sr-only"
                style={DISPLAY}
              >
                Rows
              </span>
              {/* appearance-none plus our own chevron: the native arrow is drawn
                  inside the box and crowds the figure at this size. */}
              <span className="relative flex items-center">
                <select
                  value={size}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  aria-label="Rows per page"
                  style={NUMERIC}
                  // `border-0 py-0 leading-none` undoes @tailwindcss/forms, which gives
                  // every select a 1px border and a 40px line box -- that's why the
                  // app's other selects are h-10. This one has to match the size-7
                  // pager buttons beside it, so the plugin's metrics come off first.
                  className="h-7 cursor-pointer appearance-none rounded-lg border-0 bg-white py-0 pl-2.5 pr-6 text-[11px] font-semibold leading-none tabular-nums text-slate-500 outline-none ring-1 ring-slate-900/10 transition-colors hover:text-slate-900"
                >
                  {sizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-1.5 text-slate-400"
                />
              </span>
            </label>

            <span className="text-[11px] text-slate-400" style={DISPLAY}>
              Page{" "}
              <span className="tabular-nums" style={NUMERIC}>
                {page + 1}
              </span>{" "}
              of{" "}
              <span className="tabular-nums" style={NUMERIC}>
                {pageCount}
              </span>
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
