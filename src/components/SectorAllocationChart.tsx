"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency } from '../context/PrivacyContext';
import { computeHoldings } from '../utils/holdings';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

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
        caption: { fontSize: `${Math.max(7, hole * 0.08)}px` },
        sector: { fontSize: `${Math.max(9, sectorSize)}px`, maxWidth: `${usableWidth}px` },
        percentage: { fontSize: `${Math.max(9, hole * 0.11)}px` },
    };

    const COLORS = [
        '#3B82F6', // Blue 500
        '#10B981', // Emerald 500
        '#6366F1', // Indigo 500
        '#F59E0B', // Amber 500
        '#EC4899', // Pink 500
        '#8B5CF6', // Violet 500
        '#06B6D4', // Cyan 500
        '#F43F5E', // Rose 500
    ];

    if (data.length === 0) return null;

    return (
        <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sector Exposure</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">By Invested Cost</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Invested</span>
                    <span className="text-base font-black text-slate-900 tracking-tight">
                        {formatCurrency(data.reduce((sum, item) => sum + item.value, 0)).split('.')[0]}
                    </span>
                </div>
            </div>

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
                                backgroundColor: '#0f172a',
                                opacity: 1,
                                color: '#fff',
                                borderRadius: '16px',
                                border: 'none',
                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)',
                                padding: '12px 16px'
                            }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                            formatter={(value: any, name: any) => [formatCurrency(Number(value || 0)).split('.')[0], name]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-0">
                    <span style={labelStyles.caption} className="font-black text-slate-400 uppercase tracking-widest block mb-1 leading-none">Top Sector</span>
                    <span style={labelStyles.sector} className="font-black text-slate-900 uppercase block leading-none mx-auto">{topSector}</span>
                    <span style={labelStyles.percentage} className="font-black text-blue-600 uppercase mt-1.5 block leading-none">{data[0]?.percentage.toFixed(1)}%</span>
                </div>
            </div>

            {/* Scrollable Legend Area */}
            <div className="shrink-0 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {data.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between group cursor-default">
                            <div className="flex items-center gap-3 truncate">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <span className="text-xs font-black text-slate-900">{item.percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SectorAllocationChart;