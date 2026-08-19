import { format, parseISO } from 'date-fns';
import type { Transaction } from '../types';

export interface ActivityDay {
    /** YYYY-MM-DD, or the month key for a row with no usable timestamp. */
    key: string;
    label: string;
    buyTotal: number;
    sellTotal: number;
    /** 0 is the month's heaviest buying day -- its SIP date. */
    rank: number;
    /** Newest first. */
    transactions: Transaction[];
}

const amountOf = (t: Transaction) => Number(t.totalAmount || t.shares * t.pricePerShare);

const dayKey = (t: Transaction): string => (t.createdAt ?? '').slice(0, 10) || t.month;

const dayLabel = (key: string): string => {
    try {
        return format(parseISO(key.length === 10 ? key : `${key}-01`), key.length === 10 ? 'd MMM' : 'MMM yyyy');
    } catch {
        return key;
    }
};

/**
 * The current month's trades, gathered into the days they happened on.
 *
 * Two orderings, doing two different jobs. `rank` is by how much the day *bought*, so
 * rank 0 is the day the SIP actually went in and the ranks below it are the top-ups
 * and odd lots -- that is the thing worth naming. The array itself comes back newest
 * day first, because that is the order the month is read in.
 *
 * The day comes from `createdAt`: a transaction carries a month and nothing finer, so
 * this is the day the entry was recorded. For anything filed when it was traded -- the
 * normal case -- the two are the same day.
 */
export const groupMonthActivity = (
    transactions: Transaction[],
    currentMonth: string
): ActivityDay[] => {
    const mine = transactions.filter(
        (t) => t.month === currentMonth && t.shares > 0 && t.pricePerShare > 0
    );
    if (mine.length === 0) return [];

    const days = new Map<string, ActivityDay>();

    mine.forEach((t) => {
        const key = dayKey(t);
        const day = days.get(key) ?? {
            key,
            label: dayLabel(key),
            buyTotal: 0,
            sellTotal: 0,
            rank: 0,
            transactions: [],
        };

        if (t.type === 'sell') day.sellTotal += amountOf(t);
        else day.buyTotal += amountOf(t);

        day.transactions.push(t);
        days.set(key, day);
    });

    const all = Array.from(days.values());

    // Rank first, on buying alone -- a day that only sold has bought nothing and sits
    // at the bottom of the ranking however large the sell was.
    all.slice()
        .sort((a, b) => (b.buyTotal - a.buyTotal) || b.key.localeCompare(a.key))
        .forEach((day, index) => {
            day.rank = index;
        });

    all.forEach((day) => {
        day.transactions.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    });

    return all.sort((a, b) => b.key.localeCompare(a.key));
};
