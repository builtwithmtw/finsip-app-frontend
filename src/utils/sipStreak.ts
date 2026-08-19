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

const EMPTY: SipStreak = { current: 0, longest: 0, fundedCount: 0, totalMonths: 0, months: [] };

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
