"use client";

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask, usePartialMask } from '../context/PrivacyContext';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';
import { computeSipStreak, computeSipWindow, computeSipDays, sipWindowFromDays } from '../utils/sipStreak';
import { describeMonthActivity } from '../utils/monthNarrative';
import { computeXirr, buildPortfolioFlows } from '../utils/xirr';
import { useSipDeposits } from '../hooks/useSipDeposits';
import { splitMonthActivity, type ActivityDay, type SoloGroup } from '../utils/monthActivity';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel, Panel, PanelHeader } from './Panel';
import SipHistoryModal from './SipHistoryModal';
import DepositsModal from './DepositsModal';

/** Emerald above zero, rose below, neutral at exactly nothing. */
const toneFor = (value: number) =>
    value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-900';

/** The strip shows a year at a time: enough to read a habit, short enough to stay legible. */
const STRIP_MONTHS = 12;

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM ''yy");

/** 1 -> "1st", 22 -> "22nd". The teens are the exception every naive version gets wrong. */
const ordinal = (day: number): string => {
    if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
    if (day % 10 === 1) return `${day}st`;
    if (day % 10 === 2) return `${day}nd`;
    if (day % 10 === 3) return `${day}rd`;
    return `${day}th`;
};

// `caption` is optional: a figure that speaks for itself takes the card without a
// qualifying line under it, rather than one padded out with something to say.
const Tile: React.FC<{ label: string; caption?: string; children: React.ReactNode }> = ({
    label,
    caption,
    children,
}) => (
    <div className="rounded-xl bg-slate-50/70 px-3.5 py-3 ring-1 ring-slate-900/5">
        <MetricLabel label={label} />
        <div className="mt-2.5">{children}</div>
        {caption && (
            <p
                className="mt-2 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                style={DISPLAY}
            >
                {caption}
            </p>
        )}
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
    const { deposits } = useSipDeposits();

    /**
     * Money handed to the broker, as recorded. Only 'deposit' rows count -- a
     * reconciliation corrects a balance rather than funding one.
     */
    const totalDeposits = useMemo(
        () => deposits.filter((d) => d.kind === 'deposit').reduce((sum, d) => sum + d.amount, 0),
        [deposits]
    );

    /**
     * Everything that reached the account without you sending it: dividends the holdings
     * paid, and the corrections that keep the balance agreeing with the broker.
     *
     * Both belong in cash and in nothing else. A dividend is money the portfolio earned,
     * so counting it as a contribution would measure the return against capital you
     * never supplied -- on this book that one entry was the difference between reading
     * -1.83% and +3.82% a year. A correction counted the same way would credit you for
     * having been wrong about a balance.
     */
    const totalReconciled = useMemo(
        () =>
            deposits
                .filter((d) => d.kind === 'reconciliation' || d.kind === 'dividend')
                .reduce((sum, d) => sum + d.amount, 0),
        [deposits]
    );


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

    /**
     * The SIP each month.
     *
     * Read straight off the recorded deposits when there are any: they say what was
     * transferred and on what day, which is the fact these figures are about. The
     * trade-derived version below is the fallback for a book that has not recorded them
     * -- it takes each month's heaviest buying day as a stand-in, which is a good guess
     * and only ever a guess.
     *
     * Corrections are excluded. A reconciliation is not a contribution and would drag
     * the average toward zero if counted as one.
     */
    const sipMonths = useMemo(() => {
        const recorded = deposits.filter((d) => d.kind === 'deposit');

        if (recorded.length === 0) return computeSipDays(transactions);

        // One row per deposit rather than per month: two transfers in a month are two
        // SIPs, and folding them together would report an instalment nobody made.
        return recorded
            .map((d) => ({
                month: d.date.slice(0, 7),
                day: Number(d.date.slice(8, 10)) || null,
                amount: d.amount,
                monthTotal: d.amount,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [deposits, transactions]);

    /**
     * What a contribution typically is, averaged over the months that had one.
     *
     * Straight off `sipMonths`, which is the recorded deposits wherever there are any,
     * so this is what was actually transferred rather than what a month's buying implies
     * about it.
     *
     * Still only the months that were funded: a skipped month contributed nothing, and
     * letting it pull the figure down would answer "how much do I invest per calendar
     * month" when the question here is "when I do fund the SIP, what does it cost me".
     * The streak strip directly above already says how often the plan was kept.
     */
    const averageSip = useMemo(() => {
        if (sipMonths.length === 0) return 0;
        return sipMonths.reduce((sum, m) => sum + m.amount, 0) / sipMonths.length;
    }, [sipMonths]);

    /**
     * When in the month the money goes in, off the same rows the average is taken from,
     * so the two cards can never disagree about which dates they are describing.
     */
    const sipWindow = useMemo(() => {
        const recorded = deposits.filter((d) => d.kind === 'deposit');

        if (recorded.length === 0) return computeSipWindow(transactions);

        return sipWindowFromDays(
            recorded
                .map((d) => Number(d.date.slice(8, 10)))
                .filter((day) => Number.isFinite(day) && day >= 1 && day <= 31)
        );
    }, [deposits, transactions]);

    const [sipHistoryOpen, setSipHistoryOpen] = useState(false);
    const [xirrOpen, setXirrOpen] = useState(false);

    const realized = useMemo(() => {
        let profit = 0;
        let cost = 0;

        realizedProfits.forEach((p) => {
            profit += Number(p.realizedProfit || 0);
            cost += Number(p.quantitySold || 0) * Number(p.avgBuyPrice || 0);
        });

        return { profit, percent: cost > 0 ? (profit / cost) * 100 : 0, cost };
    }, [realizedProfits]);

    const liveTotals = useMemo(
        () => summarizeLive(computeLiveHoldings(transactions, livePrices)),
        [transactions, livePrices]
    );
    /**
     * What is not in the market: deposits less the cost of what is currently held.
     *
     * Deliberately the plain subtraction of the two figures beside it, so the footer ties
     * out by eye -- a reader can check it without being told what else went into it.
     *
     * It therefore reads cost basis, not cash: money made on a sale is not counted until
     * it is spent again, because the invested figure it is subtracted from only ever
     * knows what shares cost. The reconciliations are then added on top, which is exactly
     * what they are for -- each one is the gap between this arithmetic and what the
     * broker actually says, written down so the two agree.
     *
     * Null until deposits exist, since without them this is just the negative of the
     * cost basis and would read as an overdraft rather than an unknown.
     */
    const cashAvailable = useMemo(
        () =>
            deposits.length === 0
                ? null
                : totalDeposits - liveTotals.totalCost + totalReconciled,
        [deposits.length, totalDeposits, totalReconciled, liveTotals.totalCost]
    );

    const unrealized = useMemo(
        () => ({
            profit: liveTotals.totalPL,
            percent: liveTotals.totalCost > 0 ? (liveTotals.totalPL / liveTotals.totalCost) * 100 : 0,
            unpriced: liveTotals.unpricedCount,
        }),
        [liveTotals]
    );

    /**
     * The annualised return the book has actually earned.
     *
     * The one figure here that accounts for *when* the money went in. Profit over cost
     * treats a rupee invested last month and one invested two years ago as the same
     * rupee, which for a SIP -- where the whole point is that money arrives in
     * instalments -- flatters a young book and punishes a patient one. XIRR discounts
     * every contribution by how long it was actually working.
     *
     * Scored against what the holdings are worth right now, so it moves with the market
     * like the unrealized figure above it does.
     */
    const xirrData = useMemo(
        () => buildPortfolioFlows(transactions, liveTotals.totalValue, deposits, cashAvailable),
        [transactions, liveTotals.totalValue, deposits, cashAvailable]
    );

    const xirrFlows = xirrData.flows;
    const xirr = useMemo(() => computeXirr(xirrFlows), [xirrFlows]);

    /*
     * The month the clock starts: the first contribution, which for a backfilled month
     * is the month it was filed under and not the day it was typed in. Shown on the card
     * because "since when" is the first thing anyone asks of an annualised figure, and
     * an unlabelled percentage invites the reader to assume the wrong period.
     */
    const xirrSince = useMemo(() => {
        if (xirrFlows.length === 0) return null;
        const earliest = Math.min(...xirrFlows.map((f) => f.date.getTime()));
        return format(new Date(earliest), 'MMM yyyy');
    }, [xirrFlows]);

    return (
        <Panel className="flex h-full flex-col">
            <PanelHeader title="Returns" caption="The Whole Book" />

            <div className="flex flex-col gap-3">
                {/* Cash rather than deposits, because this is the only figure on the panel
                    that can be acted on today: it is what is available to buy with. The
                    deposits it was derived from -- along with invested and worth -- are a
                    tap away in the ledger this opens. */}
                <button
                    type="button"
                    onClick={() => setXirrOpen(true)}
                    title="Record and review your deposits"
                    className="rounded-xl text-left transition-opacity hover:opacity-80"
                >
                    <Tile
                        label="Cash Available"
                        caption={
                            cashAvailable === null
                                ? 'Record Deposits To See It'
                                : 'With Your Broker · Tap For Detail'
                        }
                    >
                        {cashAvailable === null ? (
                            <span
                                className="block text-[17px] font-semibold leading-none tabular-nums text-slate-300"
                                style={NUMERIC}
                            >
                                —
                            </span>
                        ) : (
                            // Negative means the ledger says you have spent more than
                            // reached the account -- a missing deposit, not an overdraft.
                            <span className={clsx(cashAvailable < 0 && 'text-rose-600')}>
                                <Amount value={formatCurrency(Math.round(cashAvailable))} />
                            </span>
                        )}
                    </Tile>
                </button>

                {/* Realized profit is not shown. Everything closed on this book was put
                    straight back to work, so it is not a result sitting beside the
                    portfolio -- it is already inside it, in the shares it bought and in
                    the XIRR above. Reporting it separately would invite it to be added to
                    a total it is already part of. */}

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

                {/* Sits under the two profit figures because it is the answer they raise:
                    they say how much was made, this says whether that was any good for
                    the time the money spent in the market. */}
                <button
                    type="button"
                    onClick={() => setXirrOpen(true)}
                    title="See every cashflow behind this"
                    className="rounded-xl text-left transition-opacity hover:opacity-80"
                >
                <Tile
                    label="XIRR"
                    caption={
                        xirr === null
                            ? 'Needs A Deposit And A Value'
                            : xirrSince
                                // Names its basis, because the same book has a different
                                // rate measured on deposits and the two are both right.
                                ? `Since ${xirrSince}`
                                : 'Annualised'
                    }
                >
                    {xirr === null ? (
                        <span
                            className="block text-[17px] font-semibold leading-none tabular-nums text-slate-300"
                            style={NUMERIC}
                        >
                            —
                        </span>
                    ) : (
                        <span
                            className={clsx(
                                'block text-[17px] font-semibold leading-none tabular-nums',
                                toneFor(xirr)
                            )}
                            style={NUMERIC}
                        >
                            {xirr >= 0 ? '+' : '−'}
                            {Math.abs(xirr * 100).toFixed(2)}%
                        </span>
                    )}
                </Tile>
                </button>

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

            {/* What the plan actually costs, in the same card dress as the figures at the
                top of the panel. It sits under the streak because it reads off it: the
                strip says how many months were funded, this says what one of them is
                worth. Guarded on fundedCount rather than totalMonths so it never has to
                render a division by zero -- a ledger holding only sells has months but no
                contribution to average.

                The two sit side by side: they answer one question between them -- how
                much, and when -- and reading them as a pair is the point. Alone, Average
                SIP keeps the full width rather than leaving half the row empty. */}
            {streak.fundedCount > 0 && (
                <div className={clsx('mt-3.5 grid gap-3', sipWindow ? 'grid-cols-2' : 'grid-cols-1')}>
                    {/* The one tile here that opens: an average is a summary of months,
                        and "which months" is the question it raises. */}
                    <button
                        type="button"
                        onClick={() => setSipHistoryOpen(true)}
                        title="See every month's SIP"
                        className="rounded-xl text-left transition-opacity hover:opacity-80"
                    >
                        <Tile label="Average SIP">
                            <Amount value={formatCurrency(Math.round(averageSip))} />
                        </Tile>
                    </button>

                    {/* When in the month it actually goes in. Not masked: a date is not a
                        figure, and hiding it would say nothing to anyone looking over your
                        shoulder that the streak strip does not already say. */}
                    {sipWindow && (
                        <button
                            type="button"
                            onClick={() => setSipHistoryOpen(true)}
                            title={
                                sipWindow.outliers > 0
                                    ? `Covers ${sipWindow.months} of ${sipWindow.total} months — see every one`
                                    : "See every month's SIP date"
                            }
                            className="rounded-xl text-left transition-opacity hover:opacity-80"
                        >
                            <Tile label="SIP Date Range">
                                <span
                                    className="block text-[17px] font-semibold leading-none tabular-nums text-slate-900"
                                    style={NUMERIC}
                                >
                                    {sipWindow.earliest === sipWindow.latest
                                        ? ordinal(sipWindow.earliest)
                                        : `${ordinal(sipWindow.earliest)} – ${ordinal(sipWindow.latest)}`}
                                </span>
                            </Tile>
                        </button>
                    )}
                </div>
            )}

            <SipHistoryModal
                isOpen={sipHistoryOpen}
                onClose={() => setSipHistoryOpen(false)}
                months={sipMonths}
                average={averageSip}
            />

            <DepositsModal
                isOpen={xirrOpen}
                onClose={() => setXirrOpen(false)}
                rate={xirr}
                invested={liveTotals.totalCost}
                worth={liveTotals.totalValue}
                reconciled={totalReconciled}
                cashAvailable={cashAvailable}
            />
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
