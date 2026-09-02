import type { Transaction } from '../types';

export interface SipMonth {
    month: string; // YYYY-MM
    funded: boolean;
    /** Buys only, in PKR. A month that only sold is not a funded month. */
    amount: number;
}

export interface SipStreak {
    /** Consecutive funded months, counted back from the most recent one that can count. */
    current: number;
    /** Best run the ledger has ever held. */
    longest: number;
    fundedCount: number;
    /** Months from the first buy to now, whether they were funded or not. */
    totalMonths: number;
    /** Oldest first. */
    months: SipMonth[];
}

export interface SipWindow {
    /** Day of the month, 1-31. Both ends are real SIP dates, not week boundaries. */
    earliest: number;
    latest: number;
    /** Months whose SIP date falls inside the window. */
    months: number;
    /** Months whose SIP date falls outside it. */
    outliers: number;
    /** Months that supplied a usable date at all -- `months` + `outliers`. */
    total: number;
}

/** One month's SIP: the day it went in on, and what went in that day. */
export interface SipDay {
    /** YYYY-MM. */
    month: string;
    /** Day of the month, 1-31. Null when no row that month carried a usable timestamp. */
    day: number | null;
    /** Bought on the SIP day alone. */
    amount: number;
    /** Bought across the whole month, so a caller can show what the top-ups added. */
    monthTotal: number;
}

/**
 * The SIP each month, taken as the day that bought the most.
 *
 * That is the definition the ledger already uses everywhere else it names a SIP:
 * `groupMonthActivity` ranks a month's days by buying and calls rank 0 the SIP day. One
 * heavy day is what a SIP looks like in the data; the odd lots on other days are
 * top-ups, and a figure that folds them in is answering "what did I buy this month",
 * which is a different question and a larger number.
 *
 * A month whose rows carry no usable timestamp cannot be split into days at all. Rather
 * than drop the month, its whole total stands as the SIP with no date -- for a month
 * that was entered in one sitting that is exactly right, and it is the best available
 * reading either way.
 *
 * Oldest first.
 */
export const computeSipDays = (transactions: Transaction[]): SipDay[] => {
    // month -> day of month -> bought that day. Undated rows are held separately so
    // they still count toward the month even though they cannot win a day.
    const byMonth = new Map<string, { days: Map<number, number>; total: number }>();

    transactions.forEach((t) => {
        if (t.type !== 'buy' || t.shares <= 0 || t.pricePerShare <= 0) return;

        const month = (t.month ?? '').slice(0, 7);
        if (month.length !== 7) return;

        const amount = Number(t.totalAmount || t.shares * t.pricePerShare);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const entry = byMonth.get(month) ?? { days: new Map<number, number>(), total: 0 };
        entry.total += amount;

        const stamp = (t.createdAt ?? '').slice(0, 10);
        const day = stamp.length === 10 ? Number(stamp.slice(8, 10)) : NaN;

        if (Number.isFinite(day) && day >= 1 && day <= 31) {
            entry.days.set(day, (entry.days.get(day) ?? 0) + amount);
        }

        byMonth.set(month, entry);
    });

    const result: SipDay[] = [];

    byMonth.forEach((entry, month) => {
        let bestDay = 0;
        let bestAmount = -1;

        entry.days.forEach((amount, day) => {
            // Ties go to the earlier date: two equal buys in a month means the SIP was
            // split, and the first one is when it went in.
            if (amount > bestAmount || (amount === bestAmount && day < bestDay)) {
                bestAmount = amount;
                bestDay = day;
            }
        });

        result.push(
            bestDay > 0
                ? { month, day: bestDay, amount: bestAmount, monthTotal: entry.total }
                : { month, day: null, amount: entry.total, monthTotal: entry.total }
        );
    });

    return result.sort((a, b) => a.month.localeCompare(b.month));
};


const EMPTY: SipStreak = { current: 0, longest: 0, fundedCount: 0, totalMonths: 0, months: [] };

/**
 * Which part of the month the SIP actually goes in on.
 *
 * One date per month -- the day that bought the most, the same definition of "the SIP
 * day" that `groupMonthActivity` ranks by, so the two can never point at different days
 * of the same month. A top-up later in the month is not what is being measured here.
 *
 * The date comes from `createdAt`, which is the day the entry was *recorded*. A
 * transaction carries a month and nothing finer, so for anything filed when it was
 * traded -- the normal case -- the two are the same day, but a month entered late
 * reports the day it was typed in.
 *
 * Every month with a usable timestamp counts, backfilled ones included. Dropping them
 * was tried and is wrong for this ledger: it silently shrank an eleven-month history to
 * eight, and a window resting on the months that happen to have been filed on time is
 * not obviously truer than one resting on all of them -- it is just quieter about what
 * it left out. A backfilled month lands on its typing date, the clustering treats that
 * as one date among many, and an odd one is outvoted rather than deferred to. `total`
 * is reported so the count can always be checked against the streak above it.
 *
 * The range is where the SIP *usually* goes in, not the span of every month it ever
 * went in on. A plain earliest-to-latest is hostage to its worst month -- eleven months
 * on the 3rd and one on the 27th would read "3rd - 27th", which describes a habit
 * nobody has. So the answer is the narrowest span of dates holding a majority of the
 * months, and whatever falls outside is an outlier rather than something allowed to
 * widen the window.
 *
 * Both ends are real SIP dates, so the range only ever names days the money actually
 * went in on. A book that funds between the 3rd and the 6th reads "3rd - 6th" and not
 * some rounded-out fortnight around it.
 */
export const computeSipWindow = (transactions: Transaction[]): SipWindow | null => {
    // Only the months that actually produced a date. A month entered without usable
    // timestamps has a SIP amount but nothing to say about when it went in.
    return sipWindowFromDays(
        computeSipDays(transactions)
            .map((s) => s.day)
            .filter((day): day is number => day !== null)
    );
};

/**
 * The window itself, over any set of days-of-month.
 *
 * Split out so a book with recorded deposits can be read the same way as one whose SIP
 * dates have to be inferred from its buying. The clustering is the same question either
 * way -- which part of the month does the money go in on -- and only the source of the
 * dates differs.
 */
export const sipWindowFromDays = (sipDays: number[]): SipWindow | null => {
    if (sipDays.length === 0) return null;

    const total = sipDays.length;

    // How many months the window has to hold to count as "where the SIP goes in".
    // A strict majority, so there can only ever be one answer.
    const needed = Math.floor(total / 2) + 1;

    const sorted = [...sipDays].sort((a, b) => a - b);

    /*
     * An outlier is a month separated from the rest by a gap, so the gap is what the
     * window is found by: the dates are cut at their widest break and the side holding
     * a majority is the habit.
     *
     * Two earlier attempts were worse, both for the same reason -- they imposed a shape
     * on the dates instead of reading the one they have.
     *
     * Bucketing the month into four calendar weeks tore apart any cluster straddling a
     * boundary: the 7th and the 8th are one day apart and landed in different buckets,
     * so a book funding from the 3rd to the 10th read "3rd - 7th" with the rest called
     * outliers. Nothing about a SIP cares where a week begins.
     *
     * Taking the narrowest span holding a majority stopped as soon as it had one, which
     * is a low bar: the same 3rd-to-10th book reported "3rd - 7th" again, because five
     * of nine months was enough and the 8th, 9th and 10th sitting right beside it were
     * never picked up.
     *
     * A break narrower than MIN_GAP is not a break at all -- it is the ordinary drift of
     * when a transfer lands -- so it can never split a cluster. And if neither side of
     * the widest gap holds a majority the dates have no habit in them, and the full span
     * stands with nothing called an outlier, which is the honest answer for a SIP with
     * no settled date.
     */
    const MIN_GAP = 3;

    let widestGap = 0;
    let cutAfter = -1;

    for (let i = 0; i + 1 < total; i += 1) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > widestGap) {
            widestGap = gap;
            cutAfter = i;
        }
    }

    let start = sorted[0];
    let end = sorted[total - 1];

    if (widestGap >= MIN_GAP && cutAfter >= 0) {
        const before = cutAfter + 1;

        if (before >= needed) {
            end = sorted[cutAfter];
        } else if (total - before >= needed) {
            start = sorted[cutAfter + 1];
        }
    }

    // Everything actually inside the span. Months sharing a date with an edge come along
    // and should -- they are as much inside the window as the ones that defined it.
    const inside = sorted.filter((day) => day >= start && day <= end);

    return {
        earliest: start,
        latest: end,
        months: inside.length,
        outliers: total - inside.length,
        total,
    };
};

// String maths rather than Date maths: the keys are already 'YYYY-MM' and stepping
// them by hand can't be moved across a boundary by a timezone.
const nextMonth = (m: string): string => {
    const [year, month] = m.split('-').map(Number);
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
};

/**
 * How consistently the SIP has actually been paid.
 *
 * "Funded" means the month has at least one buy -- a month that only sold is money
 * coming back out, not a contribution, so it breaks the run like an empty month does.
 *
 * The current month is the one exception to that. It is still open, so an unfunded
 * current month is not yet a missed one: the streak is counted from the last month
 * that has closed, and this month only ever extends it. Without that rule every
 * streak would read as broken on the 1st and repair itself later in the month.
 */
export const computeSipStreak = (transactions: Transaction[], currentMonth: string): SipStreak => {
    const buys = new Map<string, number>();

    transactions.forEach((t) => {
        if (t.type !== 'buy' || t.shares <= 0 || t.pricePerShare <= 0) return;
        const month = (t.month ?? '').slice(0, 7);
        if (month.length !== 7) return;
        buys.set(month, (buys.get(month) ?? 0) + Number(t.totalAmount || t.shares * t.pricePerShare));
    });

    if (buys.size === 0) return EMPTY;

    const keys = Array.from(buys.keys()).sort();
    const first = keys[0];
    // A ledger can hold a month ahead of today (an entry filed early), so the run ends
    // at whichever is later rather than assuming that's this month.
    const last = keys[keys.length - 1] > currentMonth ? keys[keys.length - 1] : currentMonth;

    const months: SipMonth[] = [];
    for (let m = first; m <= last && months.length < 1200; m = nextMonth(m)) {
        const amount = buys.get(m) ?? 0;
        months.push({ month: m, funded: amount > 0, amount: Math.round(amount) });
    }

    let longest = 0;
    let run = 0;
    months.forEach((m) => {
        run = m.funded ? run + 1 : 0;
        if (run > longest) longest = run;
    });

    // Skip an unfunded month still in progress; anything earlier is a real miss.
    let index = months.length - 1;
    if (index >= 0 && months[index].month === currentMonth && !months[index].funded) index -= 1;

    let current = 0;
    for (; index >= 0 && months[index].funded; index -= 1) current += 1;

    return {
        current,
        longest,
        fundedCount: months.filter((m) => m.funded).length,
        totalMonths: months.length,
        months,
    };
};
