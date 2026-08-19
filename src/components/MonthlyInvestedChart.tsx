"use client";

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, usePrivacy } from '../context/PrivacyContext';
import { compactNumber, formatMonth } from '../utils/formatters';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel, Panel, PanelHeader } from './Panel';

interface Point {
    month: string; // YYYY-MM
    label: string;
    /** Everything the month moved: buys plus sells, not their difference. */
    total: number;
    buy: number;
    sell: number;
}

const TOTAL = '#0EA5E9'; // Sky 500
const BUY = '#10B981';   // Emerald 500
const SELL = '#F43F5E';  // Rose 500

const monthKey = (date: Date) => format(date, 'yyyy-MM');

/** Every month from the first to the last, so a skipped month reads as a gap, not a jump. */
const monthRange = (first: string, last: string): string[] => {
    const cursor = parseISO(`${first}-01`);
    const end = parseISO(`${last}-01`);
    const out: string[] = [];

    while (cursor <= end && out.length < 600) {
        out.push(monthKey(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return out;
};

/**
 * What each month moved, as three bars: everything traded, the buying inside it, and
 * the selling. Sells are drawn as their own positive bar rather than as a dip below
 * zero -- at a glance the question is how much went each way, and two directions on
 * one axis answers it faster than one signed line did.
 *
 * Deliberately not cumulative: a running total only ever rises and would say nothing
 * about whether the SIP was kept up, which is what the ledger is read to answer.
 *
 * Everything is drawn from the ledger, so every month is exact. There is no price
 * history behind this -- the app only ever holds a live snapshot.
 */
const MonthlyInvestedChart: React.FC = () => {
    const { transactions, selectedMonth } = usePortfolio();
    const formatCurrency = useCurrency();
    const { hidden } = usePrivacy();

    const points: Point[] = useMemo(() => {
        const buys = new Map<string, number>();
        const sells = new Map<string, number>();

        transactions
            .filter((t) => t.shares > 0 && t.pricePerShare > 0)
            .forEach((t) => {
                const amount = Number(t.totalAmount || t.shares * t.pricePerShare);
                const side = t.type === 'buy' ? buys : sells;
                side.set(t.month, (side.get(t.month) ?? 0) + amount);
            });

        const months = Array.from(new Set([...buys.keys(), ...sells.keys()])).sort();
        if (months.length === 0) return [];

        return monthRange(months[0], months[months.length - 1]).map((month) => {
            const buy = Math.round(buys.get(month) ?? 0);
            const sell = Math.round(sells.get(month) ?? 0);
            return {
                month,
                label: format(parseISO(`${month}-01`), "MMM ''yy"),
                total: buy + sell,
                buy,
                sell,
            };
        });
    }, [transactions]);

    if (points.length < 2) return null;

    const invested = points.reduce((sum, p) => sum + p.buy, 0);
    // Averaged over the months that actually bought: a run of untouched months would
    // otherwise drag the figure down and read as a smaller SIP than was paid.
    const funded = points.filter((p) => p.buy > 0);
    const average = funded.length > 0 ? invested / funded.length : 0;

    return (
        <Panel className="flex flex-col">
            <PanelHeader title="Monthly Flow" caption="Traded, Bought, Sold">
                <MetricLabel label="Avg Buy / Funded Month" className="justify-end" />
                <Amount
                    value={formatCurrency(Math.round(average))}
                    size="text-lg"
                    className="mt-2 justify-end text-slate-900"
                />
            </PanelHeader>

            {/* Hand-rolled rather than recharts' <Legend>, so it sits in the panel's own
                voice above the plot instead of stealing a row from it. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {[
                    { label: 'Total', color: TOTAL },
                    { label: 'Bought', color: BUY },
                    { label: 'Sold', color: SELL },
                ].map((item) => (
                    <span key={item.label} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span
                            className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-500"
                            style={DISPLAY}
                        >
                            {item.label}
                        </span>
                    </span>
                ))}
            </div>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={2}>
                        <CartesianGrid stroke="#E2E8F0" strokeDasharray="2 4" vertical={false} />

                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ ...DISPLAY, fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                            // A long ledger would otherwise stack its labels on top of each other.
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />

                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={hidden ? 12 : 48}
                            // The axis is a currency figure like any other, so it goes dark
                            // with the rest of them rather than leaking the scale.
                            tickFormatter={(value: number) => (hidden ? '' : compactNumber(value))}
                            tick={{ ...NUMERIC, fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                        />

                        <Tooltip
                            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                            wrapperStyle={{ zIndex: 100 }}
                            contentStyle={{
                                backgroundColor: '#020617',
                                opacity: 1,
                                color: '#fff',
                                borderRadius: '14px',
                                border: '1px solid rgba(255,255,255,0.10)',
                                boxShadow: '0 16px 40px -24px rgba(2,6,23,0.9)',
                                padding: '10px 14px',
                            }}
                            labelStyle={{
                                ...DISPLAY,
                                color: '#94A3B8',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.18em',
                                marginBottom: '6px',
                            }}
                            itemStyle={{ ...NUMERIC, color: '#fff', fontSize: '12px', fontWeight: 600 }}
                            labelFormatter={(_label, payload) =>
                                formatMonth(payload?.[0]?.payload?.month ?? '')
                            }
                            formatter={(value, name) => [formatCurrency(Number(value || 0)), name]}
                        />

                        {/* The month the rest of the ledger is showing is drawn solid and the
                            rest are dimmed, so the chart and the table below it agree on where
                            you are without a second highlight of its own. */}
                        {[
                            { key: 'total', name: 'Total', color: TOTAL },
                            { key: 'buy', name: 'Bought', color: BUY },
                            { key: 'sell', name: 'Sold', color: SELL },
                        ].map((series) => (
                            <Bar
                                key={series.key}
                                dataKey={series.key}
                                name={series.name}
                                fill={series.color}
                                radius={[3, 3, 0, 0]}
                                maxBarSize={14}
                            >
                                {points.map((p) => (
                                    <Cell
                                        key={p.month}
                                        fill={series.color}
                                        fillOpacity={!selectedMonth || p.month === selectedMonth ? 1 : 0.45}
                                    />
                                ))}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
};

export default MonthlyInvestedChart;
