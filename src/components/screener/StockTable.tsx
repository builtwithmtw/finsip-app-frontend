"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type FilterFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Pin,
  Search,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Stock } from "@/lib/types";

type Props = {
  data: Stock[];
  isLoading: boolean;
  // Show the 🕌 marker on Shariah tickers only when the Shariah filter is off
  // (when it's on, every row is Shariah, so the marker would be redundant).
  showShariahBadge: boolean;
  pinned: Set<string>;
  /** When on, pinned rows float to the top; when off, they sort like any other row. */
  pinnedFirst: boolean;
  onTogglePin: (ticker: string) => void;
};

// Pinned rows float to the top of whatever the user sorted by, so this sort
// descriptor is applied ahead of their sorting state rather than living in it
// (it isn't theirs to toggle from the column headers).
const PINNED_SORT = { id: "pinned", desc: true } as const;

// Fixed row height (px) — matches the `h-14` on every row so partial pages and
// empty states can reserve exactly a full page's height.
const ROW_HEIGHT = 56;

function formatPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const priceFormatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 0,
});

// Market caps are large, so abbreviate rather than print 13 digits: 1.44T,
// 989B, 45M. Trillions keep 2 decimals — rounding them whole would collapse
// every mega cap to "1T" — while B and M read as round numbers.
function formatMarketCap(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  const [divisor, suffix] = v >= 1e9 ? [1e9, "B"] : [1e6, "M"];
  return `${Math.round(v / divisor).toLocaleString("en-US")}${suffix}`;
}

// Share counts run to nine figures, so abbreviate on the same principle as
// market cap. Under 1000 prints as-is rather than "0M".
function formatVolume(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return v.toLocaleString("en-US");
}

/**
 * A numeric cell that falls back to "—". Price, 1Y high/low and volume differ
 * only in how they format, so they share this rather than repeating the
 * null-handling and class list four times.
 */
function NumCell({
  value,
  format,
  title,
}: {
  value: number | undefined;
  format: (v: number) => string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        value == null ? "text-muted-foreground" : "font-medium",
      )}
      title={title}
    >
      {value == null ? "—" : format(value)}
    </span>
  );
}

function PerfPill({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <span className="inline-block min-w-17 text-right text-sm text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-block min-w-17 rounded-md px-2 py-0.5 text-right text-sm font-medium tabular-nums",
        value > 0 && "bg-gain-soft text-gain",
        value < 0 && "bg-loss-soft text-loss",
        value === 0 && "text-muted-foreground",
      )}
    >
      {formatPct(value)}
    </span>
  );
}

// Frontend-only search: match on ticker or sector, case-insensitive.
const searchFilter: FilterFn<Stock> = (row, _columnId, value: string) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  const s = row.original;
  return (
    s.ticker.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q)
  );
};

export function StockTable({
  data,
  isLoading,
  showShariahBadge,
  pinned,
  pinnedFirst,
  onTogglePin,
}: Props) {
  // Default: largest companies first. This was "m1" until the 1M column went
  // away with the EOD feed -- a sort id with no matching column is ignored
  // silently by TanStack, so the table would have loaded in seed order.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "marketCap", desc: true },
  ]);
  const [search, setSearch] = useState("");

  const columns = useMemo<ColumnDef<Stock>[]>(() => {
    return [
      {
        id: "pinned",
        accessorFn: (row) => (pinned.has(row.ticker) ? 1 : 0),
        header: "",
        cell: ({ row }) => {
          const isPinned = pinned.has(row.original.ticker);
          return (
            <button
              type="button"
              onClick={() => onTogglePin(row.original.ticker)}
              title={isPinned ? "Unpin ticker" : "Pin ticker"}
              aria-label={isPinned ? "Unpin ticker" : "Pin ticker"}
              aria-pressed={isPinned}
              className="inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-accent"
            >
              <Pin
                className={cn(
                  "size-4 transition-colors",
                  isPinned
                    ? "fill-brand text-brand"
                    : "text-muted-foreground/40 hover:text-muted-foreground",
                )}
              />
            </button>
          );
        },
        enableGlobalFilter: false,
        meta: { align: "center" as const, unsortable: true as const, width: "5%" },
      },
      {
        id: "ticker",
        accessorKey: "ticker",
        header: "Ticker",
        // Widths are percentages, not pixels, so the table always fits its
        // container exactly -- no horizontal scrollbar at any viewport. What
        // matters for layout stability is that they're declared at all: under
        // `table-fixed` the column stops resizing when a filter changes which
        // tickers and sectors are on screen.
        meta: { align: "left" as const, width: "25%" },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">
              {row.original.ticker}
              {row.original.isShariah && showShariahBadge && (
                <span
                  className="ml-1.5"
                  title="Shariah compliant"
                  aria-label="Shariah compliant"
                >
                  🕌
                </span>
              )}
            </span>
            {/* Longest sector runs past the column, so it clips with an
                ellipsis and carries the full string as a tooltip. */}
            <span
              className="truncate text-xs text-muted-foreground"
              title={row.original.sector}
            >
              {row.original.sector}
            </span>
          </div>
        ),
      },
      {
        id: "price",
        accessorFn: (row) => row.price ?? undefined,
        header: "Price",
        cell: (ctx) => (
          <NumCell
            value={ctx.getValue<number | undefined>()}
            format={(v) => priceFormatter.format(v)}
          />
        ),
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "center" as const, width: "11%" },
      },
      {
        id: "marketCap",
        accessorFn: (row) => row.marketCap ?? undefined,
        header: "Mkt Cap",
        cell: (ctx) => {
          const cap = ctx.getValue<number | undefined>();
          return (
            <NumCell
              value={cap}
              format={formatMarketCap}
              title={
                cap == null
                  ? undefined
                  : `PKR ${Math.round(cap).toLocaleString("en-US")}`
              }
            />
          );
        },
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "center" as const, width: "13%" },
      },
      {
        id: "d1",
        // undefined (not null) so TanStack's sortUndefined can push blanks
        // last. Must stay `??` and not `||`: a flat day is 0.00%, which is a
        // real reading, and `||` would demote it to a blank.
        accessorFn: (row) => row.d1 ?? undefined,
        header: "1D",
        cell: (ctx) => <PerfPill value={ctx.getValue<number | undefined>()} />,
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "center" as const, width: "11%" },
      },
      {
        id: "high52",
        accessorFn: (row) => row.high52 ?? undefined,
        header: "1Y High",
        cell: (ctx) => (
          <NumCell
            value={ctx.getValue<number | undefined>()}
            format={(v) => priceFormatter.format(v)}
          />
        ),
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "center" as const, width: "11%" },
      },
      {
        id: "low52",
        accessorFn: (row) => row.low52 ?? undefined,
        header: "1Y Low",
        cell: (ctx) => (
          <NumCell
            value={ctx.getValue<number | undefined>()}
            format={(v) => priceFormatter.format(v)}
          />
        ),
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "center" as const, width: "11%" },
      },
      {
        id: "volume",
        accessorFn: (row) => row.volume ?? undefined,
        header: "Volume",
        cell: (ctx) => {
          const vol = ctx.getValue<number | undefined>();
          return (
            <NumCell
              value={vol}
              format={formatVolume}
              title={vol == null ? undefined : vol.toLocaleString("en-US")}
            />
          );
        },
        sortDescFirst: true,
        sortUndefined: "last",
        // Deliberately has no width: as the only unsized column it absorbs the
        // remaining 10%, so the declared percentages never have to sum to
        // exactly 100 by hand.
        meta: { align: "center" as const },
      },
    ];
  }, [showShariahBadge, pinned, onTogglePin]);

  // Must be memoized: TanStack keys its row-model memos on this array's
  // identity, and a fresh one each render would re-run them, re-trigger
  // autoResetPageIndex, and loop forever.
  const effectiveSorting = useMemo<SortingState>(
    () => (pinnedFirst ? [PINNED_SORT, ...sorting] : sorting),
    [pinnedFirst, sorting],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting: effectiveSorting, globalFilter: search },
    // The pinned sort is implicit, so strip it back out before it reaches the
    // user's sorting state — otherwise it would accumulate on every toggle.
    onSortingChange: (updater) =>
      setSorting((prev) => {
        const next =
          typeof updater === "function"
            ? updater(pinnedFirst ? [PINNED_SORT, ...prev] : prev)
            : updater;
        return next.filter((s) => s.id !== PINNED_SORT.id);
      }),
    onGlobalFilterChange: setSearch,
    globalFilterFn: searchFilter,
    initialState: { pagination: { pageSize: 12 } },
    autoResetPageIndex: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card max-lg:min-h-128">
      {/* Indeterminate loading bar while the PSX data is being fetched. */}
      {isLoading && (
        <div
          className="h-0.5 w-full overflow-hidden bg-brand/15"
          role="progressbar"
          aria-label="Loading stock data"
        >
          <div className="h-full w-1/3 animate-progress rounded-full bg-brand" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker or sector…"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
          {isLoading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Loading PSX data…
            </>
          ) : (
            `${totalRows} tickers`
          )}
        </span>
      </div>

      {/* overflow-hidden, not auto: the page size is fixed and every row is a
          fixed height, so the body is sized to hold exactly one page and has
          nothing to scroll. Clipping rather than scrolling guarantees neither
          scrollbar can appear. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* table-fixed: column widths come from the header row's declared
            percentages rather than from cell content, so filtering, searching
            or a long sector name can no longer resize the columns. No min-w --
            the table is always exactly its container's width, which is what
            keeps a horizontal scrollbar off the page. */}
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as {
                    align?: string;
                    unsortable?: boolean;
                    width?: string;
                  };
                  const align = meta?.align ?? "left";
                  const sorted = header.column.getIsSorted();
                  // Only the header row carries widths -- under table-fixed the
                  // body inherits them. The declared percentages total 90, and
                  // the one column without a width (Volume) takes the rest, so
                  // the table always sums to exactly 100% of its container.
                  const width = meta?.width ? { width: meta.width } : undefined;
                  if (meta?.unsortable) {
                    return (
                      <TableHead key={header.id} className="h-10" style={width} />
                    );
                  }
                  return (
                    <TableHead
                      key={header.id}
                      style={width}
                      className={cn(
                        "h-10 whitespace-nowrap text-xs font-medium uppercase tracking-wide",
                        align === "right" && "text-right",
                        // The sort button is inline-flex, so text-align on the
                        // cell is what actually centres it.
                        align === "center" && "text-center",
                      )}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                          // Right-aligned headers put the caret on the left so
                          // it never sits between the label and the cell edge.
                          align === "right" && "flex-row-reverse",
                          sorted && "text-foreground",
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} className="h-14">
                  {table.getAllLeafColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  // Match a full page's height so an empty result doesn't shift layout.
                  style={{ height: pageSize * ROW_HEIGHT }}
                  className="text-center text-sm text-muted-foreground"
                >
                  No tickers match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="h-14 odd:bg-muted/20 hover:bg-accent/60"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const align =
                        (cell.column.columnDef.meta as { align?: string })
                          ?.align ?? "left";
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "whitespace-nowrap py-2.5",
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {/* Pad the last/partial page so table height stays constant. */}
                {Array.from({ length: pageSize - rows.length }).map((_, i) => (
                  <TableRow
                    key={`filler-${i}`}
                    className="h-14 hover:bg-transparent"
                    aria-hidden="true"
                  >
                    <TableCell colSpan={columns.length} />
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — always mounted so it never appears/disappears (no shift). */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t px-4 py-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalRows === 0 ? 0 : pageIndex * pageSize + 1}–
            {Math.min((pageIndex + 1) * pageSize, totalRows)} of {totalRows}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
              className="inline-flex size-6 items-center justify-center rounded-md border transition-colors enabled:hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
              className="inline-flex size-6 items-center justify-center rounded-md border transition-colors enabled:hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
