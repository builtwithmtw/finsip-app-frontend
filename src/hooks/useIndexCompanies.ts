"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProxy } from '../context/ProxyContext';
import type { IndexCompany } from '../types';

export type MarketIndex = 'KMI30' | 'ALLSHR';

const FEED_LIMITS: Record<MarketIndex, number> = {
    KMI30: 100,
    // The whole market: the price and logo source for the user's own symbols.
    ALLSHR: 1000,
};

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Module-level so that flipping between the allocation sub-tabs re-renders instantly
 * instead of re-fetching a feed that was already pulled seconds ago. Survives unmount,
 * not reload.
 */
const cache = new Map<MarketIndex, { at: number; companies: IndexCompany[] }>();

interface FeedRow {
    symbol?: string;
    weights?: number | string;
    curr?: number | string;
    logo?: string;
    sector_name?: string;
    company_name?: string;
}

const parseFeed = (json: unknown): FeedRow[] => {
    const data = (json as { response?: { data?: unknown } })?.response?.data;
    return Array.isArray(data) ? (data as FeedRow[]) : [];
};

const toCompany = (row: FeedRow): IndexCompany => ({
    name: (row.symbol ?? '').toString().toUpperCase().trim(),
    weight: Number(row.weights ?? 0) || 0,
    price: Number(row.curr ?? 0) || 0,
    logo: row.logo ?? '',
    sector: row.sector_name ?? 'Unknown',
    companyName: row.company_name ?? '',
});

/**
 * Companies of a PSX index, with their index weight and last price.
 *
 * Index feeds come back heaviest-first (that ordering is what the allocation engine
 * funds); ALLSHR comes back alphabetically, since it is only ever searched by symbol.
 */
export function useIndexCompanies(index: MarketIndex) {
    const { selectedProxy } = useProxy();
    const [companies, setCompanies] = useState<IndexCompany[]>(() => cache.get(index)?.companies ?? []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Guards against a slow response for a sub-tab the user has already left landing in
    // the newly selected tab's state.
    const requestRef = useRef(0);

    const load = useCallback(async (force = false) => {
        const requestId = ++requestRef.current;
        const isCurrent = () => requestRef.current === requestId;

        const cached = cache.get(index);
        if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
            setCompanies(cached.companies);
            setError(null);
            setLoading(false);
            return;
        }

        // The gateway list loads from Supabase; until it arrives there is nothing to
        // fetch through. The effect re-runs when it lands.
        if (!selectedProxy.url) return;

        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const targetUrl = `https://beta-restapi.sarmaaya.pk/api/indices/${index}/companies?page=1&limit=${FEED_LIMITS[index]}`;
            const response = await fetch(selectedProxy.url + encodeURIComponent(targetUrl), {
                signal: controller.signal,
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const rows = parseFeed(await response.json());
            if (!rows.length) throw new Error('Empty response from the market feed');

            const formatted = rows
                .map(toCompany)
                .filter((c) => c.name)
                .sort((a, b) => (index === 'ALLSHR' ? a.name.localeCompare(b.name) : b.weight - a.weight));

            cache.set(index, { at: Date.now(), companies: formatted });
            if (isCurrent()) setCompanies(formatted);
        } catch (err) {
            console.error(`[useIndexCompanies] ${index} fetch failed:`, err);
            if (isCurrent()) {
                setError(err instanceof Error ? err : new Error(String(err)));
                // Stale data beats an empty table; only blank it out if we never had any.
                if (!cache.has(index)) setCompanies([]);
            }
        } finally {
            clearTimeout(timeout);
            if (isCurrent()) setLoading(false);
        }
    }, [index, selectedProxy.url]);

    useEffect(() => {
        load();
    }, [load]);

    return { companies, loading, error, refetch: () => load(true) };
}