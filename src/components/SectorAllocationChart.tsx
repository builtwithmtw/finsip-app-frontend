import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import { computeHoldings } from '../utils/holdings';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const SectorAllocationChart: React.FC = () => {
    const { transactions, stocks } = usePortfolio();

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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Diversification Analytics</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Pool Value</span>
                    <span className="text-base font-black text-slate-900 tracking-tight">
                        {formatCurrency(data.reduce((sum, item) => sum + item.value, 0)).split('.')[0]}
                    </span>
                </div>
            </div>

            {/* Chart Container - Fixed size to maintain symmetry */}
            <div className="relative flex-1 min-h-[190px] mb-3">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={75}
                            outerRadius={100}
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Top Sector</span>
                    <span className="text-lg font-black text-slate-900 uppercase truncate max-w-[120px] block leading-none">{data[0]?.name}</span>
                    <span className="text-xs font-black text-blue-600 uppercase mt-2 block">{data[0]?.percentage.toFixed(1)}%</span>
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
