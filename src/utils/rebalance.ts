import { type LiveHolding } from './holdings';

/** A target weight as set on the My Symbols tab, in that tab's order. */
export interface RebalanceTarget {
    symbol: string;
    weight: number;
}

export interface RebalanceRow {
    symbol: string;
    logo: string;
    price: number;
    /** False when the feed carried no price, so the row can't be traded. */
    isPriced: boolean;
    /** Shares held right now. */
    heldShares: number;
    currentValue: number;
    targetValue: number;
    /** Target weight rescaled so the funded rows sum to 100%. */
    targetShare: number;
    /** Share of the portfolio the market has made of it. */
    marketShare: number;
    /** Market share minus target share, in percentage points. */
    drift: number;
    action: 'buy' | 'sell' | 'hold';
    /** Whole shares to trade. Zero when the drift is smaller than one share. */
    tradeShares: number;
    tradeAmount: number;
}

export interface RebalancePlan {
    rows: RebalanceRow[];
    portfolioValue: number;
    sellTotal: number;
    buyTotal: number;
    /** Sale proceeds no whole share was cheap enough to absorb. */
    cashLeft: number;
    /** Held symbols the feed couldn't price; they're frozen at cost and can't be traded. */
    unpriced: string[];
    /** True when no target weight is set anywhere, so there is nothing to rebalance to. */
    unweighted: boolean;
}

const EMPTY: RebalancePlan = {
    rows: [],
    portfolioValue: 0,
    sellTotal: 0,
    buyTotal: 0,
    cashLeft: 0,
    unpriced: [],
    unweighted: true,
};

// Share counts and prices are floats, so floor() on an exact match can land one short.
const FUZZ = 1e-9;

/**
 * Works out the trades that move the portfolio from what the market has made of it back
 * onto the weights set on My Symbols.
 *
 * The plan is cash-neutral: overweight positions sell first, and those proceeds are what
 * fund the underweight buys, largest shortfall first. Only whole shares are traded, so
 * both sides round down -- selling less than the drift asks for is safer than selling
 * into a position, and a buy is never planned that the sales can't pay for. Whatever
 * cash no share was cheap enough to absorb is reported rather than spent, since topping
 * up past a target would just push the position back off the weight it was aiming at.
 *
 * A symbol the feed didn't price is left alone: its value is standing on cost basis, and
 * a trade sized off a stale number is worse than no trade.
 */
export function computeRebalance(
    holdings: LiveHolding[],
    targets: RebalanceTarget[],
    livePrices: Record<string, number>,
    logos: Map<string, string> = new Map()
): RebalancePlan {
    const totalWeight = targets.reduce((sum, t) => sum + (t.weight > 0 ? t.weight : 0), 0);
    const portfolioValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

    if (!(totalWeight > 0) || !(portfolioValue > 0)) {
        return { ...EMPTY, portfolioValue, unweighted: !(totalWeight > 0) };
    }

    const held = new Map(holdings.map((h) => [h.symbol.toUpperCase(), h]));
    const weightOf = new Map(
        targets.filter((t) => t.weight > 0).map((t) => [t.symbol.toUpperCase(), t.weight])
    );

    // A weighted symbol that isn't held yet is a buy, and a held symbol with no weight is
    // a full exit -- both are part of the plan, so the table is the union of the two.
    const symbols = Array.from(new Set([...weightOf.keys(), ...held.keys()]));

    const rows: RebalanceRow[] = symbols.map((symbol) => {
        const holding = held.get(symbol);
        const weight = weightOf.get(symbol) ?? 0;

        const price = holding?.currentPrice || livePrices[symbol] || 0;
        // Only a held symbol can be unpriced in a way that matters: an unheld one with no
        // price simply can't be bought, and it says so through the same badge.
        const isPriced = price > 0;

        const currentValue = holding?.marketValue ?? 0;
        const targetValue = (weight / totalWeight) * portfolioValue;

        const targetShare = (weight / totalWeight) * 100;
        const marketShare = (currentValue / portfolioValue) * 100;

        return {
            symbol,
            logo: logos.get(symbol) ?? '',
            price,
            isPriced,
            heldShares: holding?.totalShares ?? 0,
            currentValue,
            targetValue,
            targetShare,
            marketShare,
            drift: marketShare - targetShare,
            action: 'hold',
            tradeShares: 0,
            tradeAmount: 0,
        };
    });

    // Sells first: they are the only source of cash the buy side gets to spend.
    let sellTotal = 0;
    for (const row of rows) {
        if (!row.isPriced) continue;

        const delta = row.targetValue - row.currentValue;
        if (delta >= 0) continue;

        const shares = Math.min(
            Math.floor(-delta / row.price + FUZZ),
            Math.floor(row.heldShares + FUZZ)
        );
        if (shares <= 0) continue;

        row.action = 'sell';
        row.tradeShares = shares;
        row.tradeAmount = shares * row.price;
        sellTotal += row.tradeAmount;
    }

    // Largest shortfall first, so a limited pot of proceeds closes the widest gap rather
    // than whichever row happened to sort first.
    const buys = rows
        .filter((r) => r.isPriced && r.targetValue - r.currentValue > 0)
        .sort((a, b) => (b.targetValue - b.currentValue) - (a.targetValue - a.currentValue));

    let cash = sellTotal;
    let buyTotal = 0;

    for (const row of buys) {
        const shortfall = row.targetValue - row.currentValue;
        const shares = Math.min(
            Math.floor(shortfall / row.price + FUZZ),
            Math.floor(cash / row.price + FUZZ)
        );
        if (shares <= 0) continue;

        row.action = 'buy';
        row.tradeShares = shares;
        row.tradeAmount = shares * row.price;
        buyTotal += row.tradeAmount;
        cash -= row.tradeAmount;
    }

    /**
     * Grouped by what you have to do, because that is how the plan gets executed: every
     * sell together (they fund the buys, so they happen first), then every buy, then the
     * holds that need no action at all and only have to be accounted for.
     *
     * Within a group the largest trade leads -- the rows that move the portfolio most are
     * the ones worth reading -- and holds fall back to target weight, having no trade to
     * be sorted by.
     */
    const ACTION_ORDER: Record<RebalanceRow['action'], number> = { sell: 0, buy: 1, hold: 2 };

    return {
        rows: rows.sort(
            (a, b) =>
                ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
                b.tradeAmount - a.tradeAmount ||
                b.targetShare - a.targetShare ||
                b.marketShare - a.marketShare
        ),
        portfolioValue,
        sellTotal,
        buyTotal,
        cashLeft: sellTotal - buyTotal,
        unpriced: rows.filter((r) => !r.isPriced && r.heldShares > 0).map((r) => r.symbol),
        unweighted: false,
    };
}
