"use client";

import React from "react";
import clsx from "clsx";
import { SkeletonBar } from "@/components/DashboardSkeleton";

// Mirrors WatchlistTable's columns so the shimmer sits exactly where the real
// values land — no spinner, no layout jump when the feed arrives.
const HEADERS: { label: string; align: "left" | "right" }[] = [
  { label: "Ticker", align: "left" },
  { label: "Sector", align: "left" },
  { label: "Price", align: "right" },
  { label: "1D", align: "right" },
  { label: "Mkt Cap", align: "right" },
  { label: "Volume", align: "right" },
];

// Per-column shimmer widths, roughly matching the real content's footprint.
const CELL_WIDTHS = ["w-14", "w-24", "w-12", "w-14", "w-16", "w-12"];

const WatchlistTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            {HEADERS.map((h) => (
              <th
                key={h.label}
                className={clsx(
                  "px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 whitespace-nowrap",
                  h.align === "left" ? "text-left" : "text-right",
                )}
              >
                {h.label}
              </th>
            ))}
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-slate-50 last:border-0">
              {CELL_WIDTHS.map((w, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBar
                    className={clsx("h-4", w, c >= 2 && "ml-auto")}
                  />
                </td>
              ))}
              <td className="px-4 py-3">
                <SkeletonBar className="h-6 w-6 rounded-md ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default WatchlistTableSkeleton;
