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

export interface SoloFill {
    /** The day it happened on. */
    label: string;
    shares: number;
    amount: number;
}

export interface SoloGroup {
    symbol: string;
    type: 'buy' | 'sell';
    /** Summed across every solo day for this symbol. */
    shares: number;
    amount: number;
    /** Volume-weighted, so the group prices the position correctly. */
    avgPrice: number;
    count: number;
    /** The most recent day in the group, so the section can sort by date like the days do. */
    latest: string;
    /** Newest first. */
    fills: SoloFill[];
}

/**
 * One entry in the month's list: either a day worth showing as a day, or a symbol that
 * was accumulated across several solo days. Both carry the date they sort on, so the
 * panel is a single list in one direction rather than two stacked sections.
 */
export type MonthActivityItem =
    | { kind: 'day'; date: string; day: ActivityDay }
    | { kind: 'group'; date: string; group: SoloGroup };

/**
 * The month split into the two things it actually contains.
 *
 * A day stays a day when there is something to see in the day itself -- the SIP, or a
 * day that both bought one thing and sold another, where the pairing is the point.
 *
 * A day that did exactly one thing has nothing to say as a day. Three separate days
 * that each bought only PRL are one position being built in instalments, so they fold
 * into a single PRL line with those days listed inside it. That is the difference
 * between a month that looks like nine scattered events and one that looks like a SIP,
 * a rotation, and a stock being accumulated.
 */
export const splitMonthActivity = (
    transactions: Transaction[],
    currentMonth: string
): MonthActivityItem[] => {
    const all = groupMonthActivity(transactions, currentMonth);
    if (all.length === 0) return [];

    // The SIP keeps its own day whatever else is true of it -- including being the
    // month's only trade, where it would otherwise fold into a group of one.
    const sipKey = all.find((d) => d.rank === 0 && d.buyTotal > 0)?.key;

    const days: ActivityDay[] = [];
    const soloRows: { day: ActivityDay; transaction: Transaction }[] = [];

    all.forEach((day) => {
        if (day.key === sipKey || day.transactions.length > 1) days.push(day);
        else soloRows.push({ day, transaction: day.transactions[0] });
    });

    // Split by side as well as symbol: a symbol bought on one solo day and sold on
    // another is two decisions, and one netted line would hide both.
    const merged = new Map<string, SoloGroup>();

    soloRows.forEach(({ day, transaction: t }) => {
        const mergeKey = `${t.type}:${t.symbol}`;
        const group = merged.get(mergeKey) ?? {
            symbol: t.symbol,
            type: t.type,
            shares: 0,
            amount: 0,
            avgPrice: 0,
            count: 0,
            latest: '',
            fills: [],
        };

        const amount = amountOf(t);
        group.shares += t.shares;
        group.amount += amount;
        group.count += 1;
        group.fills.push({ label: day.label, shares: t.shares, amount });
        if (day.key > group.latest) group.latest = day.key;
        merged.set(mergeKey, group);
    });

    const solo = Array.from(merged.values()).map((group) => ({
        ...group,
        avgPrice: group.shares > 0 ? group.amount / group.shares : 0,
    }));

    // One list, newest first. An accumulated symbol sorts on its most recent instalment,
    // so a stock topped up yesterday sits above a SIP that went in on the 3rd -- the
    // month reads top to bottom in one direction and never switches ordering halfway.
    return [
        ...days.map((day) => ({ kind: 'day' as const, date: day.key, day })),
        ...solo.map((group) => ({ kind: 'group' as const, date: group.latest, group })),
    ].sort((a, b) => b.date.localeCompare(a.date));
};
