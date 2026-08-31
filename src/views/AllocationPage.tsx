"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, LineChart, Scale, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import useLocalStorage from '../hooks/useLocalStorage';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { useIndexCompanies, type MarketIndex } from '../hooks/useIndexCompanies';
import { useAllocations, MAX_ALLOCATION_HOLDINGS, type AllocationInput, type AllocationRow } from '../hooks/useAllocations';
import { useMomentum } from '../hooks/useMomentum';
import AllocationTable from '../components/allocation/AllocationTable';
import CurrentAllocationTable, { type CurrentAllocationRow } from '../components/allocation/CurrentAllocationTable';
import RebalanceTable from '../components/allocation/RebalanceTable';
import { computeLiveHoldings } from '../utils/holdings';
import { computeRebalance } from '../utils/rebalance';
import { DISPLAY, NUMERIC } from '../utils/typography';

/**
 * A tab is named for the index it funds *from* and the depth it funds *to*: KMI 15 is
 * the top fifteen of KMI 30, KSE 15 the top fifteen of KSE 30. The index itself stays a
 * `MarketIndex` and is never the tab's own name.
 */
type AllocationView = 'KMI15' | 'KSE15' | 'MINE' | 'CURRENT' | 'MOMENTUM';

/**
 * Tabs that no longer exist, and where a stored value for one lands instead.
 *
 * These names are still sitting in the localStorage of anyone who last left the page on
 * them, and a stored value with no tab behind it would render a page with nothing lit.
 */
const RETIRED_VIEWS: Record<string, AllocationView> = {
    // Funded all thirty; removed in favour of the fifteen-deep tab.
    KMI30: 'KMI15',
    // Only ever the fifteen-deep tab -- it was named for its index before being renamed
    // for what it actually funds.
    KSE30: 'KSE15',
};

/** What the rebalance pulls the book onto: the weights you set, or the split you bought at. */
type RebalanceBasis = 'custom' | 'invested';

const VIEWS: Array<{ id: AllocationView; label: string }> = [
    { id: 'CURRENT', label: 'Invested' },
    { id: 'MINE', label: 'Custom' },
    { id: 'MOMENTUM', label: 'Momentum' },
    { id: 'KMI15', label: 'KMI 15' },
    { id: 'KSE15', label: 'KSE 15' },
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

/**
 * An index tab: weights come from the exchange, so the table is read-only.
 *
 * `index` is which PSX index the money is split by and `limit` is how far down it the
 * money goes -- `fetchIndexCompanies` returns every feed sorted heaviest-first, so a
 * limit is always the top N by index weight. One component, one calculation; the tabs
 * differ only in those two arguments.
 */
const IndexAllocationView: React.FC<{
    index: MarketIndex;
    investment: number;
    limit: number;
}> = ({ index, investment, limit }) => {
    const { companies, loading, error, refetch } = useIndexCompanies(index);
    const allocation = useAllocations(companies, investment, limit);

    if (loading && companies.length === 0) return <TableSkeleton />;

    return (
        <div className="flex flex-col gap-2">
            {error && <FeedError onRetry={refetch} />}
            <AllocationTable
                rows={allocation.results}
                summary={allocation}
                emptyMessage={error ? 'Feed unavailable' : 'No data available'}
                // KMI is the Shariah index -- every row would carry the badge, so it
                // says nothing there. KSE 30 is the whole market, where it is the
                // distinction the list is actually being read for.
                showShariah={index !== 'KMI30'}
                showPortfolio
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
                    className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
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
 * The JS Momentum Factor Index, funded like any other index tab.
 *
 * The one tab whose weights are not a feed. JSMFI is published as a table on JS
 * Investments' ETF page and nowhere else, so `/api/momentum` reads it out of
 * that page's markup server-side -- the browser cannot fetch that HTML itself --
 * and holds the result for the calendar day. The index rebalances monthly, so a
 * day is already far more often than the figures can change; Rescrape is there
 * for the day the rebalance lands.
 *
 * Prices and logos come from the market feed the app already shares, exactly as
 * the Custom tab gets them, so nothing here waits on a second request.
 */
const MomentumView: React.FC<{ investment: number }> = ({ investment }) => {
    const { index, loading, error, rescrape, rescraping } = useMomentum();
    const { livePrices } = usePortfolio();
    const { companies } = useIndexCompanies('ALLSHR');

    const rows: AllocationInput[] = useMemo(() => {
        if (!index) return [];

        const feed = new Map(companies.map((c) => [c.name.toUpperCase(), c]));

        return index.constituents.map((c) => {
            const symbol = c.symbol.toUpperCase();
            const listed = feed.get(symbol);

            return {
                name: symbol,
                logo: listed?.logo ?? '',
                // The live sweep first, the index feed behind it: the same two
                // sources the rest of the page prices from, in the same order.
                price: livePrices[symbol] || listed?.price || 0,
                weight: c.weight,
            };
        });
    }, [index, companies, livePrices]);

    // Every constituent is funded -- the index is ten deep, well inside the cap,
    // and truncating a published index would misstate what it is.
    const allocation = useAllocations(rows, investment, rows.length || MAX_ALLOCATION_HOLDINGS);

    if (loading && !index) return <TableSkeleton />;

    const unpriced = rows.filter((r) => r.price <= 0).map((r) => r.name);

    return (
        <div className="flex flex-col gap-2">
            {error && !index && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2.5 text-amber-700 ring-1 ring-amber-500/15">
                    <p className={NOTE} style={DISPLAY}>
                        Could not read the momentum index
                    </p>
                    <button
                        onClick={() => rescrape()}
                        style={DISPLAY}
                        className={clsx(NOTE, 'flex items-center gap-1.5 transition-colors hover:text-amber-900')}
                    >
                        <RefreshCw size={12} />
                        Retry
                    </button>
                </div>
            )}

            <AllocationTable
                rows={allocation.results}
                summary={allocation}
                emptyMessage={error ? 'Index unavailable' : 'No constituents'}
                showShariah
                showPortfolio
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                {/* The table is a scrape of someone else's page, so it says which
                    month it is a scrape of -- a stale month is the one failure
                    mode a table of weights cannot show on its own. */}
                {index?.asOf && (
                    <p className={clsx(NOTE, 'text-slate-500')} style={DISPLAY}>
                        JSMFI — {index.asOf}
                    </p>
                )}
                {unpriced.length > 0 && (
                    <p className={clsx(NOTE, 'flex items-center gap-1.5 text-amber-600')} style={DISPLAY}>
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        No live price: {unpriced.join(', ')}
                    </p>
                )}

                <div className="ml-auto flex items-center gap-3">
                    {index?.sourceUrl && (
                        <a
                            href={index.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={DISPLAY}
                            className={clsx(NOTE, 'flex items-center gap-1.5 text-slate-300 transition-colors hover:text-slate-600')}
                        >
                            <ExternalLink size={11} />
                            Source
                        </a>
                    )}
                    <button
                        onClick={() => rescrape()}
                        disabled={rescraping}
                        title="Read the index off jsil.com again"
                        style={DISPLAY}
                        className={clsx(
                            NOTE,
                            'flex items-center gap-1.5 transition-colors',
                            rescraping ? 'text-sky-500' : 'text-slate-400 hover:text-slate-900'
                        )}
                    >
                        <RefreshCw size={12} className={clsx(rescraping && 'animate-spin')} />
                        {rescraping ? 'Scraping' : 'Rescrape'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * What the portfolio actually looks like right now: the split it was bought at,
 * the split the market has since made of it, and the drift between the two.
 * Nothing here depends on the investment amount -- it reads the ledger, not a plan.
 */
const CurrentAllocationView: React.FC<{ rebalancing: boolean; basis: RebalanceBasis }> = ({
    rebalancing,
    basis,
}) => {
    const { transactions, transactionsLoading, livePrices, stocks } = usePortfolio();
    const { companies } = useIndexCompanies('ALLSHR');
    // Warm in the boot cache already -- the KMI 30 tab reads the same query, so putting
    // its weights in this table costs no request.
    const { companies: kmiCompanies } = useIndexCompanies('KMI30');
    const currency = useCurrency();

    const logos = useMemo(
        () => new Map(companies.map((c) => [c.name, c.logo])),
        [companies]
    );

    const holdings = useMemo(
        () => computeLiveHoldings(transactions, livePrices),
        [transactions, livePrices]
    );

    // The custom plan is exactly what the Custom tab funds -- the same leading slice in
    // the same Overview order -- so the two tabs can't disagree about the target.
    /**
     * Two things you can rebalance onto, and they answer different questions.
     *
     * `custom` pulls the book onto the weights set on the Custom tab -- the allocation
     * you decided you wanted.
     *
     * `invested` pulls it back onto the split you actually bought at. Nothing is
     * re-decided: it only undoes the drift the market has since put between what each
     * position cost and what it is now worth. Weights are raw cost basis; the plan
     * normalises them, so they don't need to be percentages.
     */
    const targets = useMemo(
        () =>
            basis === 'invested'
                ? holdings.map((h) => ({ symbol: h.symbol.toUpperCase(), weight: h.totalCostBasis }))
                : stocks.slice(0, MAX_ALLOCATION_HOLDINGS).map((s) => ({
                      symbol: s.symbol.toUpperCase(),
                      weight: s.allocationWeight ?? 0,
                  })),
        [basis, holdings, stocks]
    );

    const plan = useMemo(
        () => computeRebalance(holdings, targets, livePrices, logos),
        [holdings, targets, livePrices, logos]
    );

    /**
     * The Custom tab's weights, normalised the same way that tab normalises them: as a
     * share of the weights actually set, not of 100. A symbol with no weight stays out
     * of the map entirely -- unset and zero are different answers, and the column shows
     * a dash for the first.
     */
    const customShares = useMemo(() => {
        const weighted = stocks
            .slice(0, MAX_ALLOCATION_HOLDINGS)
            .filter((s) => (s.allocationWeight ?? 0) > 0);
        const total = weighted.reduce((sum, s) => sum + (s.allocationWeight ?? 0), 0);

        return new Map(
            total > 0
                ? weighted.map((s) => [
                      s.symbol.toUpperCase(),
                      ((s.allocationWeight ?? 0) / total) * 100,
                  ])
                : []
        );
    }, [stocks]);

    const kmiShares = useMemo(
        () => new Map(kmiCompanies.map((c) => [c.name.toUpperCase(), c.weight])),
        [kmiCompanies]
    );

    const rows: CurrentAllocationRow[] = useMemo(() => {

        const totalCost = holdings.reduce((sum, h) => sum + h.totalCostBasis, 0);
        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        return holdings
            .map((h) => {
                const investedShare = totalCost > 0 ? (h.totalCostBasis / totalCost) * 100 : 0;
                const marketShare = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;

                const key = h.symbol.toUpperCase();

                return {
                    symbol: h.symbol,
                    logo: logos.get(key) ?? '',
                    investedShare,
                    customShare: customShares.get(key) ?? null,
                    kmiShare: kmiShares.get(key) ?? null,
                    marketShare,
                    difference: marketShare - investedShare,
                    isPriced: h.isPriced,
                };
            })
            // Heaviest position first: the rows that move the portfolio most are the
            // ones worth reading, and the drift on a 0.4% holding is noise.
            .sort((a, b) => b.marketShare - a.marketShare);
    }, [holdings, logos, customShares, kmiShares]);

    if (transactionsLoading) return <TableSkeleton />;

    return (
        <div className="flex flex-col gap-2">
            {rebalancing && rows.length > 0 ? (
                plan.unweighted ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                        <p
                            className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            No target weights
                        </p>
                        <p className="mt-3 text-xs font-medium text-slate-400">
                            Set a weight on the Custom tab — that&apos;s the allocation this
                            rebalances back onto. Or rebalance with Invested, which needs
                            no weights: it uses the split you bought at.
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
    const [storedView, setView] = useLocalStorage<AllocationView | keyof typeof RETIRED_VIEWS>(
        'finsip:allocation-view',
        'KMI15'
    );

    // A stored name that no longer belongs to a tab lands on its replacement. Read rather
    // than written back: the stored value is corrected the next time a tab is actually
    // picked, and rewriting it here would mean a storage write on every visit.
    const view: AllocationView = RETIRED_VIEWS[storedView] ?? (storedView as AllocationView);
    const [investment, setInvestment] = useLocalStorage<number>('finsip:allocation-investment', 100000);

    // Lives up here rather than inside the view so the toggle can share the header row
    // with Screener. Off by default: the drift table is the thing being read, and the
    // trade list is the follow-up question you ask of it.
    const [rebalancing, setRebalancing] = useState(false);
    const [basis, setBasis] = useLocalStorage<RebalanceBasis>('finsip:rebalance-basis', 'custom');

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
                        // Off, it's one button. On, the basis choice unfolds inside the same
                        // dark slab -- a second row of light pills under the tab bar read as a
                        // rival set of tabs, which is exactly what it isn't.
                        <div
                            className={clsx(
                                'flex items-center rounded-xl ring-1 transition-colors',
                                rebalancing
                                    ? 'gap-1 bg-slate-900 p-1 ring-slate-900'
                                    : 'ring-transparent'
                            )}
                        >
                            <button
                                onClick={() => {
                                    // Opening the plan always starts from Invested: it needs no
                                    // weights set and answers the question you clicked for --
                                    // what the market has drifted away from what you paid.
                                    if (!rebalancing) setBasis('invested');
                                    setRebalancing((prev) => !prev);
                                }}
                                title={rebalancing ? 'Stop rebalancing' : 'Rebalance the book'}
                                style={DISPLAY}
                                className={clsx(
                                    'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
                                    rebalancing
                                        ? 'rounded-lg px-2.5 py-1 text-white hover:text-sky-300'
                                        : 'rounded-xl bg-white px-3.5 py-2 text-slate-500 ring-1 ring-slate-900/5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] hover:text-slate-900'
                                )}
                            >
                                <Scale size={13} />
                                Rebalance
                            </button>

                            {rebalancing && (
                                <>
                                    <span aria-hidden className="h-4 w-px shrink-0 bg-white/15" />
                                    {([
                                        { id: 'custom' as const, label: 'Custom', title: 'Onto the weights set on the Custom tab' },
                                        { id: 'invested' as const, label: 'Invested', title: 'Back onto the split you bought at' },
                                    ]).map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setBasis(option.id)}
                                            aria-pressed={basis === option.id}
                                            title={option.title}
                                            style={DISPLAY}
                                            className={clsx(
                                                'rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
                                                basis === option.id
                                                    ? 'bg-white text-slate-900'
                                                    : 'text-slate-400 hover:text-white'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
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
                    {/* One control, not a field boxed inside a chip: the slab itself is the
                        input, so there is no ring-inside-a-ring and the whole thing lights up
                        on focus. The figure is set large because it drives every number in
                        the table below. */}
                    <label
                        className={clsx(
                            view === 'CURRENT' && 'hidden',
                            'group relative flex cursor-text items-center gap-3 overflow-hidden rounded-xl bg-slate-950 py-2 pl-3.5 pr-4',
                            'ring-1 ring-white/10 transition-all focus-within:ring-sky-400/60'
                        )}
                    >
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        />
                        <span
                            className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400 transition-colors group-focus-within:text-sky-300"
                            style={DISPLAY}
                        >
                            Invest
                        </span>

                        <span className="flex items-baseline gap-1.5">
                            {/* Same dim currency mark the Amount component uses, so a typed
                                figure and a rendered one read as the same kind of thing. */}
                            <span
                                className="text-[9px] font-medium leading-none text-white/40"
                                style={DISPLAY}
                            >
                                Rs
                            </span>
                            <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1000"
                                value={investment}
                                // An empty field parses to NaN and would blank the whole table.
                                onChange={(e) => setInvestment(Number(e.target.value) || 0)}
                                onFocus={(e) => e.currentTarget.select()}
                                placeholder="0"
                                style={NUMERIC}
                                // border-0/p-0/focus:ring-0 strips @tailwindcss/forms, which
                                // would otherwise draw its own border and focus ring inside
                                // the slab and put the height back to 40px.
                                className="no-spinner w-28 border-0 bg-transparent p-0 text-[15px] font-semibold leading-none tabular-nums text-white outline-none placeholder:text-white/25 focus:ring-0"
                            />
                        </span>
                    </label>
                </div>
            </div>

            {view === 'CURRENT' ? (
                <CurrentAllocationView rebalancing={rebalancing} basis={basis} />
            ) : view === 'MINE' ? (
                <MySymbolsView investment={investment} />
            ) : view === 'MOMENTUM' ? (
                <MomentumView investment={investment} />
            ) : (
                <IndexAllocationView
                    index={view === 'KSE15' ? 'KSE30' : 'KMI30'}
                    investment={investment}
                    limit={MAX_ALLOCATION_HOLDINGS}
                />
            )}
        </div>
    );
};

export default AllocationPage;