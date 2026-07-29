"use client";

import React, { useState, useMemo, useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Save, TrendingUp, TrendingDown, Info, Calculator, CopyPlus, Share2, Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency, usePartialMask } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { computeHoldings } from '../utils/holdings';
import { useRememberedEntries } from '../hooks/useRememberedEntries';
import BoughtSummaryModal, { type SummaryRow } from './BoughtSummaryModal';
import { SkeletonBar, SkeletonCard, SkeletonTableRows } from './DashboardSkeleton';
import clsx from 'clsx';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, MetricLabel } from './Panel';
import { Amount } from './Amount';

const HEADERS: { label: string; align: 'left' | 'center' | 'right' }[] = [
    { label: 'Asset Symbol', align: 'left' },
    { label: 'Type', align: 'center' },
    { label: 'Quantity', align: 'left' },
    { label: 'Price per Share', align: 'left' },
    { label: 'Total Value', align: 'right' },
    { label: 'Final %', align: 'right' },
];

// Every control on this screen sits on the same recessed fill with no border — the
// focus ring is the only edge that ever appears, so a form of 20 rows stays quiet.
const FIELD = [
    'w-full rounded-lg border-0 bg-slate-100/70 px-3 py-2 text-[13px] font-semibold tabular-nums',
    'placeholder:font-normal placeholder:text-slate-300',
    'transition-all focus:bg-white focus:ring-2 focus:ring-sky-500/25',
].join(' ');

// Ghost action on the dark bar. The primary commit button opts out of this.
const BAR_BUTTON = [
    'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 sm:flex-none',
    'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300',
    'ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white',
    'active:scale-95 disabled:pointer-events-none disabled:opacity-30',
].join(' ');

const BulkTransactionForm: React.FC = () => {
    const formatCurrency = useCurrency();
    const maskSymbol = usePartialMask();
    const { stocks, stocksLoading, addTransaction, selectedMonth: month, livePrices, transactions } = usePortfolio();
    const { remembered, saving: rememberSaving, save: saveRemembered } = useRememberedEntries();

    // price is left undefined until the user types, so an untouched field can fall back
    // to the live feed while a deliberately cleared one stays empty.
    const [inputs, setInputs] = useState<Record<string, { shares: string; price?: string; type: 'buy' | 'sell' }>>({});

    // Entry is column-wise in practice: you go down the shares column filling quantities, and
    // only touch price for the few rows the live feed didn't cover. So Tab walks down the
    // column instead of across the row -- Shift+Tab walks back up it.
    const sharesRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [showSummary, setShowSummary] = useState(false);

    // Snapshot of what was committed. Saving clears the inputs, so the summary can't be derived
    // from the draft any more -- it has to be captured at commit time.
    const [committedRows, setCommittedRows] = useState<SummaryRow[] | null>(null);

    const handleSharesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, symbol: string) => {
        if (e.key !== 'Tab') return;

        const index = stocks.findIndex(s => s.symbol === symbol);
        if (index === -1) return;

        const next = e.shiftKey ? stocks[index - 1] : stocks[index + 1];
        const target = next && sharesRefs.current[next.symbol];
        if (!target) return; // first or last row: let Tab leave the column normally

        e.preventDefault();
        target.focus();
        target.select();
    };

    const handleInputChange = (symbol: string, field: 'shares' | 'price' | 'type', value: string) => {
        setInputs(prev => ({
            ...prev,
            [symbol]: {
                ...prev[symbol] || { type: 'buy', shares: '' },
                [field]: value
            }
        }));
    };

    // What the price box shows: the user's edit if they made one, otherwise the live quote.
    const priceFor = (symbol: string) => {
        const typed = inputs[symbol]?.price;
        if (typed !== undefined) return typed;
        const live = livePrices[symbol];
        return live > 0 ? live.toFixed(2) : '';
    };

    const isLivePrice = (symbol: string) => inputs[symbol]?.price === undefined && livePrices[symbol] > 0;

    const parsedEntries = useMemo(() => {
        return stocks.map(stock => {
            const data = inputs[stock.symbol];
            const shares = data?.shares ? Number(data.shares) : 0;
            const price = Number(priceFor(stock.symbol)) || 0;
            const type = data?.type || 'buy';
            return {
                symbol: stock.symbol,
                shares,
                price,
                type,
                total: shares * price
            };
        });
    }, [inputs, stocks, livePrices]);

    const totalMonthlyInvestment = useMemo(() => {
        return parsedEntries.reduce((sum, entry) => {
            return sum + (entry.type === 'sell' ? -entry.total : entry.total);
        }, 0);
    }, [parsedEntries]);

    const activeEntriesCount = useMemo(() => {
        return parsedEntries.filter(e => e.shares > 0 && e.price > 0).length;
    }, [parsedEntries]);

    // Allocation is share-of-buys: sells are money coming back out, so folding them in would
    // let one sell push the remaining rows over 100%.
    const totalBought = useMemo(() =>
        parsedEntries.reduce((sum, e) => sum + (e.type === 'buy' ? e.total : 0), 0),
        [parsedEntries]
    );

    // Cost basis already on the books, so each row can show where it stands today and where
    // this month's entry would move it to.
    const currentCostBySymbol = useMemo(() => {
        const map = new Map<string, number>();
        computeHoldings(transactions).forEach(h => map.set(h.symbol, h.totalCostBasis));
        return map;
    }, [transactions]);

    const currentTotalCost = useMemo(() =>
        Array.from(currentCostBySymbol.values()).reduce((sum, cost) => sum + cost, 0),
        [currentCostBySymbol]
    );

    // Post-commit denominator: today's book plus this month's net (sells shrink it).
    const projectedTotalCost = currentTotalCost + totalMonthlyInvestment;

    const allocationsFor = (symbol: string, entryTotal: number, type: 'buy' | 'sell') => {
        const currentCost = currentCostBySymbol.get(symbol) || 0;

        // A sell reduces cost basis at average cost, which is what the entry's rupee value is
        // built from, so subtracting it here matches what computeHoldings will do on save.
        const projectedCost = Math.max(currentCost + (type === 'sell' ? -entryTotal : entryTotal), 0);

        return {
            current: currentTotalCost > 0 ? (currentCost / currentTotalCost) * 100 : 0,
            entry: type === 'buy' && totalBought > 0 ? (entryTotal / totalBought) * 100 : 0,
            projected: projectedTotalCost > 0 ? (projectedCost / projectedTotalCost) * 100 : 0,
        };
    };

    // The most recent month that actually has entries -- not simply the previous one, which is
    // often empty (a skipped month, or a fresh month opened mid-year).
    const recentMonth = useMemo(() => {
        const earlier = transactions
            .filter(t => t.month < month)
            .map(t => t.month);

        return earlier.length > 0 ? earlier.sort().at(-1) : undefined;
    }, [transactions, month]);

    // Net shares per symbol in that month: buys minus sells.
    const recentEntries = useMemo(() => {
        const netBySymbol = new Map<string, number>();
        if (!recentMonth) return netBySymbol;

        transactions
            .filter(t => t.month === recentMonth)
            .forEach(t => {
                const signed = t.type === 'sell' ? -t.shares : t.shares;
                netBySymbol.set(t.symbol, (netBySymbol.get(t.symbol) || 0) + signed);
            });

        return netBySymbol;
    }, [transactions, recentMonth]);

    const fillFromRecent = () => {
        if (!recentMonth || recentEntries.size === 0) {
            toast.error('No earlier entries to copy from');
            return;
        }

        setInputs(prev => {
            const next = { ...prev };

            stocks.forEach(stock => {
                const netShares = recentEntries.get(stock.symbol);
                if (!netShares) return;

                next[stock.symbol] = {
                    ...(next[stock.symbol] || {}),
                    shares: String(Math.abs(netShares)),
                    type: netShares < 0 ? 'sell' : 'buy',
                };
            });

            return next;
        });

        toast.success(`Filled quantities from ${formatMonth(recentMonth)}`);
    };

    // True once any row carries a quantity. It decides which of the Remember
    // button's two jobs runs: with quantities on screen it saves them, with the
    // column empty it fills the saved ones back in.
    const hasQuantities = useMemo(
        () => stocks.some(s => {
            const v = inputs[s.symbol]?.shares;
            return v !== undefined && v !== '' && Number(v) > 0;
        }),
        [inputs, stocks]
    );

    const rememberedCount = useMemo(() => Object.keys(remembered).length, [remembered]);

    const rememberOrRecall = async () => {
        if (hasQuantities) {
            // Remember: snapshot the quantities currently on screen.
            const snapshot: Record<string, { shares: string; type: 'buy' | 'sell' }> = {};
            stocks.forEach(stock => {
                const data = inputs[stock.symbol];
                const shares = data?.shares;
                if (shares !== undefined && shares !== '' && Number(shares) > 0) {
                    snapshot[stock.symbol] = { shares: String(shares), type: data?.type || 'buy' };
                }
            });

            const ok = await saveRemembered(snapshot);
            if (ok) toast.success(`Remembered quantities for ${Object.keys(snapshot).length} symbols`);
            return;
        }

        // Recall: the column is empty, so fill it from the saved snapshot.
        if (rememberedCount === 0) {
            toast.error('Nothing remembered yet — enter quantities first, then Remember');
            return;
        }

        setInputs(prev => {
            const next = { ...prev };
            stocks.forEach(stock => {
                const saved = remembered[stock.symbol];
                if (!saved) return;
                next[stock.symbol] = {
                    ...(next[stock.symbol] || {}),
                    shares: saved.shares,
                    type: saved.type,
                };
            });
            return next;
        });

        toast.success('Filled remembered quantities');
    };

    // What the summary shows: the entries currently on screen, not what's already in the books.
    const draftRows = useMemo<SummaryRow[]>(() =>
        parsedEntries
            .filter(e => e.type === 'buy' && e.shares > 0 && e.price > 0)
            .map(e => ({
                symbol: e.symbol,
                shares: e.shares,
                avgPrice: e.price,
                amount: e.total,
            }))
            .sort((a, b) => b.amount - a.amount),
        [parsedEntries]
    );

    const handleBulkSave = () => {
        if (activeEntriesCount === 0) {
            toast.error("Please enter at least one transaction quantity and price.");
            return;
        }

        parsedEntries.forEach(entry => {
            addTransaction({
                month,
                symbol: entry.symbol,
                shares: entry.shares,
                pricePerShare: entry.price,
                type: entry.type
            });
        });

        setCommittedRows(draftRows);
        setInputs({});

        toast.success(`Successfully saved ${activeEntriesCount} entries for ${month}!`, {
            description: `Total net value: ${formatCurrency(totalMonthlyInvestment)}`
        });

        setShowSummary(true);
    };

    // An empty symbol list and a symbol list that has not arrived yet look the
    // same from here, so the "add stocks first" pitch waits for the query rather
    // than flashing over a portfolio that does have symbols.
    if (stocksLoading) {
        return (
            <div className="space-y-6">
                <SkeletonCard>
                    <SkeletonBar className="h-3 w-full mb-5" />
                    <SkeletonTableRows rows={7} cols={6} />
                </SkeletonCard>
            </div>
        );
    }

    if (stocks.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 ring-1 ring-slate-900/10">
                        <TrendingUp size={20} />
                    </div>
                    <h3
                        className="text-[15px] font-semibold uppercase leading-none tracking-[0.02em] text-slate-900"
                        style={DISPLAY}
                    >
                        No Stocks Added Yet
                    </h3>
                    <p className="mt-3 max-w-md text-xs font-medium leading-relaxed text-slate-400">
                        Before you can record monthly transactions, you need to add stocks to your portfolio.
                        Head over to the &quot;Manage Stocks&quot; page to get started.
                    </p>
                    <div
                        className="mt-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                        style={DISPLAY}
                    >
                        <Info size={13} className="text-sky-500" />
                        Add stocks first, then log your SIP entries
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Panel flush>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                {HEADERS.map(h => (
                                    <th
                                        key={h.label}
                                        style={DISPLAY}
                                        className={clsx(
                                            "px-4 py-3 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400",
                                            h.align === 'right' && "text-right",
                                            h.align === 'center' && "text-center"
                                        )}
                                    >
                                        {h.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70">
                            {stocks.map(stock => {
                                const entry = inputs[stock.symbol] || { type: 'buy' as const, shares: '' };
                                const priceValue = priceFor(stock.symbol);
                                const sharesVal = Number(entry.shares) || 0;
                                const priceVal = Number(priceValue) || 0;
                                const total = sharesVal * priceVal;
                                const fromLiveFeed = isLivePrice(stock.symbol);
                                const allocation = allocationsFor(stock.symbol, total, entry.type);

                                return (
                                    <tr key={stock.id} className="group transition-colors hover:bg-slate-50/70">
                                        {/* The accent rail only paints on hover, so a long entry form stays
                                            flat and the pointer has something to track down the column. */}
                                        <td className="relative px-4 py-2">
                                            <span
                                                aria-hidden
                                                className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                            />
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[13px] font-semibold uppercase tracking-tight text-slate-900"
                                                    style={DISPLAY}
                                                >
                                                    {maskSymbol(stock.symbol)}
                                                </span>
                                                <span
                                                    className="inline-flex rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-slate-500"
                                                    style={DISPLAY}
                                                >
                                                    {stock.sector || 'Others'}
                                                </span>
                                            </div>
                                        </td>
                                        {/* Segmented control: one recessed track, the active side lifted on a
                                            white pill. Colour lands only on the selected side. */}
                                        <td className="px-4 py-2">
                                            <div className="flex justify-center">
                                                <div className="inline-flex rounded-lg bg-slate-100/80 p-0.5">
                                                    <button
                                                        onClick={() => handleInputChange(stock.symbol, 'type', 'buy')}
                                                        style={DISPLAY}
                                                        className={clsx(
                                                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all",
                                                            entry.type === 'buy'
                                                                ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-900/5"
                                                                : "text-slate-400 hover:text-slate-600"
                                                        )}
                                                    >
                                                        <TrendingUp size={12} />
                                                        Buy
                                                    </button>
                                                    <button
                                                        onClick={() => handleInputChange(stock.symbol, 'type', 'sell')}
                                                        style={DISPLAY}
                                                        className={clsx(
                                                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all",
                                                            entry.type === 'sell'
                                                                ? "bg-white text-rose-500 shadow-sm ring-1 ring-slate-900/5"
                                                                : "text-slate-400 hover:text-slate-600"
                                                        )}
                                                    >
                                                        <TrendingDown size={12} />
                                                        Sell
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="max-w-[120px]">
                                                <input
                                                    ref={(el) => { sharesRefs.current[stock.symbol] = el; }}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.shares}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'shares', e.target.value)}
                                                    onKeyDown={(e) => handleSharesKeyDown(e, stock.symbol)}
                                                    style={NUMERIC}
                                                    className={clsx(FIELD, 'text-right text-slate-900')}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[160px]">
                                                <span
                                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400"
                                                    style={DISPLAY}
                                                >
                                                    Rs
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={priceValue}
                                                    onChange={(e) => handleInputChange(stock.symbol, 'price', e.target.value)}
                                                    style={NUMERIC}
                                                    className={clsx(
                                                        FIELD,
                                                        'pl-8 pr-7 text-right',
                                                        fromLiveFeed ? "text-sky-600" : "text-slate-900"
                                                    )}
                                                    placeholder="0.00"
                                                />
                                                {/* A price the user never typed came from the feed. The dot says so
                                                    without a word of chrome — colour alone was doing that job before. */}
                                                {fromLiveFeed && (
                                                    <span
                                                        title="Price from the live feed — type to override"
                                                        className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-sky-400"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <div
                                                className={clsx(
                                                    "text-[13px] font-semibold tabular-nums transition-colors",
                                                    total > 0
                                                        ? (entry.type === 'sell' ? "text-rose-600" : "text-emerald-600")
                                                        : "text-slate-300"
                                                )}
                                                style={NUMERIC}
                                            >
                                                {total > 0 && (entry.type === 'sell' ? '−' : '+')}
                                                {formatCurrency(Math.round(total)).replace(/^Rs\s*/, '')}
                                            </div>
                                        </td>
                                        {/* Where this symbol lands once the month is committed. The delta against
                                            today's allocation is what makes the number actionable. */}
                                        <td className="px-4 py-2 text-right">
                                            {total > 0 || allocation.current > 0 ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span
                                                        className="w-12 text-right text-[13px] font-semibold tabular-nums text-slate-900"
                                                        style={NUMERIC}
                                                    >
                                                        {allocation.projected.toFixed(1)}%
                                                    </span>
                                                    {total > 0 && (
                                                        <span
                                                            className={clsx(
                                                                "inline-flex w-12 justify-center rounded-md px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
                                                                allocation.projected >= allocation.current
                                                                    ? "bg-emerald-500/10 text-emerald-600"
                                                                    : "bg-rose-500/10 text-rose-600"
                                                            )}
                                                            style={NUMERIC}
                                                        >
                                                            {allocation.projected >= allocation.current ? '+' : '−'}
                                                            {Math.abs(allocation.projected - allocation.current).toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[13px] tabular-nums text-slate-300" style={NUMERIC}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Action bar — the same dark slab as the navbar panel, mounted flush to the
                    foot of the form so the running totals sit next to the commit. */}
                <div className="relative overflow-hidden bg-slate-950">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_160%_at_0%_0%,rgba(56,189,248,0.12),transparent_55%)]"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />

                    <div className="relative flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
                        <div className="flex items-center gap-4 lg:gap-5">
                            <div className="flex flex-col gap-2">
                                <MetricLabel label="Assets Impacted" tone="dark" />
                                <span
                                    className="text-[15px] font-semibold leading-none tabular-nums text-white"
                                    style={NUMERIC}
                                >
                                    {activeEntriesCount}
                                    <span className="text-slate-500"> / {stocks.length}</span>
                                </span>
                            </div>

                            <span
                                aria-hidden
                                className="h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent"
                            />

                            <div className="flex flex-col gap-2">
<MetricLabel label="Net Monthly Value" tone="dark" />
                                <span className={clsx(
                                    "flex items-baseline gap-1.5",
                                    totalMonthlyInvestment >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    <span className="text-[9px] leading-none" style={NUMERIC}>
                                        {totalMonthlyInvestment >= 0 ? '▲' : '▼'}
                                    </span>
                                    <Amount
                                        value={formatCurrency(Math.round(Math.abs(totalMonthlyInvestment)))}
                                        size="text-[15px]"
                                    />
                                </span>
                            </div>
                        </div>

                        <div className="flex w-full items-center gap-2 sm:w-auto">
                            <button
                                onClick={fillFromRecent}
                                disabled={recentEntries.size === 0}
                                title={
                                    recentMonth
                                        ? `Copy quantities from ${formatMonth(recentMonth)}`
                                        : 'No earlier entries to copy from'
                                }
                                style={DISPLAY}
                                className={BAR_BUTTON}
                            >
                                <CopyPlus size={14} />
                                Fill Recent
                            </button>

                            <button
                                onClick={rememberOrRecall}
                                disabled={rememberSaving || (!hasQuantities && rememberedCount === 0)}
                                title={
                                    hasQuantities
                                        ? 'Remember the quantities currently entered'
                                        : rememberedCount > 0
                                            ? `Fill ${rememberedCount} remembered quantities`
                                            : 'Enter quantities first, then Remember them'
                                }
                                style={DISPLAY}
                                className={BAR_BUTTON}
                            >
                                {hasQuantities ? <Bookmark size={14} /> : <BookmarkCheck size={14} />}
                                {hasQuantities ? 'Remember' : 'Recall'}
                            </button>

                            <button
                                onClick={() => { setCommittedRows(null); setShowSummary(true); }}
                                title={`Shareable summary of what you bought in ${formatMonth(month)}`}
                                style={DISPLAY}
                                className={BAR_BUTTON}
                            >
                                <Share2 size={14} />
                                Summary
                            </button>

                            {/* White on the dark bar: the strongest contrast available here, and it
                                keeps the one committing action from reading as just another chip. */}
                            <button
                                onClick={handleBulkSave}
                                style={DISPLAY}
                                className={clsx(
                                    "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2 sm:flex-none",
                                    "bg-white text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-900",
                                    "transition-all hover:bg-slate-100 active:scale-95"
                                )}
                            >
                                <Save size={14} />
                                Commit All Transactions
                            </button>
                        </div>
                    </div>
                </div>
            </Panel>

            <BoughtSummaryModal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                rows={committedRows ?? draftRows}
                month={month}
            />

            {/* Footnote, not an alert — it says the same thing in a neutral voice instead of
                spending a coloured panel on it. */}
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-100/70 px-3.5 py-2.5">
                <Info size={13} className="shrink-0 text-slate-400" />
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                    Entries with zero quantity or price will be ignored during save. &quot;Sell&quot; transactions
                    will be subtracted from your total invested amount.
                </p>
            </div>
        </div>
    );
};

export default BulkTransactionForm;