"use client";

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';
import { computeSipStreak } from '../utils/sipStreak';
import { describeMonthActivity } from '../utils/monthNarrative';
import { splitMonthActivity, type ActivityDay, type SoloGroup } from '../utils/monthActivity';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel, Panel, PanelHeader } from './Panel';

/** Emerald above zero, rose below, neutral at exactly nothing. */
const toneFor = (value: number) =>
    value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-900';

/** The strip shows a year at a time: enough to read a habit, short enough to stay legible. */
const STRIP_MONTHS = 12;

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM ''yy");

const Tile: React.FC<{ label: string; caption: string; children: React.ReactNode }> = ({
    label,
    caption,
    children,
}) => (
    <div className="rounded-xl bg-slate-50/70 px-3.5 py-3 ring-1 ring-slate-900/5">
        <MetricLabel label={label} />
        <div className="mt-2.5">{children}</div>
        <p
            className="mt-2 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
            style={DISPLAY}
        >
            {caption}
        </p>
    </div>
);

/** A money figure with its own percentage beside it, in the panel's colour for the sign. */
const Result: React.FC<{ amount: string; percent: number }> = ({ amount, percent }) => (
    <span className={clsx('flex flex-wrap items-baseline gap-x-2 gap-y-1')}>
        <Amount value={amount} />
        <span className="text-[11px] font-semibold leading-none tabular-nums opacity-80" style={NUMERIC}>
            {percent >= 0 ? '+' : '−'}
            {Math.abs(percent).toFixed(2)}%
        </span>
    </span>
);

/**
 * The money half of the ledger's standing figures -- what the book has made, booked
 * and unbooked. Flanks the log on the left.
 *
 * Realized and unrealized are deliberately measured against different bases, and each
 * against its own: realized is scored on what the sold shares originally cost (from
 * `realized_pnl`, which stores the average buy price it was closed against), unrealized
 * on the cost of what is still held. Scoring both against one number would make each
 * percentage answer a question neither was asked.
 */
export const LedgerReturns: React.FC = () => {
    const { transactions, realizedProfits, livePrices } = usePortfolio();
    const formatCurrency = useCurrency();

    // Same derivation the rest of the app uses for "now" (PortfolioContext seeds its
    // selected month the same way), so the two can never disagree about the month.
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Every symbol the ledger has ever touched, buys and sells alike -- a symbol bought
    // and fully exited still counts, which is what makes this different from the
    // holdings count on Overview.
    const symbolsTraded = useMemo(
        () => new Set(transactions.map((t) => t.symbol).filter(Boolean)).size,
        [transactions]
    );

    const streak = useMemo(
        () => computeSipStreak(transactions, currentMonth),
        [transactions, currentMonth]
    );
    const strip = streak.months.slice(-STRIP_MONTHS);

    const realized = useMemo(() => {
        let profit = 0;
        let cost = 0;

        realizedProfits.forEach((p) => {
            profit += Number(p.realizedProfit || 0);
            cost += Number(p.quantitySold || 0) * Number(p.avgBuyPrice || 0);
        });

        return { profit, percent: cost > 0 ? (profit / cost) * 100 : 0, cost };
    }, [realizedProfits]);

    const unrealized = useMemo(() => {
        const totals = summarizeLive(computeLiveHoldings(transactions, livePrices));
        return {
            profit: totals.totalPL,
            percent: totals.totalCost > 0 ? (totals.totalPL / totals.totalCost) * 100 : 0,
            unpriced: totals.unpricedCount,
        };
    }, [transactions, livePrices]);

    return (
        <Panel className="flex h-full flex-col">
            <PanelHeader title="Returns" caption="The Whole Book" />

            <div className="flex flex-col gap-3">
                <Tile
                    label="Realized Profit"
                    caption={realized.cost > 0 ? 'On Closed Positions' : 'Nothing Closed Yet'}
                >
                    <span className={toneFor(realized.profit)}>
                        <Result
                            amount={formatCurrency(Math.round(realized.profit))}
                            percent={realized.percent}
                        />
                    </span>
                </Tile>

                <Tile
                    label="Unrealized Profit"
                    caption={
                        // An unpriced symbol is held at cost, so it scores as flat rather than
                        // as a loss -- worth saying, because the figure is otherwise
                        // indistinguishable from a fully priced one.
                        unrealized.unpriced > 0
                            ? `${unrealized.unpriced} Unpriced, Held At Cost`
                            : 'On Open Positions'
                    }
                >
                    <span className={toneFor(unrealized.profit)}>
                        <Result
                            amount={formatCurrency(Math.round(unrealized.profit))}
                            percent={unrealized.percent}
                        />
                    </span>
                </Tile>

                <Tile label="Symbols Traded" caption="Till Today">
                    <span
                        className="block text-[17px] font-semibold leading-none tabular-nums text-slate-900"
                        style={NUMERIC}
                    >
                        {symbolsTraded}
                    </span>
                </Tile>
            </div>

            {/* SIP streak -- the one figure here that isn't about money. It reads off the
                same ledger: a month counts once it has bought something, so the strip is a
                picture of whether the plan was actually kept up. */}
            {streak.totalMonths > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3.5">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <MetricLabel label="SIP Streak" />
                            <p
                                className="mt-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                                style={DISPLAY}
                            >
                                Longest {streak.longest} · Funded {streak.fundedCount} of {streak.totalMonths}
                            </p>
                        </div>
                        <span className="flex items-baseline gap-1.5">
                            <span
                                className={clsx(
                                    'text-[17px] font-semibold leading-none tabular-nums',
                                    streak.current > 0 ? 'text-sky-600' : 'text-slate-400'
                                )}
                                style={NUMERIC}
                            >
                                {streak.current}
                            </span>
                            <span
                                className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                                style={DISPLAY}
                            >
                                {streak.current === 1 ? 'Month' : 'Months'}
                            </span>
                        </span>
                    </div>

                    {/* One bar per month, oldest left. A missed month is a gap in the run
                        rather than a smaller bar -- the question is whether it was paid, not
                        how much. */}
                    <div className="mt-3 flex items-end gap-1">
                        {strip.map((m) => (
                            <span
                                key={m.month}
                                title={`${monthLabel(m.month)} · ${m.funded ? formatCurrency(m.amount) : 'Not funded'}`}
                                className={clsx(
                                    'h-6 flex-1 rounded-md transition-colors',
                                    m.funded ? 'bg-sky-500' : 'bg-slate-100',
                                    // This month is still open, so it's outlined rather than
                                    // counted against the run.
                                    m.month === currentMonth && 'ring-2 ring-sky-500/25 ring-offset-1'
                                )}
                            />
                        ))}
                    </div>

                    {strip.length > 1 && (
                        <div className="mt-1.5 flex items-center justify-between">
                            {[strip[0].month, strip[strip.length - 1].month].map((m, i) => (
                                <span
                                    key={m}
                                    className={clsx(
                                        'text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400',
                                        i === 1 && 'text-right'
                                    )}
                                    style={DISPLAY}
                                >
                                    {monthLabel(m)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Panel>
    );
};

/** Shared by both kinds of row: the privacy-aware formatters, and the month's scale. */
interface RowProps {
    peak: number;
    formatCurrency: (amount: number) => string;
    mask: (value: string) => string;
    maskSymbol: (symbol: string) => string;
}

/** A day worth showing as a day: the SIP, or a day that did more than one thing. */
const ActivityDayBlock: React.FC<RowProps & { day: ActivityDay }> = ({
    day,
    peak,
    formatCurrency,
    mask,
    maskSymbol,
}) => (
    <div>
        <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5">
                <span
                    className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-500"
                    style={DISPLAY}
                >
                    {day.label}
                </span>
                {day.rank === 0 && day.buyTotal > 0 && (
                    <span
                        className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] text-sky-600"
                        style={DISPLAY}
                    >
                        SIP
                    </span>
                )}
            </span>
            <span
                className="text-[11px] font-semibold leading-none tabular-nums text-slate-900"
                style={NUMERIC}
            >
                {formatCurrency(Math.round(day.buyTotal - day.sellTotal))}
            </span>
        </div>

        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <span
                className={clsx('block h-full rounded-full', day.rank === 0 ? 'bg-sky-500' : 'bg-sky-500/40')}
                style={{ width: `${peak > 0 ? Math.max((day.buyTotal / peak) * 100, 2) : 2}%` }}
            />
        </span>

        <ul className="mt-2 space-y-1">
            {day.transactions.map((t) => {
                const isSell = t.type === 'sell';
                return (
                    <li
                        key={t.id}
                        title={`${mask(t.shares.toLocaleString())} @ ${t.pricePerShare.toFixed(2)}`}
                        className="flex items-baseline justify-between gap-2"
                    >
                        <span
                            className={clsx(
                                'truncate text-[11px] font-semibold uppercase tracking-[-0.03em]',
                                isSell ? 'text-rose-600' : 'text-slate-700'
                            )}
                            style={DISPLAY}
                        >
                            {maskSymbol(t.symbol)}
                        </span>
                        <span
                            className={clsx(
                                'shrink-0 text-[11px] leading-none tabular-nums',
                                isSell ? 'text-rose-600' : 'text-slate-500'
                            )}
                            style={NUMERIC}
                        >
                            {isSell ? '−' : ''}
                            {formatCurrency(Math.round(Number(t.totalAmount || t.shares * t.pricePerShare)))}
                        </span>
                    </li>
                );
            })}
        </ul>
    </div>
);

/**
 * A symbol bought on several days that each did nothing else -- one position built in
 * instalments, with the days it took listed inside rather than spread across the month
 * as separate headings.
 */
const ActivityGroupBlock: React.FC<RowProps & { group: SoloGroup }> = ({
    group,
    peak,
    formatCurrency,
    mask,
    maskSymbol,
}) => {
    const isSell = group.type === 'sell';
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                        className={clsx(
                            'truncate text-[11px] font-semibold uppercase tracking-[-0.03em]',
                            isSell ? 'text-rose-600' : 'text-slate-900'
                        )}
                        style={DISPLAY}
                    >
                        {maskSymbol(group.symbol)}
                    </span>
                    {/* Says the line stands for several purchases, so it can't be read
                        as one trade. */}
                    {group.count > 1 && (
                        <span
                            className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[8px] font-semibold leading-none tabular-nums text-slate-500"
                            style={NUMERIC}
                        >
                            ×{group.count}
                        </span>
                    )}
                </span>
                <span
                    className={clsx(
                        'shrink-0 text-[11px] font-semibold leading-none tabular-nums',
                        isSell ? 'text-rose-600' : 'text-slate-900'
                    )}
                    style={NUMERIC}
                >
                    {isSell ? '−' : ''}
                    {formatCurrency(Math.round(group.amount))}
                </span>
            </div>

            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <span
                    className={clsx('block h-full rounded-full', isSell ? 'bg-rose-500/50' : 'bg-sky-500/40')}
                    style={{ width: `${peak > 0 ? Math.max((group.amount / peak) * 100, 2) : 2}%` }}
                />
            </span>

            {/* Inside the group: the day each instalment went in. */}
            <ul className="mt-2 space-y-0.5">
                {group.fills.map((fill, i) => (
                    <li
                        key={`${fill.label}-${i}`}
                        title={`${mask(fill.shares.toLocaleString())} shares`}
                        className="flex items-baseline justify-between gap-2 text-[10px] leading-none text-slate-400"
                    >
                        <span className="font-semibold uppercase tracking-[0.14em]" style={DISPLAY}>
                            {fill.label}
                        </span>
                        <span className="shrink-0 tabular-nums" style={NUMERIC}>
                            {formatCurrency(Math.round(fill.amount))}
                        </span>
                    </li>
                ))}
            </ul>

            {group.count > 1 && (
                <p
                    className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                    style={DISPLAY}
                >
                    <span className="tabular-nums" style={NUMERIC}>
                        {mask(group.shares.toLocaleString())} @ {group.avgPrice.toFixed(2)}
                    </span>{' '}
                    averaged
                </p>
            )}
        </div>
    );
};

/**
 * This month, in words.
 *
 * Written from the ledger by `describeMonthActivity` -- templates over the rows, no
 * model and no request, so it costs nothing and can only say things that are true.
 */
export const LedgerActivity: React.FC = () => {
    const { transactions } = usePortfolio();
    const formatCurrency = useCurrency();
    const maskSymbol = usePartialMask();

    const currentMonth = new Date().toISOString().slice(0, 7);

    const mask = useMask();

    const summary = useMemo(
        () => describeMonthActivity(transactions, currentMonth, formatCurrency, maskSymbol),
        [transactions, currentMonth, formatCurrency, maskSymbol]
    );

    const items = useMemo(
        () => splitMonthActivity(transactions, currentMonth),
        [transactions, currentMonth]
    );

    // The month's heaviest buying sets the scale every bar is drawn against -- days and
    // accumulated symbols alike -- so a bar means the same thing wherever it appears.
    const peak = items.reduce(
        (max, item) => Math.max(max, item.kind === 'day' ? item.day.buyTotal : item.group.amount),
        0
    );

    return (
        <Panel className="flex h-full flex-col">
            <PanelHeader title="Activity" caption={format(parseISO(`${currentMonth}-01`), 'MMMM yyyy')} />

            <div className="shrink-0 rounded-xl bg-slate-50/70 px-3.5 py-3.5 ring-1 ring-slate-900/5">
                <p className="text-[13px] font-semibold leading-relaxed text-slate-900">
                    {summary.headline}
                </p>

                {/* One sentence per line: these say different kinds of thing (the SIP, a
                    rotation, the comparison) and run together as a paragraph. */}
                {summary.notes.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                        {summary.notes.map((note) => (
                            <li
                                key={note.text}
                                className={clsx(
                                    'flex items-baseline gap-1.5 text-[12px] font-medium leading-relaxed',
                                    note.tone === 'up' ? 'text-emerald-600'
                                        : note.tone === 'down' ? 'text-rose-600'
                                            : 'text-slate-500'
                                )}
                            >
                                {/* The same arrows the navbar and the live table use for a
                                    move, so a direction reads the same everywhere. */}
                                {note.tone && (
                                    <span className="text-[8px] leading-none" style={NUMERIC}>
                                        {note.tone === 'up' ? '▲' : '▼'}
                                    </span>
                                )}
                                <span>{note.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* The month day by day, newest first. The day that bought the most is the
                one the SIP actually went in on, so it's named -- the rest are top-ups,
                and their bars say how far short of it they fell. */}
            {/* One list, newest first, whatever kind of thing each entry is. A symbol
                accumulated across solo days sorts on its most recent instalment, so the
                month never switches ordering halfway down.

                Fixed height with its own scrollbar -- the thin always-visible one, not
                the hide-until-hover kind, so a month with more entries than fit says so
                instead of looking like the whole list. */}
            {items.length > 0 && (
                <div className="custom-scrollbar mt-4 max-h-[350px] space-y-3 overflow-y-auto border-t border-slate-100 pt-3.5 pr-1">
                    {items.map((item) =>
                        item.kind === 'day' ? (
                            <ActivityDayBlock
                                key={`day:${item.date}`}
                                day={item.day}
                                peak={peak}
                                formatCurrency={formatCurrency}
                                mask={mask}
                                maskSymbol={maskSymbol}
                            />
                        ) : (
                            <ActivityGroupBlock
                                key={`group:${item.group.type}:${item.group.symbol}`}
                                group={item.group}
                                peak={peak}
                                formatCurrency={formatCurrency}
                                mask={mask}
                                maskSymbol={maskSymbol}
                            />
                        )
                    )}
                </div>
            )}

        </Panel>
    );
};
