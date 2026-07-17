"use client";

import React from 'react';
import clsx from 'clsx';

/**
 * Placeholder that mirrors the real layout, so content lands in the same place it
 * was pulsing -- no spinner-then-jump.
 */
export const SkeletonBar: React.FC<{ className?: string }> = ({ className }) => (
    <div className={clsx('bg-slate-100 rounded animate-pulse', className)} />
);

export const SkeletonCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={clsx('bg-white p-4 lg:p-5 rounded-xl border border-slate-100 shadow-sm', className)}>
        {children}
    </div>
);

export const SkeletonTableRows: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
    <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, row) => (
            <div key={row} className="flex items-center gap-4">
                {Array.from({ length: cols }).map((_, col) => (
                    <SkeletonBar
                        key={col}
                        className={clsx('h-4', col === 0 ? 'w-20 shrink-0' : 'flex-1')}
                    />
                ))}
            </div>
        ))}
    </div>
);

const DashboardSkeleton: React.FC = () => (
    <div className="flex flex-col gap-4 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <SkeletonCard className="lg:col-span-7">
                <div className="flex items-center justify-between mb-5">
                    <div className="space-y-2">
                        <SkeletonBar className="h-5 w-44" />
                        <SkeletonBar className="h-2.5 w-28" />
                    </div>
                    <SkeletonBar className="h-11 w-28 rounded-lg" />
                </div>
                <SkeletonTableRows rows={5} cols={5} />
            </SkeletonCard>

            <SkeletonCard className="lg:col-span-5 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-5">
                    <div className="space-y-2">
                        <SkeletonBar className="h-5 w-40" />
                        <SkeletonBar className="h-2.5 w-32" />
                    </div>
                    <SkeletonBar className="h-11 w-28 rounded-lg" />
                </div>
                <SkeletonBar className="w-44 h-44 rounded-full shrink-0" />
                <div className="w-full mt-6 space-y-2.5">
                    <SkeletonBar className="h-3 w-full" />
                    <SkeletonBar className="h-3 w-4/5" />
                </div>
            </SkeletonCard>
        </div>

        <SkeletonCard>
            <SkeletonBar className="h-10 w-full rounded-lg" />
        </SkeletonCard>
    </div>
);

export default DashboardSkeleton;