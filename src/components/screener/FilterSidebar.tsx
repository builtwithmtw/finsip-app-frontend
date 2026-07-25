"use client";

import { useState } from "react";
import { ChevronDown, Gem, Pin, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  BLUECHIP_MIN_MARKET_CAP,
  SECTORS,
  type Filters,
  type Sector,
} from "@/lib/types";
import { SECTOR_TICKERS } from "@/lib/seed";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  pinnedCount: number;
};

export function FilterSidebar({ filters, onChange, pinnedCount }: Props) {
  // The 25-row sector list is the whole sidebar's height. On desktop it sits in
  // a column beside the table and costs nothing; on mobile the sidebar stacks
  // above the table, so left open it would push the results a screenful down.
  // Collapsed by default there, always open from `lg` up.
  const [sectorsOpen, setSectorsOpen] = useState(false);

  function toggleSector(sector: Sector, checked: boolean) {
    const set = new Set(filters.sectors);
    if (checked) set.add(sector);
    else set.delete(sector);
    onChange({ ...filters, sectors: [...set] });
  }

  return (
    <aside className="w-full shrink-0 lg:w-96">
      <div className="flex flex-col rounded-xl border bg-card">
        {/* Shariah + Pinned + Blue chip toggles share one row */}
        <div className="flex items-stretch">
          <label className="flex flex-1 cursor-pointer select-none items-center gap-1 px-2 py-3 sm:gap-1.5 sm:px-2.5 sm:py-2.5">
            <ShieldCheck className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-xs font-medium sm:text-[13px]">
              Shariah
            </span>
            <Checkbox
              checked={filters.shariahOnly}
              onCheckedChange={(v) =>
                onChange({ ...filters, shariahOnly: v === true })
              }
            />
          </label>

          <Separator orientation="vertical" />

          <label
            className="flex flex-1 cursor-pointer select-none items-center gap-1 px-2 py-3 sm:gap-1.5 sm:px-2.5 sm:py-2.5"
            title={`Market cap over ${BLUECHIP_MIN_MARKET_CAP / 1e9}B PKR`}
          >
            <Gem className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-xs font-medium sm:text-[13px]">
              Blue chip
            </span>
            <Checkbox
              checked={filters.bluechipOnly}
              onCheckedChange={(v) =>
                onChange({ ...filters, bluechipOnly: v === true })
              }
            />
          </label>

          <Separator orientation="vertical" />

          {/* Inert until the user has pinned something */}
          <label
            className={cn(
              "flex flex-1 select-none items-center gap-1 px-2 py-3 sm:gap-1.5 sm:px-2.5 sm:py-2.5",
              pinnedCount === 0
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
            title="Show pinned tickers at the top of the table"
          >
            <Pin className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-xs font-medium sm:text-[13px]">
              Pinned
              {pinnedCount > 0 && (
                <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                  {pinnedCount}
                </span>
              )}
            </span>
            <Checkbox
              checked={filters.pinnedFirst}
              disabled={pinnedCount === 0}
              onCheckedChange={(v) =>
                onChange({ ...filters, pinnedFirst: v === true })
              }
            />
          </label>
        </div>

        <Separator />

        {/* Sectors */}
        <div className="p-2">
          {/* Mobile-only disclosure header. Hidden from `lg` up, where the list
              is always shown and a toggle would be dead weight. */}
          <button
            type="button"
            onClick={() => setSectorsOpen((v) => !v)}
            aria-expanded={sectorsOpen}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-accent lg:hidden"
          >
            <span className="flex-1">Sectors</span>
            {filters.sectors.length > 0 && (
              <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-brand">
                {filters.sectors.length}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                sectorsOpen && "rotate-180",
              )}
            />
          </button>

          <div
            className={cn(
              "grid grid-cols-1 gap-0.5",
              !sectorsOpen && "max-lg:hidden",
            )}
          >
            {SECTORS.map((sector) => {
              const checked = filters.sectors.includes(sector);
              return (
                <label
                  key={sector}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent lg:py-1.5",
                    checked && "bg-accent/60",
                  )}
                >
                  <Checkbox
                    className="mt-0.5 shrink-0 self-start"
                    checked={checked}
                    onCheckedChange={(v) => toggleSector(sector, v === true)}
                  />
                  {/* Wraps on narrow phones, where the longest sector name is
                      wider than the full-width sidebar; nowrap from `lg`. */}
                  <span className="flex-1 text-[13px] leading-snug lg:whitespace-nowrap">
                    {sector}
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {SECTOR_TICKERS[sector].length}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
