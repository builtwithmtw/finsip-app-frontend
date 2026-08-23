"use client";

import { useMemo } from 'react';

/** Only the top slice by weight gets funded; the tail is too small to buy a share of. */
export const MAX_ALLOCATION_HOLDINGS = 15;

export interface AllocationInput {
    name: string;
    weight: number;
    price: number;
    logo?: string;
    /** Opaque handle for the caller to map a row back to its source row. */
    id?: string;
}

export interface AllocationRow {
    name: string;
    weight: number;
    price: number;
    logo: string;
    id?: string;
    shares: number;
    finalAmount: number;
    /** Weight rescaled so the funded rows sum to 100%. */
    normalizedWeight: number;
    targetAmount: number;
    /** Cash the row was short of its target after buying whole shares. */
    leftover: number;
}

export interface AllocationResult {
    results: AllocationRow[];
    finalTotal: number;
    cashLeft: number;
    topTotalAmount: number;
    topTotalShares: number;
    topTotalWeights: number;
    topTotalNormalizedWeights: number;
}

const EMPTY: AllocationResult = {
    results: [],
    finalTotal: 0,
    cashLeft: 0,
    topTotalAmount: 0,
    topTotalShares: 0,
    topTotalWeights: 0,
    topTotalNormalizedWeights: 0,
};

/**
 * Splits `investment` across the highest-weighted companies, buying whole shares only.
 *
 * Weights are normalized across the funded rows, each row buys as many whole shares as
 * its share of the money allows, and whatever cash is left over is then spent on the
 * rows that fell furthest short of their target.
 */
function calculateAllocations(
    companies: AllocationInput[],
    investment: number,
    /** How many of the highest-weighted rows get funded. Defaults to the usual cap. */
    limit: number = MAX_ALLOCATION_HOLDINGS
): AllocationResult {
    if (!companies.length) return EMPTY;

    const results: AllocationRow[] = companies.slice(0, limit).map((c) => ({
        name: c.name,
        weight: c.weight,
        price: c.price,
        logo: c.logo ?? '',
        id: c.id,
        shares: 0,
        finalAmount: 0,
        normalizedWeight: 0,
        targetAmount: 0,
        leftover: 0,
    }));

    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    // Every weight zero (or unparseable) would make each normalized weight NaN and poison
    // the whole table, so bail out to a priced-but-unfunded view instead.
    if (!(totalWeight > 0)) {
        return { ...EMPTY, results, cashLeft: Math.round(investment) };
    }

    results.forEach((r) => {
        r.normalizedWeight = (r.weight / totalWeight) * 100;
    });

    let invested = 0;
    results.forEach((r) => {
        const targetAmount = (r.normalizedWeight / 100) * investment;
        // A suspended stock comes back from the feed priced at 0. Dividing by it yields
        // Infinity shares, and the top-up loop below would never terminate.
        const possibleShares = r.price > 0 ? Math.floor(targetAmount / r.price) : 0;

        r.shares = possibleShares;
        r.finalAmount = possibleShares * r.price;
        r.targetAmount = targetAmount;
        r.leftover = targetAmount - r.finalAmount;
        invested += r.finalAmount;
    });

    let cashLeft = investment - invested;

    const candidates = results
        .filter((r) => r.price > 0 && r.price <= cashLeft)
        .sort((a, b) => b.leftover - a.leftover);

    for (const r of candidates) {
        while (cashLeft >= r.price) {
            r.shares += 1;
            r.finalAmount += r.price;
            cashLeft -= r.price;
        }
    }

    const finalTotal = results.reduce((sum, r) => sum + r.finalAmount, 0);

    return {
        results,
        finalTotal: Math.round(finalTotal),
        cashLeft: Math.round(cashLeft),
        topTotalAmount: finalTotal,
        topTotalShares: results.reduce((s, r) => s + r.shares, 0),
        topTotalWeights: results.reduce((s, r) => s + r.weight, 0),
        topTotalNormalizedWeights: results.reduce((s, r) => s + r.normalizedWeight, 0),
    };
}

export function useAllocations(
    companies: AllocationInput[] = [],
    investment = 0,
    limit: number = MAX_ALLOCATION_HOLDINGS
): AllocationResult {
    return useMemo(
        () => calculateAllocations(companies, investment, limit),
        [companies, investment, limit]
    );
}