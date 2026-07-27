"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { computeHoldings } from '../utils/holdings';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, PanelHeader, MetricLabel } from './Panel';
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
                above it flexes, so the legend simply takes the height it needs. */}
            <div className="shrink-0">
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {data.map((item, index) => {
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
        </Panel>
    );
};

export default SectorAllocationChart;