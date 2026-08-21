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

/** Calendar weeks of a month: 1-7, 8-14, 15-21, 22 onwards. */
const WEEKS = 4;

const weekOf = (day: number): number => Math.min(Math.floor((day - 1) / 7), WEEKS - 1);

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
 * nobody has. So the dates are bucketed into the month's four weeks, and the answer is
 * the narrowest run of consecutive weeks holding a majority of them; whatever falls
 * outside is counted as an outlier rather than allowed to widen the window.
 *
 * The ends are then the real dates at the edges of that cluster, not the week
 * boundaries: a cluster sitting in weeks 1-2 whose earliest month was the 2nd and
 * latest the 11th reads "2nd - 11th", which is tighter and truer than "1st - 14th".
 *
 * Widening only ever happens when it has to. If one week already holds the majority the
 * window is that single week, and if the months are spread evenly enough that no run
 * short of all four weeks holds a majority, the full span is returned with no outliers
 * -- the honest answer for a SIP with no settled date.
 */
export const computeSipWindow = (transactions: Transaction[]): SipWindow | null => {
    // month -> day of month -> buy total on that day
    const byMonth = new Map<string, Map<number, number>>();

    transactions.forEach((t) => {
        if (t.type !== 'buy' || t.shares <= 0 || t.pricePerShare <= 0) return;

        const month = (t.month ?? '').slice(0, 7);
        if (month.length !== 7) return;

        const stamp = (t.createdAt ?? '').slice(0, 10);
        if (stamp.length !== 10) return;

        const day = Number(stamp.slice(8, 10));
        if (!Number.isFinite(day) || day < 1 || day > 31) return;

        const days = byMonth.get(month) ?? new Map<number, number>();
        days.set(day, (days.get(day) ?? 0) + Number(t.totalAmount || t.shares * t.pricePerShare));
        byMonth.set(month, days);
    });

    if (byMonth.size === 0) return null;

    const sipDays: number[] = [];

    byMonth.forEach((days) => {
        let best = 0;
        let bestAmount = -1;

        days.forEach((amount, day) => {
            // Ties go to the earlier date: two equal buys in a month means the SIP was
            // split, and the first one is when it went in.
            if (amount > bestAmount || (amount === bestAmount && day < best)) {
                bestAmount = amount;
                best = day;
            }
        });

        if (best > 0) sipDays.push(best);
    });

    if (sipDays.length === 0) return null;

    const total = sipDays.length;

    // How many months a run of weeks has to hold to count as "where the SIP goes in".
    // A strict majority, so there can only ever be one answer.
    const needed = Math.floor(total / 2) + 1;

    const perWeek = Array.from({ length: WEEKS }, () => 0);
    sipDays.forEach((day) => {
        perWeek[weekOf(day)] += 1;
    });

    // Every run of consecutive weeks, narrowest first. Once a run reaches the majority
    // there is no point extending it further -- that only widens the same answer -- so
    // each starting week contributes at most one candidate.
    let best: { start: number; end: number; count: number } | null = null;

    for (let start = 0; start < WEEKS; start += 1) {
        let count = 0;

        for (let end = start; end < WEEKS; end += 1) {
            count += perWeek[end];

            if (count < needed) continue;

            const width = end - start;
            const bestWidth = best ? best.end - best.start : Infinity;

            // Narrower wins; on a tie the run holding more months does, which breaks in
            // favour of the denser cluster rather than the earlier one.
            if (width < bestWidth || (width === bestWidth && count > (best?.count ?? 0))) {
                best = { start, end, count };
            }

            break;
        }
    }

    // The full span always holds every month, so a majority is always reachable and this
    // is unreachable in practice -- it stands so the type never has to be nullable.
    if (!best) {
        return {
            earliest: Math.min(...sipDays),
            latest: Math.max(...sipDays),
            months: total,
            outliers: 0,
            total,
        };
    }

    const cluster = sipDays.filter((day) => {
        const week = weekOf(day);
        return week >= best.start && week <= best.end;
    });

    return {
        earliest: Math.min(...cluster),
        latest: Math.max(...cluster),
        months: cluster.length,
        outliers: total - cluster.length,
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
