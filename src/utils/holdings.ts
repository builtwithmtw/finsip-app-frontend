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
