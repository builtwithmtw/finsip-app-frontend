"use client";

import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask } from '../context/PrivacyContext';
import { computeHoldings } from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, PanelHeader } from './Panel';

const HEADERS: { label: string; align: 'left' | 'right' }[] = [
    { label: 'Asset Symbol', align: 'left' },
    { label: 'Sector', align: 'left' },
    { label: 'Shares', align: 'right' },
    { label: 'Avg Cost', align: 'right' },
    { label: 'Invested', align: 'right' },
    { label: 'Portfolio %', align: 'right' },
];

const HoldingsTable: React.FC = () => {
    const formatCurrency = useCurrency();
    const mask = useMask();
    const { transactions, stocks } = usePortfolio();

    const holdings = useMemo(() =>
        computeHoldings(transactions)
            .map(h => ({
                ...h,
                totalInvested: h.totalCostBasis,
                sector: stocks.find(s => s.symbol === h.symbol)?.sector || 'Others',
            }))
            .sort((a, b) => b.totalInvested - a.totalInvested),
        [transactions, stocks]
    );

    const totalPortfolioValue = useMemo(() =>
        holdings.reduce((sum, h) => sum + h.totalInvested, 0),
        [holdings]
    );

    if (holdings.length === 0) return null;

    return (
        <Panel flush className="flex h-full flex-col">
            <div className="px-4 pt-4 lg:px-5 lg:pt-5">
                <PanelHeader title="Asset Allocation" caption="By Invested Cost" />
            </div>

            <div className="scrollbar-hide-auto flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                    {/* Sticky inside this pane's own scroller, so the headers stay put as a
                        long holdings list runs past them. */}
                    <thead className="sticky top-0 z-10 border-b border-slate-100 bg-white/85 backdrop-blur">
                        <tr>
                            {HEADERS.map(h => (
                                <th
                                    key={h.label}
                                    style={DISPLAY}
                                    className={[
                                        'px-4 py-3 text-[10px] font-semibold uppercase leading-none',
                                        'tracking-[0.18em] text-slate-400',
                                        h.align === 'right' ? 'text-right' : 'text-left',
                                    ].join(' ')}
                                >
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/70">
                        {holdings.map((stock) => {
                            const allocation = totalPortfolioValue > 0
                                ? (stock.totalInvested / totalPortfolioValue) * 100
                                : 0;

                            return (
                                <tr key={stock.symbol} className="group transition-colors hover:bg-slate-50/70">
                                    {/* The accent rail only paints on hover, so the resting table stays
                                        flat and the pointer has something to track. */}
                                    <td className="relative py-2.5 pl-4 pr-4">
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                        />
                                        <span
                                            className="text-[13px] font-semibold uppercase tracking-[-0.03em] text-slate-900"
                                            style={DISPLAY}
                                        >
                                            {mask(stock.symbol)}
                                        </span>
                                    </td>
                                    {/* Sector isn't masked -- it's a market classification, not a position. */}
                                    <td className="px-4 py-2.5">
                                        <span
                                            className="inline-flex rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-slate-500"
                                            style={DISPLAY}
                                        >
                                            {stock.sector}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                        {mask(stock.totalShares.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                                    </td>
                                    {/* Rounded to whole rupees: the paisa on an average cost is noise. */}
                                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                                        {formatCurrency(Math.round(stock.avgPrice)).replace(/^Rs\s*/, '')}
                                    </td>
                                    <td
                                        className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900"
                                        style={NUMERIC}
                                    >
                                        {formatCurrency(Math.round(stock.totalInvested)).replace(/^Rs\s*/, '')}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                                                <span
                                                    className="block h-full rounded-full bg-sky-500"
                                                    style={{ width: `${Math.min(allocation, 100)}%` }}
                                                />
                                            </span>
                                            <span
                                                className="w-12 text-right text-[13px] font-semibold tabular-nums text-slate-700"
                                                style={NUMERIC}
                                            >
                                                {allocation.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
};

export default HoldingsTable;
