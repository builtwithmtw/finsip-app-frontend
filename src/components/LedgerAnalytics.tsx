"use client";

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { computeLiveHoldings, summarizeLive } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel, Panel, PanelHeader } from './Panel';

/** Emerald above zero, rose below, neutral at exactly nothing. */
const toneFor = (value: number) =>
    value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-900';

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

/**
 * The ledger's three standing figures -- the ones that are about the whole book
 * rather than the month on screen.
 *
 * Realized and unrealized are deliberately measured against different bases, and
 * each against its own: realized is scored on what the sold shares originally cost
 * (from `realized_pnl`, which stores the average buy price it was closed against),
 * unrealized on the cost of what is still held. Scoring both against one number
 * would make each percentage answer a question neither was asked.
 */
const LedgerAnalytics: React.FC = () => {
    const { transactions, realizedProfits, livePrices } = usePortfolio();
    const formatCurrency = useCurrency();

    // Every symbol the ledger has ever touched, buys and sells alike -- a symbol
    // bought and fully exited still counts, which is what makes this different from
    // the holdings count on Overview.
    const symbolsTraded = useMemo(
        () => new Set(transactions.map((t) => t.symbol).filter(Boolean)).size,
        [transactions]
    );

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

    if (transactions.length === 0) return null;

    return (
        <Panel className="mb-4 flex flex-col">
            <PanelHeader title="Analytics" caption="The Whole Book" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Tile label="Symbols Traded" caption="Till Today">
                    <span
                        className="block text-[17px] font-semibold leading-none tabular-nums text-slate-900"
                        style={NUMERIC}
                    >
                        {symbolsTraded}
                    </span>
                </Tile>

                <Tile
                    label="Realized Profit"
                    caption={realized.cost > 0 ? 'On Closed Positions' : 'Nothing Closed Yet'}
                >
                    <span className={clsx('flex items-baseline gap-2', toneFor(realized.profit))}>
                        <Amount value={formatCurrency(Math.round(realized.profit))} />
                        <span
                            className="text-[11px] font-semibold leading-none tabular-nums opacity-80"
                            style={NUMERIC}
                        >
                            {realized.percent >= 0 ? '+' : '−'}
                            {Math.abs(realized.percent).toFixed(2)}%
                        </span>
                    </span>
                </Tile>

                <Tile
                    label="Unrealized Profit"
                    caption={
                        // An unpriced symbol is held at cost, so it scores as flat rather
                        // than as a loss -- worth saying, because the figure is otherwise
                        // indistinguishable from a fully priced one.
                        unrealized.unpriced > 0
                            ? `${unrealized.unpriced} Unpriced, Held At Cost`
                            : 'On Open Positions'
                    }
                >
                    <span className={clsx('flex items-baseline gap-2', toneFor(unrealized.profit))}>
                        <Amount value={formatCurrency(Math.round(unrealized.profit))} />
                        <span
                            className="text-[11px] font-semibold leading-none tabular-nums opacity-80"
                            style={NUMERIC}
                        >
                            {unrealized.percent >= 0 ? '+' : '−'}
                            {Math.abs(unrealized.percent).toFixed(2)}%
                        </span>
                    </span>
                </Tile>
            </div>
        </Panel>
    );
};

export default LedgerAnalytics;
