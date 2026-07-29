"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { computeHoldings } from '../utils/holdings';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, PanelHeader, MetricLabel } from './Panel';
import { useShariah } from '../hooks/useShariah';
import { Amount } from './Amount';

const INNER_RADIUS_RATIO = 0.68;
const OUTER_RADIUS_RATIO = 0.92;

const SectorAllocationChart: React.FC = () => {
    const formatCurrency = useCurrency();
    const { transactions, stocks } = usePortfolio();

    // The donut sizes itself to the row, so the centre label has to follow it.
    const chartRef = useRef<HTMLDivElement>(null);
    const [holeSize, setHoleSize] = useState(0);

    const data = useMemo(() => {
        const sectorInvestedMap = new Map<string, number>();
        let totalInvestedValue = 0;

        computeHoldings(transactions).forEach(holding => {
            const amount = holding.totalCostBasis;
            const stock = stocks.find(s => s.symbol === holding.symbol);
            const sector = stock?.sector || 'Others';
            sectorInvestedMap.set(sector, (sectorInvestedMap.get(sector) || 0) + amount);
            totalInvestedValue += amount;
        });

        if (totalInvestedValue === 0) return [];

        return Array.from(sectorInvestedMap.entries())
            .map(([name, value]) => ({
                name,
                value,
                percentage: (value / totalInvestedValue) * 100
            }))
            .sort((a, b) => b.value - a.value);
    }, [transactions, stocks]);

    /**
     * Share of invested cost sitting in Shariah-compliant symbols, scored out of
     * 100. Weighted by money rather than by symbol count -- one large haram
     * position matters more than three small compliant ones.
     *
     * Compliance comes from the shared hook, which is the screener's own live
     * KMIALLSHR membership, so this score and the 🕌 badges never disagree.
     */
    const { isShariah } = useShariah();

    const shariah = useMemo(() => {
        let compliantCost = 0;
        let totalCost = 0;
        let compliantCount = 0;
        let totalCount = 0;

        computeHoldings(transactions).forEach(holding => {
            const cost = holding.totalCostBasis;
            totalCost += cost;
            totalCount += 1;
            if (isShariah(holding.symbol)) {
                compliantCost += cost;
                compliantCount += 1;
            }
        });

        return {
            score: totalCost > 0 ? (compliantCost / totalCost) * 100 : 0,
            compliantCount,
            totalCount,
        };
    }, [transactions, isShariah]);

    const hasData = data.length > 0;

    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;

        const observer = new ResizeObserver(entries => {
            const box = entries[0]?.contentRect;
            if (box) setHoleSize(Math.min(box.width, box.height) * INNER_RADIUS_RATIO);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasData]); // the card renders nothing until there's data, so re-attach once it appears

    // Everything in the centre is a fraction of the hole's diameter, so the label
    // shrinks in step with the donut. holeSize is 0 until the observer first fires.
    const hole = holeSize || 96;
    const topSector = data[0]?.name ?? '';

    // The label sits inside a circle, so only a chord of the hole is usable width.
    // Long sector names scale down to fit rather than getting clipped.
    const usableWidth = hole * 0.82;
    const approxCharWidth = 0.62; // ems, for this uppercase black face
    const sectorSize = Math.min(hole * 0.17, usableWidth / Math.max(topSector.length * approxCharWidth, 1));

    const labelStyles = {
        caption: { ...DISPLAY, fontSize: `${Math.max(7, hole * 0.08)}px` },
        sector: { ...DISPLAY, fontSize: `${Math.max(9, sectorSize)}px`, maxWidth: `${usableWidth}px` },
        percentage: { ...NUMERIC, fontSize: `${Math.max(9, hole * 0.13)}px` },
    };

    // Ordered so neighbouring arcs stay distinguishable rather than by hue wheel: the
    // largest sector leads with the panel's own sky accent, and each following colour
    // steps to a different part of the spectrum.
    const COLORS = [
        '#0EA5E9', // Sky 500
        '#10B981', // Emerald 500
        '#6366F1', // Indigo 500
        '#F59E0B', // Amber 500
        '#14B8A6', // Teal 500
        '#8B5CF6', // Violet 500
        '#F43F5E', // Rose 500
        '#64748B', // Slate 500
    ];

    // Fully compliant reads as green; anything short of it is a flag, not a failure,
    // so the middle band stays amber and only a mostly non-compliant book goes rose.
    const shariahTone =
        shariah.score >= 99.95 ? { text: 'text-emerald-600', bar: 'bg-emerald-500' }
            : shariah.score >= 50 ? { text: 'text-amber-600', bar: 'bg-amber-500' }
                : { text: 'text-rose-600', bar: 'bg-rose-500' };

    if (data.length === 0) return null;

    return (
        <Panel className="flex h-full flex-col">
            <PanelHeader title="Sector Exposure" caption="By Invested Cost">
                <MetricLabel label="Invested" className="justify-end" />
                <Amount
                    value={formatCurrency(Math.round(data.reduce((sum, item) => sum + item.value, 0)))}
                    size="text-lg"
                    className="mt-2 justify-end text-slate-900"
                />
            </PanelHeader>

            {/* Chart Container - donut scales with whatever height the row gives us */}
            <div ref={chartRef} className="relative flex-1 min-h-[140px] mb-3">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={`${INNER_RADIUS_RATIO * 100}%`}
                            outerRadius={`${OUTER_RADIUS_RATIO * 100}%`}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            isAnimationActive={true}
                        >
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    strokeWidth={0}
                                />
                            ))}
                        </Pie>
                        <Tooltip
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
                            labelStyle={{ display: 'none' }}
                            itemStyle={{
                                ...NUMERIC,
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600,
                            }}
                            formatter={(value: any, name: any) => [formatCurrency(Math.round(Number(value || 0))), name]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Centre readout: caption and sector in the display face, the share in mono
                    so it lines up with every other figure on the dashboard. */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 text-center">
                    <span
                        style={labelStyles.caption}
                        className="mb-1.5 block font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                    >
                        Top Sector
                    </span>
                    <span
                        style={labelStyles.sector}
                        className="mx-auto block font-semibold uppercase leading-none tracking-tight text-slate-900"
                    >
                        {topSector}
                    </span>
                    <span
                        style={labelStyles.percentage}
                        className="mt-2 block font-semibold leading-none tabular-nums text-sky-600"
                    >
                        {data[0]?.percentage.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Legend — a swatch, the name, and a share bar so it ranks the sectors on its
                own rather than making you read the donut. No scroller of its own: the donut
                above it flexes, so the legend simply takes the height it needs.

                The leader is skipped: the centre of the donut already names it and gives
                its share, so repeating it here is a duplicate row. Colours still come from
                the arc's own index, so every swatch matches its slice. */}
            {data.length > 1 && (
            <div className="shrink-0">
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {data.slice(1).map((item, i) => {
                        const index = i + 1;
                        const color = COLORS[index % COLORS.length];
                        return (
                            <div key={item.name} className="group flex cursor-default items-center gap-3">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                />
                                <span
                                    className="flex-1 truncate text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-500 transition-colors group-hover:text-slate-900"
                                    style={DISPLAY}
                                >
                                    {item.name}
                                </span>
                                <span className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                                    <span
                                        className="block h-full rounded-full"
                                        style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: color }}
                                    />
                                </span>
                                <span
                                    className="w-10 shrink-0 text-right text-[11px] font-semibold leading-none tabular-nums text-slate-900"
                                    style={NUMERIC}
                                >
                                    {item.percentage.toFixed(1)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            )}

            {/* Shariah score — the one figure here that isn't about sectors, but it reads
                off the same holdings and belongs next to them rather than in a card of
                its own. Weighted by cost, so it answers "how much of my money", not
                "how many of my tickers". */}
            <div className="mt-4 shrink-0 border-t border-slate-100 pt-3.5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <MetricLabel label="Shariah Compliance" />
                        <p
                            className="mt-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-400"
                            style={DISPLAY}
                        >
                            {shariah.compliantCount} of {shariah.totalCount} symbols
                        </p>
                    </div>
                    <span className="flex items-baseline gap-1">
                        <span
                            className={clsx(
                                'text-[17px] font-semibold leading-none tabular-nums',
                                shariahTone.text
                            )}
                            style={NUMERIC}
                        >
                            {shariah.score.toFixed(1)}
                        </span>
                        <span
                            className="text-[10px] font-semibold leading-none tabular-nums text-slate-400"
                            style={NUMERIC}
                        >
                            %
                        </span>
                    </span>
                </div>

                <span className="mt-2.5 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <span
                        className={clsx('block h-full rounded-full transition-[width] duration-500', shariahTone.bar)}
                        style={{ width: `${Math.min(shariah.score, 100)}%` }}
                    />
                </span>
            </div>
        </Panel>
    );
};

export default SectorAllocationChart;