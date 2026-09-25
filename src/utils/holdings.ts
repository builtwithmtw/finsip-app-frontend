import { type Transaction } from '../types';

export interface ComputedHolding {
    symbol: string;
    totalShares: number;
    totalCostBasis: number;
    avgPrice: number;
}

// Share counts are floats, so a fully sold position rarely lands on exactly 0.
const EPSILON = 0.001;

// Within a single month a buy must settle before a sell. Sorting on month alone
// leaves same-month transactions in DB order, so a sell can be applied to an
// empty position (zeroing it) and the buy that funded it then rebuilds the
// position from scratch, leaving a phantom holding for a stock sold in full.
const orderTransactions = (transactions: Transaction[]) =>
    [...transactions].sort((a, b) => {
        const byMonth = a.month.localeCompare(b.month);
        if (byMonth !== 0) return byMonth;
        if (a.type !== b.type) return a.type === 'buy' ? -1 : 1;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

export const computeHoldings = (transactions: Transaction[]): ComputedHolding[] => {
    const map = new Map<string, ComputedHolding>();
    const valid = transactions.filter(t => t.shares > 0 && t.pricePerShare > 0);

    orderTransactions(valid).forEach(t => {
        const current = map.get(t.symbol) || {
            symbol: t.symbol,
            totalShares: 0,
            totalCostBasis: 0,
            avgPrice: 0,
        };

        const shares = Number(t.shares || 0);
        const price = Number(t.pricePerShare || 0);
        const amount = Number(t.totalAmount || shares * price);

        if (t.type === 'buy') {
            current.totalShares += shares;
            current.totalCostBasis += amount;
        } else {
            const avgPriceBeforeSell = current.totalShares > 0
                ? current.totalCostBasis / current.totalShares
                : 0;
            current.totalShares -= shares;
            current.totalCostBasis -= shares * avgPriceBeforeSell;
        }

        // Nothing left: clamp away the float dust so no cost basis survives the exit.
        if (current.totalShares <= EPSILON) {
            current.totalShares = 0;
            current.totalCostBasis = 0;
        }

        map.set(t.symbol, current);
    });

    return Array.from(map.values())
        .filter(h => h.totalShares > EPSILON)
        .map(h => ({ ...h, avgPrice: h.totalCostBasis / h.totalShares }));
};

export interface LiveHolding extends ComputedHolding {
    currentPrice: number;
    /** False when the feed carried no price for this symbol (delisted, suspended, typo). */
    isPriced: boolean;
    marketValue: number;
    profitLoss: number;
    profitLossPercentage: number;
}

/**
 * Values holdings against the live feed. A symbol the feed didn't price is held at its
 * cost basis rather than at zero -- pricing it at zero would wipe the position out of
 * the portfolio total and report its entire cost as a loss.
 */
export const computeLiveHoldings = (
    transactions: Transaction[],
    livePrices: Record<string, number>
): LiveHolding[] =>
    computeHoldings(transactions).map(h => {
        const currentPrice = livePrices[h.symbol] || 0;
        const isPriced = currentPrice > 0;

        const marketValue = isPriced ? h.totalShares * currentPrice : h.totalCostBasis;
        const profitLoss = isPriced ? marketValue - h.totalCostBasis : 0;

        return {
            ...h,
            currentPrice,
            isPriced,
            marketValue,
            profitLoss,
            profitLossPercentage: isPriced && h.totalCostBasis > 0
                ? (profitLoss / h.totalCostBasis) * 100
                : 0,
        };
    });

export interface LiveTotals {
    totalCost: number;
    totalValue: number;
    totalPL: number;
    /** Holdings the feed couldn't price; their cost basis is standing in for market value. */
    unpricedCount: number;
}

export const summarizeLive = (holdings: LiveHolding[]): LiveTotals =>
    holdings.reduce<LiveTotals>((acc, h) => ({
        totalCost: acc.totalCost + h.totalCostBasis,
        totalValue: acc.totalValue + h.marketValue,
        totalPL: acc.totalPL + h.profitLoss,
        unpricedCount: acc.unpricedCount + (h.isPriced ? 0 : 1),
    }), { totalCost: 0, totalValue: 0, totalPL: 0, unpricedCount: 0 });

export interface TradeCycle {
    symbol: string;
    /**
     * 1-based. A symbol bought, fully exited, then bought again is two cycles --
     * which is the whole point of the distinction: "when did I exit" has no
     * single answer for a symbol that was re-entered.
     */
    round: number;
    /** Day the cycle's first buy was made, YYYY-MM-DD. */
    openedOn: string;
    /** Day the position went flat. Null while the position is still held. */
    closedOn: string | null;
    /** Calendar days held -- to the exit, or to today while it is still open. */
    days: number;
    /**
     * The day `days` is measured to: the exit, or today while the position is
     * still open. Carried rather than re-derived, so a caller that wants to
     * write the duration out in years and months measures it between exactly
     * the same two dates this count was taken between.
     */
    heldUntil: string;
    isOpen: boolean;
    sharesBought: number;
    sharesSold: number;
    /** Still held. Zero on a closed cycle, by definition. */
    sharesHeld: number;
    /** What the cycle's buys cost. */
    invested: number;
    /** What its sells brought in. */
    proceeds: number;
    /** Average-cost realized P&L on the shares sold in this cycle. */
    realized: number;
    /** How many entries make up the cycle, either side. */
    buys: number;
    sells: number;
}

/** Local calendar day, the same key `PortfolioContext` files an entry under. */
const localDayKey = (at: Date = new Date()): string =>
    `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/**
 * When a transaction happened, anchored to the month it is filed under.
 *
 * Deliberately not `createdAt`. That is the day the *row was written*, and a
 * book whose history was caught up in one sitting has every row stamped with
 * that one afternoon -- which reported a 2025 trade as a 2026 one, because the
 * year came from the typing rather than from the trade. `month` is the only
 * field that describes the trade itself, so it is the only one this reads.
 *
 * The cost is the day: `month` is YYYY-MM, so this returns the first of the
 * month and callers render these month-level. A fabricated day would be a
 * smaller error than a fabricated year, but it would still be one.
 */
const tradeDay = (t: Transaction): string => `${t.month}-01`;

/** Whole calendar days between two YYYY-MM-DD keys. UTC so DST can't shift it. */
const daysBetween = (from: string, to: string): number => {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86_400_000));
};

/**
 * Every round-trip the ledger contains: when a position was opened, when it was
 * fully exited, and how long it was held.
 *
 * A cycle runs from the buy that opens a position from flat to the sell that
 * takes it back to flat. Selling part of a position does not end one -- only a
 * full exit does, which is the question this answers and the one a holdings
 * table cannot: a symbol that was sold out no longer appears there at all.
 *
 * Buys sort before sells within a month for the reason `computeHoldings` gives
 * -- otherwise a same-month full exit closes a cycle that the buy funding it
 * then re-opens, and one round trip is reported as two.
 *
 * P&L is average-cost, the same method `computeHoldings` carries the cost basis
 * by, so a cycle's realized figure is derived the way every other realized
 * figure in the app is.
 */
export const computeTradeCycles = (
    transactions: Transaction[],
    today: string = localDayKey()
): TradeCycle[] => {
    const valid = transactions.filter(t => t.shares > 0 && t.pricePerShare > 0);
    const cycles: TradeCycle[] = [];

    // Per symbol: the cycle being built, how many have already closed, and the
    // running position the average cost is carried on.
    const open = new Map<string, {
        cycle: TradeCycle;
        shares: number;
        costBasis: number;
    }>();
    const rounds = new Map<string, number>();

    orderTransactions(valid).forEach(t => {
        const day = tradeDay(t);
        const shares = Number(t.shares || 0);
        const price = Number(t.pricePerShare || 0);
        const amount = Number(t.totalAmount || shares * price);

        let state = open.get(t.symbol);

        if (t.type === 'buy') {
            if (!state) {
                const round = (rounds.get(t.symbol) ?? 0) + 1;
                rounds.set(t.symbol, round);

                state = {
                    cycle: {
                        symbol: t.symbol,
                        round,
                        openedOn: day,
                        closedOn: null,
                        days: 0,
                        heldUntil: day,
                        isOpen: true,
                        sharesBought: 0,
                        sharesSold: 0,
                        sharesHeld: 0,
                        invested: 0,
                        proceeds: 0,
                        realized: 0,
                        buys: 0,
                        sells: 0,
                    },
                    shares: 0,
                    costBasis: 0,
                };
                open.set(t.symbol, state);
            }

            state.shares += shares;
            state.costBasis += amount;
            state.cycle.sharesBought += shares;
            state.cycle.invested += amount;
            state.cycle.buys += 1;
            return;
        }

        // A sell with nothing open is an orphan -- a partial history, or a row
        // entered against a position this ledger never recorded buying. It has
        // no cycle to belong to, and inventing one would date an entry to a buy
        // that isn't there.
        if (!state) return;

        const avgBeforeSell = state.shares > 0 ? state.costBasis / state.shares : 0;
        const sold = Math.min(shares, state.shares);

        state.cycle.sharesSold += sold;
        state.cycle.proceeds += sold * price;
        state.cycle.realized += sold * (price - avgBeforeSell);
        state.cycle.sells += 1;

        state.shares -= sold;
        state.costBasis -= sold * avgBeforeSell;

        // Flat: the position is fully exited and the cycle is closed. The float
        // dust clamp is the same one `computeHoldings` uses -- share counts are
        // floats and a full exit rarely lands on exactly zero.
        if (state.shares <= EPSILON) {
            state.cycle.closedOn = day;
            state.cycle.isOpen = false;
            state.cycle.sharesHeld = 0;
            state.cycle.heldUntil = day;
            state.cycle.days = daysBetween(state.cycle.openedOn, day);
            cycles.push(state.cycle);
            open.delete(t.symbol);
        }
    });

    // Whatever is still held: an open cycle, measured to today rather than left
    // without a duration.
    open.forEach(state => {
        state.cycle.sharesHeld = state.shares;
        state.cycle.heldUntil = today;
        state.cycle.days = daysBetween(state.cycle.openedOn, today);
        cycles.push(state.cycle);
    });

    return cycles;
};

export interface DaySummary {
    /** What the whole book moved today, in rupees. */
    move: number;
    /** That move against yesterday's close of the same positions. */
    percent: number;
    /** The day's strongest and weakest holdings, by the feed's own 1D figure. */
    best: { symbol: string; change: number } | null;
    worst: { symbol: string; change: number } | null;
}

/**
 * The day's move across a whole portfolio.
 *
 * Rupees, not an average of percentages: a 5% day on a token position and a 5%
 * day on the largest one are not the same event, and averaging them says they
 * are. Each holding's contribution is derived by backing yesterday's close out
 * of the live price -- `close = price / (1 + change/100)` -- because the feed
 * publishes a percentage rather than a previous close.
 *
 * Only priced holdings count. An unpriced one is held at cost (see
 * `computeLiveHoldings`), which is a position with no day move rather than a
 * position that did not move.
 */
export const summarizeDay = (
    holdings: LiveHolding[],
    liveChanges: Record<string, number>
): DaySummary => {
    let move = 0;
    let previousValue = 0;
    let best: DaySummary['best'] = null;
    let worst: DaySummary['worst'] = null;

    holdings.forEach(h => {
        const change = liveChanges[h.symbol];
        if (!h.isPriced || !Number.isFinite(change)) return;

        // A -100% print would put the close at infinity; there is no sane day
        // move to read off that, so the position sits this out.
        const factor = 1 + change / 100;
        if (factor <= 0) return;

        const previousClose = h.currentPrice / factor;
        move += h.totalShares * (h.currentPrice - previousClose);
        previousValue += h.totalShares * previousClose;

        if (!best || change > best.change) best = { symbol: h.symbol, change };
        if (!worst || change < worst.change) worst = { symbol: h.symbol, change };
    });

    return {
        move,
        percent: previousValue > 0 ? (move / previousValue) * 100 : 0,
        best,
        worst,
    };
};

// Cost basis of the shares still held right now.
// Average cost of the shares currently held, used to price a brand new sell.
export const avgBuyPriceFor = (transactions: Transaction[], symbol: string): number =>
    computeHoldings(transactions).find(h => h.symbol === symbol)?.avgPrice ?? 0;
