"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStocks } from "@/lib/api";

export function useStocks() {
  return useQuery({
    queryKey: ["stocks"],
    queryFn: fetchStocks,
    staleTime: 60_000,
  });
}
