"use client";

import React, { useCallback, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DISPLAY } from '../../utils/typography';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
    key: K;
    direction: SortDirection;
}

/**
 * Column sorting for the allocation tables.
 *
 * Clicking the active column flips it; clicking a new one adopts that column's own
 * natural direction rather than carrying the previous one over -- a share column wants
 * the largest first, a symbol column wants A first, and inheriting `asc` from a name
 * click would open the numbers at their least interesting end.
 */
export function useTableSort<K extends string>(initial: SortState<K>) {
    const [sort, setSort] = useState<SortState<K>>(initial);

    const toggle = useCallback((key: K, naturalDirection: SortDirection) => {
        setSort((prev) =>
            prev.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: naturalDirection }
        );
    }, []);

    return { sort, toggle };
}

/** Applies a sort to a copy, so the caller's memoized array is never mutated. */
export function sortRows<T, K extends string>(
    rows: T[],
    sort: SortState<K>,
    valueOf: (row: T, key: K) => string | number | null | undefined
): T[] {
    const sign = sort.direction === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
        const av = valueOf(a, sort.key);
        const bv = valueOf(b, sort.key);

        // A column with no reading -- an unset custom weight, a symbol outside the index
        // -- sinks to the bottom whichever way the sort runs. Ordering it as zero would
        // rank "no answer" against real ones.
        const aMissing = av == null;
        const bMissing = bv == null;
        if (aMissing || bMissing) return aMissing && bMissing ? 0 : aMissing ? 1 : -1;

        if (typeof av === 'string' || typeof bv === 'string') {
            return String(av).localeCompare(String(bv)) * sign;
        }
        return (av - bv) * sign;
    });
}

interface SortHeaderProps<K extends string> {
    label: string;
    sortKey: K;
    sort: SortState<K>;
    onToggle: (key: K, naturalDirection: SortDirection) => void;
    /** Where this column opens when first clicked. Numbers want 'desc'; names want 'asc'. */
    naturalDirection?: SortDirection;
    align?: 'left' | 'right';
    className?: string;
}

export function SortHeader<K extends string>({
    label,
    sortKey,
    sort,
    onToggle,
    naturalDirection = 'desc',
    align = 'right',
    className,
}: SortHeaderProps<K>) {
    const active = sort.key === sortKey;
    const Caret = active && sort.direction === 'asc' ? ChevronUp : ChevronDown;

    return (
        <th
            className={clsx('px-3.5 py-2.5', className)}
            aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <button
                type="button"
                onClick={() => onToggle(sortKey, naturalDirection)}
                style={DISPLAY}
                className={clsx(
                    'group inline-flex w-full items-center gap-1 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] transition-colors',
                    align === 'right' ? 'justify-end' : 'justify-start',
                    active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                )}
            >
                {label}
                {/* The caret only holds its column when that column is the one sorting;
                    elsewhere it surfaces on hover, so the header row stays quiet. */}
                <Caret
                    size={11}
                    className={clsx(
                        'shrink-0 transition-opacity',
                        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                    )}
                />
            </button>
        </th>
    );
}
