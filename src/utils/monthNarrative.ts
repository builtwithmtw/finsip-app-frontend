import { format, parseISO } from 'date-fns';
import type { Transaction } from '../types';
import { computeSipStreak } from './sipStreak';
import { groupMonthActivity } from './monthActivity';

export interface NarrativeNote {
    text: string;
    /**
     * Direction of travel, set only where a line actually has one -- the
     * month-over-month comparison. Everything else is neutral, and a note with no
     * tone must not be coloured, or the panel turns into a wall of green.
     */
    tone?: 'up' | 'down';
}

export interface MonthNarrative {
    /** Always present -- what the month came to, or that nothing has happened yet. */
    headline: string;
    /** Supporting lines, each a complete sentence. May be empty. */
    notes: NarrativeNote[];
}

const monthName = (month: string) => {
    try {
        return format(parseISO(`${month}-01`), 'MMMM');
    } catch {
        return month;
    }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const amountOf = (t: Transaction) => Number(t.totalAmount || t.shares * t.pricePerShare);

/** "GCIL", "GCIL and MEBL", "GCIL, MEBL and 2 more" -- a sentence can't carry a long list. */
const listSymbols = (symbols: string[], maskSymbol: (s: string) => string): string => {
    const shown = symbols.slice(0, 2).map(maskSymbol);
    const rest = symbols.length - shown.length;

    if (shown.length === 0) return '';
    if (shown.length === 1) return shown[0];
    return rest > 0 ? `${shown.join(', ')} and ${rest} more` : `${shown[0]} and ${shown[1]}`;
};

/**
 * This month's ledger activity, in a sentence or three.
 *
 * Written from the rows themselves with a small set of templates -- no model and no
 * request. Everything it can say is something the ledger already knows, so it can never
 * be wrong in the way generated prose can, and it costs nothing to render on every tick.
 *
 * The headline figure is NET: buys less sells. Reporting the gross buy as "what went in"
 * overstates the month whenever anything was sold, which is exactly the month you would
 * most want an honest number for. The gross halves are still named, just underneath it.
 *
 * Money is formatted through the caller's formatter, which is the privacy-aware one, so
 * the summary masks along with every other figure rather than narrating amounts the rest
 * of the screen is hiding.
 */
export const describeMonthActivity = (
    transactions: Transaction[],
    currentMonth: string,
    fmt: (amount: number) => string,
    maskSymbol: (symbol: string) => string
): MonthNarrative => {
    const valid = transactions.filter((t) => t.shares > 0 && t.pricePerShare > 0);
    const name = monthName(currentMonth);

    if (valid.length === 0) {
        return { headline: 'No transactions recorded yet.', notes: [] };
    }

    const mine = valid.filter((t) => t.month === currentMonth);
    const buys = mine.filter((t) => t.type === 'buy');
    const sells = mine.filter((t) => t.type === 'sell');

    const buyTotal = buys.reduce((sum, t) => sum + amountOf(t), 0);
    const sellTotal = sells.reduce((sum, t) => sum + amountOf(t), 0);
    const net = buyTotal - sellTotal;
    const buySymbols = new Set(buys.map((t) => t.symbol)).size;
    const sellSymbols = new Set(sells.map((t) => t.symbol)).size;

    // The most recent earlier month that bought anything -- both the comparison and the
    // "last time you invested" line hang off it. Net, so it compares like with like.
    const previousNet = Array.from(
        valid
            .filter((t) => t.month < currentMonth)
            .reduce((acc, t) => {
                const signed = t.type === 'sell' ? -amountOf(t) : amountOf(t);
                acc.set(t.month, (acc.get(t.month) ?? 0) + signed);
                return acc;
            }, new Map<string, number>())
    ).sort((a, b) => b[0].localeCompare(a[0]))[0];

    if (mine.length === 0) {
        const headline = `Nothing recorded for ${name} yet.`;
        const notes: NarrativeNote[] = [];
        if (previousNet) {
            const symbols = new Set(
                valid.filter((t) => t.type === 'buy' && t.month === previousNet[0]).map((t) => t.symbol)
            ).size;
            notes.push({
                text: `You last put ${fmt(Math.round(previousNet[1]))} in across ${plural(symbols, 'symbol', 'symbols')} in ${monthName(previousNet[0])}.`,
            });
        }
        return { headline, notes };
    }

    let headline: string;
    if (buyTotal > 0 && sellTotal > 0) {
        headline =
            net >= 0
                ? `Net ${fmt(Math.round(net))} went in this ${name} — ${fmt(Math.round(buyTotal))} bought across ${plural(buySymbols, 'symbol', 'symbols')}, less ${fmt(Math.round(sellTotal))} sold from ${plural(sellSymbols, 'symbol', 'symbols')}.`
                : `Net ${fmt(Math.round(-net))} came back out this ${name} — ${fmt(Math.round(sellTotal))} sold from ${plural(sellSymbols, 'symbol', 'symbols')}, against ${fmt(Math.round(buyTotal))} bought across ${plural(buySymbols, 'symbol', 'symbols')}.`;
    } else if (buyTotal > 0) {
        headline = `${fmt(Math.round(buyTotal))} went in this ${name}, across ${plural(buySymbols, 'symbol', 'symbols')}.`;
    } else {
        headline = `${fmt(Math.round(sellTotal))} came back out this ${name}, sold from ${plural(sellSymbols, 'symbol', 'symbols')}. Nothing bought yet.`;
    }

    const notes: NarrativeNote[] = [];
    const days = groupMonthActivity(transactions, currentMonth);

    // The SIP gets its own line: it is the deliberate part of the month, and lumping it
    // in with the top-ups and the odd sell is what made the old summary unreadable.
    const sipDay = days.find((d) => d.rank === 0 && d.buyTotal > 0);
    if (sipDay) {
        const symbols = new Set(
            sipDay.transactions.filter((t) => t.type === 'buy').map((t) => t.symbol)
        ).size;
        notes.push({
            text: `The SIP went in on ${sipDay.label}: ${fmt(Math.round(sipDay.buyTotal))} across ${plural(symbols, 'symbol', 'symbols')}.`,
        });
    }

    /*
     * Beyond the SIP, the month gets a fixed budget of event lines, spent on rotations
     * before lone trades: a day that bought and sold at once carries a decision, where a
     * single trade is one leg of one. Without a budget a busy month would push the
     * comparison and the streak off the end of the list, and those are the two lines
     * that say whether the plan is being kept.
     */
    const EVENT_LINES = 2;
    const events: string[] = [];

    // A day that both bought and sold is a rotation, not two unrelated trades, so it is
    // named as one -- which of these went out and which came in is the thing to see.
    days
        .filter((d) => d.buyTotal > 0 && d.sellTotal > 0)
        .slice(0, EVENT_LINES)
        .forEach((day) => {
            const bought = listSymbols(
                Array.from(new Set(day.transactions.filter((t) => t.type === 'buy').map((t) => t.symbol))),
                maskSymbol
            );
            const sold = listSymbols(
                Array.from(new Set(day.transactions.filter((t) => t.type === 'sell').map((t) => t.symbol))),
                maskSymbol
            );
            events.push(`On ${day.label} you bought ${bought} and sold ${sold}.`);
        });

    /*
     * The days that did exactly one thing -- the odd sell, a top-up filed on its own.
     * These were previously unnamed: the SIP line and the rotation line both skip them,
     * so a month whose only news was one exit read as though nothing had happened.
     *
     * Oldest first, because a sell followed by a buy is usually the same decision taken
     * in two steps and reads as one sentence -- "sold DGKC, then bought PRL". Pairing
     * them only across consecutive single-trade days keeps that claim honest: they are
     * genuinely consecutive in the month, with nothing else between them. The SIP day is
     * excluded from the sequence, since it has its own line already.
     */
    const solo = days
        .filter((d) => d.key !== sipDay?.key && d.transactions.length === 1)
        .sort((a, b) => a.key.localeCompare(b.key));

    for (let i = 0; i < solo.length && events.length < EVENT_LINES; i += 1) {
        const day = solo[i];
        const trade = day.transactions[0];
        const next = solo[i + 1];
        const nextTrade = next?.transactions[0];

        if (trade.type === 'sell' && nextTrade?.type === 'buy') {
            events.push(
                `Sold ${maskSymbol(trade.symbol)} on ${day.label}, then bought ${maskSymbol(nextTrade.symbol)} on ${next.label}.`
            );
            i += 1; // both days are spoken for by that sentence.
            continue;
        }

        events.push(
            `${trade.type === 'sell' ? 'Sold' : 'Bought'} ${maskSymbol(trade.symbol)} on ${day.label}.`
        );
    }

    events.forEach((text) => notes.push({ text }));

    if (buyTotal > 0 && previousNet && previousNet[1] > 0 && net > 0) {
        const change = ((net - previousNet[1]) / previousNet[1]) * 100;
        const last = monthName(previousNet[0]);
        // Under 5% either way is noise in a SIP, not a change of behaviour.
        notes.push(
            Math.abs(change) < 5
                ? { text: `Net, that's about the same as ${last}.` }
                : {
                      text: `Net, that's ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'} than ${last}.`,
                      tone: change > 0 ? 'up' : 'down',
                  }
        );
    }

    if (buyTotal > 0) {
        const streak = computeSipStreak(valid, currentMonth);
        if (streak.current > 1) notes.push({ text: `That's ${streak.current} months in a row. 🔥` });
    }

    // Five: the SIP, two events, the comparison and the streak -- one of each kind the
    // month can produce, rather than four of whichever kind came first.
    return { headline, notes: notes.slice(0, 5) };
};
