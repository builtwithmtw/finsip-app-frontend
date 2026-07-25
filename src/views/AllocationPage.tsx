"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, LineChart } from 'lucide-react';
import clsx from 'clsx';
import useLocalStorage from '../hooks/useLocalStorage';
import { usePortfolio } from '../context/PortfolioContext';
import { useIndexCompanies } from '../hooks/useIndexCompanies';
import { useAllocations, MAX_ALLOCATION_HOLDINGS, type AllocationInput, type AllocationRow } from '../hooks/useAllocations';
import AllocationTable from '../components/allocation/AllocationTable';

type AllocationView = 'KMI30' | 'MINE';

const VIEWS: Array<{ id: AllocationView; label: string }> = [
    { id: 'KMI30', label: 'KMI 30' },
    { id: 'MINE', label: 'My Symbols' },
];

const FeedError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
        <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
            Could not reach the market feed
        </p>
        <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 transition-colors"
        >
            <RefreshCw size={12} />
            Retry
        </button>
    </div>
);

const TableSkeleton: React.FC = () => (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex flex-col gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-slate-100 animate-pulse" />
        ))}
    </div>
);

/** KMI 30: weights come from the exchange, so the table is read-only. */
const IndexAllocationView: React.FC<{ investment: number }> = ({ investment }) => {
    const { companies, loading, error, refetch } = useIndexCompanies('KMI30');
    const allocation = useAllocations(companies, investment);

    if (loading && companies.length === 0) return <TableSkeleton />;

    return (
        <div className="flex flex-col gap-2">
            {error && <FeedError onRetry={refetch} />}
            <AllocationTable
                rows={allocation.results}
                summary={allocation}
                emptyMessage={error ? 'Feed unavailable' : 'No data available'}
            />
        </div>
    );
};

/**
 * The symbols already on the account -- the ones added from Overview -- with a weight
 * you set per symbol. Nothing is added or removed here; this tab only decides how the
 * money is split across what is already tracked.
 */
const MySymbolsView: React.FC<{ investment: number }> = ({ investment }) => {
    // Prices come from the feed the whole app already shares, so this table has
    // them the moment the page opens. The ALLSHR fetch below is only for logos
    // and is never waited on -- it used to gate the entire view behind a
    // skeleton, which hid symbols and weights that were already in memory.
    const { stocks, stocksLoading, setStockWeight, livePrices } = usePortfolio();
    const { companies, error, refetch } = useIndexCompanies('ALLSHR');

    // Raw input text per symbol, so a half-typed "1." or a cleared field survives the
    // round trip through Number() until the field is committed on blur.
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const rows: AllocationInput[] = useMemo(() => {
        const logos = new Map(companies.map((c) => [c.name, c.logo]));

        // Deliberately unsorted: these stay in the order set on Overview. Ranking by
        // weight here would make a row jump out from under the cursor mid-edit, and that
        // same order is what decides which symbols get funded.
        return stocks.map((s) => {
            const symbol = s.symbol.toUpperCase();
            return {
                id: s.id,
                name: symbol,
                logo: logos.get(symbol) ?? '',
                price: livePrices[symbol] ?? 0,
                weight: drafts[s.id] !== undefined ? Number(drafts[s.id]) || 0 : s.allocationWeight ?? 0,
            };
        });
    }, [stocks, companies, livePrices, drafts]);

    const allocation = useAllocations(rows, investment);

    const handleCommit = (row: AllocationRow) => {
        if (!row.id) return;

        const draft = drafts[row.id];
        if (draft === undefined) return;

        const parsed = Number(draft);
        // An empty or junk field means "no weight", which is a real state, not an error.
        const next = draft.trim() === '' || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;
        const current = stocks.find((s) => s.id === row.id)?.allocationWeight ?? null;

        setDrafts((prev) => {
            const { [row.id as string]: _dropped, ...rest } = prev;
            return rest;
        });

        if (next !== current) setStockWeight(row.id, next);
    };

    // Weights and prices need no gate -- they come from context that is already
    // populated, and logos arrive later and simply appear. The symbol list is the
    // one thing worth waiting on: until its query lands, an empty `stocks` means
    // "not here yet", not "none", and the two must not look the same.
    if (stocksLoading) return <TableSkeleton />;

    if (stocks.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-12 text-center">
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">No symbols yet</p>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5">
                    Add symbols from the Overview tab and they'll show up here.
                </p>
            </div>
        );
    }

    const unweighted = rows.every((r) => r.weight <= 0);
    const unpriced = rows.filter((r) => r.price <= 0).map((r) => r.name);

    return (
        <div className="flex flex-col gap-2">
            {error && <FeedError onRetry={refetch} />}

            <AllocationTable
                rows={allocation.results}
                summary={allocation}
                editableWeights
                weightValue={(row) => {
                    if (!row.id) return '';
                    const draft = drafts[row.id];
                    if (draft !== undefined) return draft;
                    const stored = stocks.find((s) => s.id === row.id)?.allocationWeight;
                    return stored == null ? '' : String(stored);
                }}
                onWeightChange={(row, value) => {
                    if (row.id) setDrafts((prev) => ({ ...prev, [row.id as string]: value }));
                }}
                onWeightCommit={handleCommit}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {unweighted && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Set a weight on a symbol to fund it
                    </p>
                )}
                {rows.length > MAX_ALLOCATION_HOLDINGS && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        First {MAX_ALLOCATION_HOLDINGS} are funded — reorder on Overview
                    </p>
                )}
                {unpriced.length > 0 && (
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        No live price: {unpriced.join(', ')}
                    </p>
                )}
                {/* Weights are relative, so a total that isn't 100 is fine -- normalization
                    handles it. Showing the sum just makes the split easier to reason about. */}
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-auto">
                    Weights are relative — they don't need to total 100
                </p>
            </div>
        </div>
    );
};

const AllocationPage: React.FC = () => {
    const [view, setView] = useLocalStorage<AllocationView>('finsip:allocation-view', 'KMI30');
    const [investment, setInvestment] = useLocalStorage<number>('finsip:allocation-investment', 100000);

    return (
        <div className="flex flex-col gap-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    {VIEWS.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            className={clsx(
                                'px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors',
                                view === v.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* Deciding what to hold is the step before deciding how much of
                        it to hold, and the screener is where that happens. */}
                    <Link
                        href="/screener"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm hover:text-slate-900 hover:border-slate-300 transition-colors"
                    >
                        <LineChart size={13} />
                        Screener
                    </Link>

                    <label className="flex items-center gap-2 bg-slate-900 rounded-lg pl-3 pr-1.5 py-1.5 shadow-sm">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invest</span>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            value={investment}
                            // An empty field parses to NaN and would blank the whole table.
                            onChange={(e) => setInvestment(Number(e.target.value) || 0)}
                            onFocus={(e) => e.currentTarget.select()}
                            className="no-spinner w-24 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs font-black text-white tabular-nums text-right outline-none transition-colors hover:bg-white/10 focus:border-blue-400 focus:bg-white/10"
                        />
                    </label>
                </div>
            </div>

            {view === 'MINE' ? <MySymbolsView investment={investment} /> : <IndexAllocationView investment={investment} />}
        </div>
    );
};

export default AllocationPage;