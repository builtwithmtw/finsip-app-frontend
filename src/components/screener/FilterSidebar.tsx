"use client";

import { Gem, Pin, ShieldCheck } from "lucide-react";
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
          <label className="flex flex-1 cursor-pointer select-none items-center gap-1.5 px-2.5 py-2.5">
            <ShieldCheck className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-[13px] font-medium">Shariah</span>
            <Checkbox
              checked={filters.shariahOnly}
              onCheckedChange={(v) =>
                onChange({ ...filters, shariahOnly: v === true })
              }
            />
          </label>

          <Separator orientation="vertical" />

          <label
            className="flex flex-1 cursor-pointer select-none items-center gap-1.5 px-2.5 py-2.5"
            title={`Market cap over ${BLUECHIP_MIN_MARKET_CAP / 1e9}B PKR`}
          >
            <Gem className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-[13px] font-medium">Blue chip</span>
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
              "flex flex-1 select-none items-center gap-1.5 px-2.5 py-2.5",
              pinnedCount === 0
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
            title="Show pinned tickers at the top of the table"
          >
            <Pin className="size-4 shrink-0 text-brand" />
            <span className="flex-1 text-[13px] font-medium">
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

          <div className="grid grid-cols-1 gap-0.5">
            {SECTORS.map((sector) => {
              const checked = filters.sectors.includes(sector);
              return (
                <label
                  key={sector}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                    checked && "bg-accent/60",
                  )}
                >
                  <Checkbox
                    className="mt-0.5 shrink-0 self-start"
                    checked={checked}
                    onCheckedChange={(v) => toggleSector(sector, v === true)}
                  />
                  <span className="flex-1 whitespace-nowrap text-[13px] leading-snug">
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
