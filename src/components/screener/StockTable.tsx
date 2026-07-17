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
  // Default: sort by 1M performance descending (blanks sink to the bottom).
  const [sorting, setSorting] = useState<SortingState>([
    { id: "m1", desc: true },
  ]);
  const [search, setSearch] = useState("");

  const columns = useMemo<ColumnDef<Stock>[]>(() => {
    const perfColumn = (
      key: keyof Stock["perf"],
      header: string,
    ): ColumnDef<Stock> => ({
      id: key,
      // undefined (not null) so TanStack's sortUndefined can push blanks last.
      accessorFn: (row) => row.perf[key] ?? undefined,
      header,
      cell: (ctx) => <PerfPill value={ctx.getValue<number | undefined>()} />,
      sortDescFirst: true,
      sortUndefined: "last",
      meta: { align: "right" as const },
    });

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
        meta: { align: "center" as const, unsortable: true as const },
      },
      {
        id: "ticker",
        accessorKey: "ticker",
        header: "Ticker",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold">
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
            <span className="text-xs text-muted-foreground">
              {row.original.sector}
            </span>
          </div>
        ),
        meta: { align: "left" as const },
      },
      {
        id: "price",
        accessorFn: (row) => row.price ?? undefined,
        header: "Price",
        cell: (ctx) => {
          const price = ctx.getValue<number | undefined>();
          return (
            <span
              className={cn(
                "text-sm tabular-nums",
                price == null ? "text-muted-foreground" : "font-medium",
              )}
            >
              {price == null ? "—" : priceFormatter.format(price)}
            </span>
          );
        },
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "right" as const },
      },
      {
        id: "marketCap",
        accessorFn: (row) => row.marketCap ?? undefined,
        header: "Mkt Cap",
        cell: (ctx) => {
          const cap = ctx.getValue<number | undefined>();
          return (
            <span
              className={cn(
                "text-sm tabular-nums",
                cap == null ? "text-muted-foreground" : "font-medium",
              )}
              title={
                cap == null
                  ? undefined
                  : `PKR ${Math.round(cap).toLocaleString("en-US")}`
              }
            >
              {cap == null ? "—" : formatMarketCap(cap)}
            </span>
          );
        },
        sortDescFirst: true,
        sortUndefined: "last",
        meta: { align: "right" as const },
      },
      perfColumn("d1", "1D"),
      perfColumn("m1", "1M"),
      perfColumn("m6", "6M"),
      perfColumn("ytd", "YTD"),
      perfColumn("y5", "5Y"),
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

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as {
                    align?: string;
                    unsortable?: boolean;
                  };
                  const align = meta?.align ?? "left";
                  const sorted = header.column.getIsSorted();
                  if (meta?.unsortable) {
                    return <TableHead key={header.id} className="h-10 w-9" />;
                  }
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 whitespace-nowrap text-xs font-medium uppercase tracking-wide",
                        align === "right" && "text-right",
                      )}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
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
