"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, LineChart, Scale } from 'lucide-react';
import clsx from 'clsx';
import useLocalStorage from '../hooks/useLocalStorage';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { useIndexCompanies } from '../hooks/useIndexCompanies';
import { useAllocations, MAX_ALLOCATION_HOLDINGS, type AllocationInput, type AllocationRow } from '../hooks/useAllocations';
import AllocationTable from '../components/allocation/AllocationTable';
import CurrentAllocationTable, { type CurrentAllocationRow } from '../components/allocation/CurrentAllocationTable';
import RebalanceTable from '../components/allocation/RebalanceTable';
import { computeLiveHoldings } from '../utils/holdings';
import { masterRankOf } from '../utils/masterOrder';
import { computeRebalance } from '../utils/rebalance';
import { DISPLAY, NUMERIC } from '../utils/typography';

type AllocationView = 'KMI30' | 'MINE' | 'CURRENT';

const VIEWS: Array<{ id: AllocationView; label: string }> = [
    { id: 'KMI30', label: 'KMI 30' },
    { id: 'MINE', label: 'My Symbols' },
    { id: 'CURRENT', label: 'Current Allocation' },
];

// Footnotes under the table: same micro-label voice, only the colour changes.
const NOTE = 'text-[10px] font-semibold uppercase tracking-[0.16em]';

const FeedError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2.5 text-amber-700 ring-1 ring-amber-500/15">
        <p className={NOTE} style={DISPLAY}>
            Could not reach the market feed
        </p>
        <button
            onClick={onRetry}
            style={DISPLAY}
            className={clsx(NOTE, 'flex items-center gap-1.5 transition-colors hover:text-amber-900')}
        >
            <RefreshCw size={12} />
            Retry
        </button>
    </div>
);

const TableSkeleton: React.FC = () => (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-white p-3 ring-1 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-slate-100" />
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
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p
                    className="text-[15px] font-semibold uppercase leading-none tracking-[0.02em] text-slate-900"
                    style={DISPLAY}
                >
                    No symbols yet
                </p>
                <p className="mt-3 text-xs font-medium text-slate-400">
                    Add symbols from the Overview tab and they&apos;ll show up here.
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

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                {unweighted && (
                    <p className={clsx(NOTE, 'text-slate-500')} style={DISPLAY}>
                        Set a weight on a symbol to fund it
                    </p>
                )}
                {rows.length > MAX_ALLOCATION_HOLDINGS && (
                    <p className={clsx(NOTE, 'text-slate-500')} style={DISPLAY}>
                        First {MAX_ALLOCATION_HOLDINGS} are funded — reorder on Overview
                    </p>
                )}
                {unpriced.length > 0 && (
                    <p className={clsx(NOTE, 'flex items-center gap-1.5 text-amber-600')} style={DISPLAY}>
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        No live price: {unpriced.join(', ')}
                    </p>
                )}
                {/* Weights are relative, so a total that isn't 100 is fine -- normalization
                    handles it. Showing the sum just makes the split easier to reason about. */}
                <p className={clsx(NOTE, 'ml-auto text-slate-300')} style={DISPLAY}>
                    Weights are relative — they don&apos;t need to total 100
                </p>
            </div>
        </div>
    );
};

/**
 * What the portfolio actually looks like right now: the split it was bought at,
 * the split the market has since made of it, and the drift between the two.
 * Nothing here depends on the investment amount -- it reads the ledger, not a plan.
 */
const CurrentAllocationView: React.FC<{ rebalancing: boolean }> = ({ rebalancing }) => {
    const { transactions, transactionsLoading, livePrices, stocks } = usePortfolio();
    const { companies } = useIndexCompanies('ALLSHR');
    const currency = useCurrency();

    const logos = useMemo(
        () => new Map(companies.map((c) => [c.name, c.logo])),
        [companies]
    );

    const holdings = useMemo(
        () => computeLiveHoldings(transactions, livePrices),
        [transactions, livePrices]
    );

    // The plan to rebalance onto is exactly what My Symbols funds -- the same leading
    // slice in the same Overview order -- so the two tabs can't disagree about the target.
    const plan = useMemo(
        () =>
            computeRebalance(
                holdings,
                stocks.slice(0, MAX_ALLOCATION_HOLDINGS).map((s) => ({
                    symbol: s.symbol.toUpperCase(),
                    weight: s.allocationWeight ?? 0,
                })),
                livePrices,
                logos
            ),
        [holdings, stocks, livePrices, logos]
    );

    const rows: CurrentAllocationRow[] = useMemo(() => {
        const rankOf = masterRankOf(stocks);

        const totalCost = holdings.reduce((sum, h) => sum + h.totalCostBasis, 0);
        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        return holdings
            .map((h) => {
                const investedShare = totalCost > 0 ? (h.totalCostBasis / totalCost) * 100 : 0;
                const marketShare = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;

                return {
                    symbol: h.symbol,
                    logo: logos.get(h.symbol.toUpperCase()) ?? '',
                    investedShare,
                    marketShare,
                    difference: marketShare - investedShare,
                    isPriced: h.isPriced,
                };
            })
            // Asset Master List order, the same one Overview sets and Live Portfolio
            // reads. Sorting by drift here would reshuffle the table on every price
            // tick, and a position would never be twice in the same place.
            .sort((a, b) => rankOf(a.symbol) - rankOf(b.symbol));
    }, [holdings, logos, stocks]);

    if (transactionsLoading) return <TableSkeleton />;

    return (
        <div className="flex flex-col gap-2">
            {rebalancing && rows.length > 0 ? (
                plan.unweighted ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                        <p
                            className="text-[15px] font-semibold uppercase leading-none tracking-[0.02em] text-slate-900"
                            style={DISPLAY}
                        >
                            No target weights
                        </p>
                        <p className="mt-3 text-xs font-medium text-slate-400">
                            Set a weight on the My Symbols tab — that&apos;s the allocation this
                            rebalances back onto.
                        </p>
                    </div>
                ) : (
                    <>
                        <RebalanceTable plan={plan} />

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                            {plan.cashLeft >= 1 && (
                                <p className={clsx(NOTE, 'text-slate-500')} style={DISPLAY}>
                                    Cash left over: {currency(plan.cashLeft)}
                                </p>
                            )}
                            {plan.unpriced.length > 0 && (
                                <p className={clsx(NOTE, 'flex items-center gap-1.5 text-amber-600')} style={DISPLAY}>
                                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Not traded, no live price: {plan.unpriced.join(', ')}
                                </p>
                            )}
                            <p className={clsx(NOTE, 'ml-auto text-slate-300')} style={DISPLAY}>
                                Sales fund the buys — whole shares only
                            </p>
                        </div>
                    </>
                )
            ) : (
                <>
                    <CurrentAllocationTable rows={rows} emptyMessage="No holdings yet" />

                    {rows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                            <p className={clsx(NOTE, 'ml-auto text-slate-300')} style={DISPLAY}>
                                Difference is market share minus invested share
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const AllocationPage: React.FC = () => {
    const [view, setView] = useLocalStorage<AllocationView>('finsip:allocation-view', 'KMI30');
    const [investment, setInvestment] = useLocalStorage<number>('finsip:allocation-investment', 100000);

    // Lives up here rather than inside the view so the toggle can share the header row
    // with Screener. Off by default: the drift table is the thing being read, and the
    // trade list is the follow-up question you ask of it.
    const [rebalancing, setRebalancing] = useState(false);

    return (
        <div className="flex flex-col gap-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Segmented control on one recessed track — the same control as the
                    Buy/Sell switch in Monthly Entry, at page scale. */}
                <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
                    {VIEWS.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            style={DISPLAY}
                            className={clsx(
                                'rounded-lg px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all',
                                view === v.id
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-400 hover:text-slate-900'
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* Only Current Allocation has a live split to pull back onto a plan;
                        on the other two tabs the plan *is* the table. */}
                    {view === 'CURRENT' && (
                        <button
                            onClick={() => setRebalancing((prev) => !prev)}
                            style={DISPLAY}
                            className={clsx(
                                'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 transition-colors',
                                rebalancing
                                    ? 'bg-slate-900 text-white ring-slate-900'
                                    : 'bg-white text-slate-500 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] hover:text-slate-900'
                            )}
                        >
                            <Scale size={13} />
                            Rebalance
                        </button>
                    )}

                    {/* Deciding what to hold is the step before deciding how much of
                        it to hold, and the screener is where that happens. */}
                    <Link
                        href="/screener"
                        style={DISPLAY}
                        className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] transition-colors hover:text-slate-900"
                    >
                        <LineChart size={13} />
                        Screener
                    </Link>

                    {/* The one input that drives every number in the table, so it gets the
                        dark slab the running totals use everywhere else. Current Allocation
                        reads the ledger instead of a plan, so there it would drive nothing. */}
                    <label className={clsx(view === 'CURRENT' && 'hidden', 'relative flex items-center gap-2.5 overflow-hidden rounded-xl bg-slate-950 py-1.5 pl-3.5 pr-1.5 ring-1 ring-white/10')}>
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        />
                        <span className="flex items-center">
                            <span
                                className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-300"
                                style={DISPLAY}
                            >
                                Invest
                            </span>
                        </span>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            value={investment}
                            // An empty field parses to NaN and would blank the whole table.
                            onChange={(e) => setInvestment(Number(e.target.value) || 0)}
                            onFocus={(e) => e.currentTarget.select()}
                            style={NUMERIC}
                            className="no-spinner w-24 rounded-lg bg-white/5 px-2 py-1 text-right text-[13px] font-semibold tabular-nums text-white outline-none ring-1 ring-white/10 transition-colors hover:bg-white/10 focus:bg-white/10 focus:ring-sky-400/50"
                        />
                    </label>
                </div>
            </div>

            {view === 'CURRENT' ? (
                <CurrentAllocationView rebalancing={rebalancing} />
            ) : view === 'MINE' ? (
                <MySymbolsView investment={investment} />
            ) : (
                <IndexAllocationView investment={investment} />
            )}
        </div>
    );
};

export default AllocationPage;