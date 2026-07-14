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

// Cost basis of the shares still held right now.
export const totalCostFrom = (transactions: Transaction[]): number =>
    computeHoldings(transactions).reduce((sum, h) => sum + h.totalCostBasis, 0);

// Average cost of the shares currently held, used to price a brand new sell.
export const avgBuyPriceFor = (transactions: Transaction[], symbol: string): number =>
    computeHoldings(transactions).find(h => h.symbol === symbol)?.avgPrice ?? 0;
