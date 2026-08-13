"use client";

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, usePrivacy } from '../context/PrivacyContext';
import { formatMonth } from '../utils/formatters';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Amount } from './Amount';
import { MetricLabel, Panel, PanelHeader } from './Panel';

interface Point {
    month: string; // YYYY-MM
    label: string;
    net: number;
}

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

// 1,250,000 -> 1.3m, 120,000 -> 120k. The axis is for scale, not for reading exact figures.
const compact = (value: number): string => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);

    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
    return `${sign}${Math.round(abs)}`;
};

/**
 * New money in per month -- buys minus sells, so a month that sold more than it bought
 * dips below zero. Deliberately not cumulative: a running total only ever rises and
 * would say nothing about whether the SIP was kept up, which is the question the ledger
 * is being read to answer.
 *
 * Everything is drawn from the ledger, so every month is exact. There is no price
 * history behind this line -- the app only ever holds a live snapshot.
 */
const MonthlyInvestedChart: React.FC = () => {
    const { transactions, selectedMonth } = usePortfolio();
    const formatCurrency = useCurrency();
    const { hidden } = usePrivacy();

    const points: Point[] = useMemo(() => {
        const net = new Map<string, number>();

        transactions
            .filter((t) => t.shares > 0 && t.pricePerShare > 0)
            .forEach((t) => {
                const amount = Number(t.totalAmount || t.shares * t.pricePerShare);
                const signed = t.type === 'buy' ? amount : -amount;
                net.set(t.month, (net.get(t.month) ?? 0) + signed);
            });

        const months = Array.from(net.keys()).sort();
        if (months.length === 0) return [];

        return monthRange(months[0], months[months.length - 1]).map((month) => ({
            month,
            label: format(parseISO(`${month}-01`), "MMM ''yy"),
            net: Math.round(net.get(month) ?? 0),
        }));
    }, [transactions]);

    if (points.length < 2) return null;

    const total = points.reduce((sum, p) => sum + p.net, 0);
    // Averaged over the months that actually moved money: a run of untouched months
    // would otherwise drag the figure down and read as a smaller SIP than was paid.
    const funded = points.filter((p) => p.net !== 0);
    const average = funded.length > 0 ? total / funded.length : 0;
    const hasOutflow = points.some((p) => p.net < 0);

    return (
        <Panel className="mb-4 flex flex-col">
            <PanelHeader title="Monthly Flow" caption="Buys Less Sells">
                <MetricLabel label="Avg / Funded Month" className="justify-end" />
                <Amount
                    value={formatCurrency(Math.round(average))}
                    size="text-lg"
                    className="mt-2 justify-end text-slate-900"
                />
            </PanelHeader>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
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
                            tickFormatter={(value: number) => (hidden ? '' : compact(value))}
                            tick={{ ...NUMERIC, fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                        />

                        {/* Only drawn once a month has actually gone negative; on a buy-only
                            ledger the baseline is the axis and a second line is just noise. */}
                        {hasOutflow && <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1} />}

                        <Tooltip
                            cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }}
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
                            formatter={(value) => [formatCurrency(Number(value || 0)), 'Net In']}
                        />

                        <Line
                            type="monotone"
                            dataKey="net"
                            stroke="#0EA5E9"
                            strokeWidth={2}
                            // The month the rest of the ledger is showing gets the filled dot,
                            // so the chart and the table below it agree on where you are.
                            dot={(props: any) => {
                                const active = props.payload?.month === selectedMonth;
                                return (
                                    <circle
                                        key={props.payload?.month}
                                        cx={props.cx}
                                        cy={props.cy}
                                        r={active ? 4 : 2.5}
                                        fill={active ? '#0EA5E9' : '#fff'}
                                        stroke="#0EA5E9"
                                        strokeWidth={2}
                                    />
                                );
                            }}
                            activeDot={{ r: 5, strokeWidth: 0, fill: '#0EA5E9' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
};

export default MonthlyInvestedChart;
