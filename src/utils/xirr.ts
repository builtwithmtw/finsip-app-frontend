import type { Transaction } from '../types';

/**
 * One dated movement of money *between you and the account*.
 *
 * Deliberately not one per trade. Buying and selling inside the account moves nothing in
 * or out of your pocket, and XIRR is defined on the flows that do.
 */
export interface CashFlow {
    date: Date;
    /** Negative is money you put in; the closing row is positive. */
    amount: number;
    kind: 'contribution' | 'closing';
}

/** A day's worth of it, which is the row a spreadsheet's XIRR would be given. */
export interface CashFlowRow {
    /** YYYY-MM-DD. */
    date: string;
    /** The external flow: new money in (negative), or the closing value (positive). */
    amount: number;
    kind: 'contribution' | 'closing';
}

const MS_PER_DAY = 86_400_000;

/** Actual/365, the convention XIRR is defined on and the one every spreadsheet uses. */
const DAYS_PER_YEAR = 365;

/** Below -100% the discount factor has a negative base and stops being a number. */
const RATE_FLOOR = -0.9999;

/** +10,000% a year. Nothing real reaches it; it is the bracket's far wall. */
const RATE_CEILING = 100;

/**
 * Net present value of the flows at a given annual rate.
 *
 * Time is measured from the first flow rather than from today, so the result does not
 * change with when it happens to be computed.
 */
const npv = (rate: number, flows: CashFlow[], start: number): number =>
    flows.reduce((sum, flow) => {
        const years = (flow.date.getTime() - start) / (MS_PER_DAY * DAYS_PER_YEAR);
        return sum + flow.amount / Math.pow(1 + rate, years);
    }, 0);

/**
 * The annualised return that makes the cashflows balance -- what a bank account would
 * have had to pay to end up where this portfolio did.
 *
 * This is the honest way to score a SIP. Total profit over total cost cannot be: money
 * you put in last month has had one month to work and money from two years ago has had
 * two years, and a plain percentage treats them as though they were the same. XIRR
 * weights every rupee by how long it was actually invested.
 *
 * Solved by bisection rather than Newton-Raphson. NPV is monotonic in the rate for the
 * flows a portfolio produces (money out first, value back at the end), so bisection
 * cannot diverge, needs no derivative, and cannot be thrown by the near-flat curve that
 * makes Newton overshoot past -100% and start taking roots of negative numbers.
 *
 * @returns The annual rate as a fraction (0.18 is 18%), or null when the flows cannot
 *          define one.
 */
export const computeXirr = (flows: CashFlow[]): number | null => {
    if (flows.length < 2) return null;

    // A rate only exists where money went both ways. All-outflow (never sold, worth
    // nothing) or all-inflow has no root to find.
    const hasOutflow = flows.some((f) => f.amount < 0);
    const hasInflow = flows.some((f) => f.amount > 0);
    if (!hasOutflow || !hasInflow) return null;

    const times = flows.map((f) => f.date.getTime());
    const start = Math.min(...times);

    /*
     * The only period this actually refuses is a zero-length one, where every flow lands
     * on the same day: the discount exponent is then 0 for all of them, no rate can
     * change the sum, and there is nothing to solve for.
     *
     * There used to be a 60-day floor as well, on the grounds that annualising a
     * fortnight produces numbers like +4000%. That is true and is a reason to read a
     * young figure carefully, not a reason to refuse to compute it -- a SIP with three
     * months of instalments and a valuation has everything the method needs, and
     * withholding the answer serves nobody. The card names the period it covers, which
     * is what lets a short one be read for what it is.
     */
    if (Math.max(...times) === start) return null;

    let low = RATE_FLOOR;
    let high = RATE_CEILING;

    let npvLow = npv(low, flows, start);
    let npvHigh = npv(high, flows, start);

    // No sign change across the bracket means no root inside it -- a book that lost
    // more than everything, or numbers too extreme to be a rate. Better to say nothing
    // than to report a bracket edge as an answer.
    if (Number.isNaN(npvLow) || Number.isNaN(npvHigh)) return null;
    if (npvLow > 0 === npvHigh > 0) return null;

    // 200 halvings takes the bracket far below floating-point resolution; the loop
    // exits on tolerance long before, and the cap is only there so a pathological input
    // cannot spin.
    for (let i = 0; i < 200; i += 1) {
        const mid = (low + high) / 2;
        const value = npv(mid, flows, start);

        if (!Number.isFinite(value)) return null;

        // A hundredth of a rupee on a portfolio-sized figure is converged.
        if (Math.abs(value) < 0.01 || high - low < 1e-9) return mid;

        if (value > 0 === npvLow > 0) {
            low = mid;
            npvLow = value;
        } else {
            high = mid;
            npvHigh = value;
        }
    }

    return (low + high) / 2;
};

/**
 * The date a transaction's money actually moved.
 *
 * A transaction carries a month and no trade date of its own, so `createdAt` -- when the
 * row was written -- is the only day-level fact available, and it is right for anything
 * filed the day it was traded. A month caught up later carries the day it was typed in,
 * which would put a backfilled October flow in January and shorten the period it was
 * invested for. So a timestamp is trusted only when it falls inside the month the row is
 * filed under; otherwise the middle of that month stands in, which is the estimate with
 * the smallest worst case when the day is genuinely unknown.
 */
const flowDate = (t: Transaction): Date | null => {
    const month = (t.month ?? '').slice(0, 7);
    if (month.length !== 7) return null;

    const stamp = (t.createdAt ?? '').slice(0, 10);

    if (stamp.length === 10 && stamp.slice(0, 7) === month) {
        const at = new Date(`${stamp}T12:00:00.000Z`);
        if (!Number.isNaN(at.getTime())) return at;
    }

    const midMonth = new Date(`${month}-15T12:00:00.000Z`);
    return Number.isNaN(midMonth.getTime()) ? null : midMonth;
};

export interface PortfolioFlows {
    /** What `computeXirr` is given: external money only. */
    flows: CashFlow[];
    /** The same thing a day at a time, for auditing against a statement. */
    rows: CashFlowRow[];
    /** Capital committed to the market: buys less sells. */
    contributed: number;
}

/**
 * The portfolio's cashflows, measured on the capital actually put to work.
 *
 * Every purchase is money going into the market and every sale is money coming back out
 * of it, scored against what the holdings are worth today. That makes this a return on
 * *invested* capital: it answers how well the positions did, and says nothing about
 * money deposited and left sitting as cash.
 *
 * Deliberately not the deposits. The two measure different things and both are true:
 *
 *  - Deposits ask "what did the money I handed the broker earn?", so cash left idle
 *    counts against you -- it earned nothing while it sat there.
 *  - Trades ask "how good were the positions?", and cash that was never deployed is
 *    simply outside the question.
 *
 * A book that keeps a float will always read higher here, and the gap between the two
 * figures is the cost of holding that float. Neither is a correction of the other.
 *
 * Sells are inflows and rebuys are outflows again, which is right rather than
 * double-counting: a sale genuinely returns capital, and the purchase that follows
 * genuinely commits it. The pair nets to what actually changed hands, and any growth in
 * between shows up as the difference between the two amounts.
 */
/** A deposit as recorded: the day the money reached the account, and how much. */
export interface RecordedDeposit {
    /** YYYY-MM-DD. */
    date: string;
    amount: number;
    /**
     * Only a deposit is a contribution. A dividend is money the holdings produced and a
     * reconciliation is a correction -- neither is capital you supplied, and counting
     * either would measure the return against money you never put in.
     */
    kind?: 'deposit' | 'dividend' | 'reconciliation';
}

export const buildPortfolioFlows = (
    transactions: Transaction[],
    holdingsValue: number,
    /**
     * Deposits as recorded. When any exist they *are* the cashflows, and the trades are
     * not consulted at all: this is then the same calculation a broker statement's own
     * XIRR performs, on the same two facts.
     */
    deposits: RecordedDeposit[] = [],
    /**
     * Cash sitting with the broker, which joins the holdings in the closing figure.
     *
     * Only meaningful alongside recorded deposits, and required by them: money you
     * deposited and have not spent is still yours, and leaving it out of the closing
     * figure would report it as lost.
     */
    cashAvailable: number | null = null,
    now: Date = new Date()
): PortfolioFlows => {
    // Deposits only. An entry with no kind at all predates the column and is a deposit.
    const contributions = deposits.filter((d) => d.kind === undefined || d.kind === 'deposit');

    if (contributions.length > 0) {
        return depositFlows(contributions, holdingsValue + (cashAvailable ?? 0), now);
    }

    return tradeFlows(transactions, holdingsValue, now);
};

/**
 * The exact calculation: money in on the days it went in, against what the account is
 * worth today.
 *
 * Nothing is inferred here. Each deposit is a dated outflow and the closing figure is
 * the holdings plus the cash that was never spent -- which together are the whole
 * account. This is a return on everything handed to the broker, so cash left idle
 * counts against it, exactly as it should: it earned nothing while it sat there.
 */
const depositFlows = (
    deposits: RecordedDeposit[],
    closing: number,
    now: Date
): PortfolioFlows => {
    const byDay = new Map<string, number>();

    deposits.forEach((d) => {
        if (!Number.isFinite(d.amount) || d.amount <= 0) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return;
        byDay.set(d.date, (byDay.get(d.date) ?? 0) - d.amount);
    });

    const rows: CashFlowRow[] = Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({ date, amount, kind: 'contribution' as const }));

    // Midday UTC, so the calendar date survives being read back in any timezone -- a
    // local-midnight timestamp slips to the previous day for anyone ahead of UTC.
    const flows: CashFlow[] = rows.map((row) => ({
        date: new Date(`${row.date}T12:00:00.000Z`),
        amount: row.amount,
        kind: 'contribution',
    }));

    const contributed = rows.reduce((sum, row) => sum - row.amount, 0);

    if (flows.length > 0 && closing > 0) {
        flows.push({ date: now, amount: closing, kind: 'closing' });
        rows.push({ date: now.toISOString().slice(0, 10), amount: closing, kind: 'closing' });
    }

    return { flows, rows, contributed };
};

/** The fallback, for an account that has recorded no deposits yet. */
const tradeFlows = (
    transactions: Transaction[],
    holdingsValue: number,
    now: Date
): PortfolioFlows => {
    const byDay = new Map<string, number>();

    transactions.forEach((t) => {
        if (t.shares <= 0 || t.pricePerShare <= 0) return;

        const amount = Number(t.totalAmount || t.shares * t.pricePerShare);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const date = flowDate(t);
        if (!date) return;

        const key = date.toISOString().slice(0, 10);
        // Buys leave the market-facing pocket, sells come back into it.
        byDay.set(key, (byDay.get(key) ?? 0) + (t.type === 'buy' ? -amount : amount));
    });

    const rows: CashFlowRow[] = Array.from(byDay.entries())
        .filter(([, amount]) => amount !== 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({ date, amount, kind: 'contribution' as const }));

    const flows: CashFlow[] = rows.map((row) => ({
        date: new Date(`${row.date}T12:00:00.000Z`),
        amount: row.amount,
        kind: 'contribution',
    }));

    // What went in, net of what came back out -- the capital still committed.
    const contributed = rows.reduce((sum, row) => sum - row.amount, 0);

    const closing = holdingsValue;

    if (flows.length > 0 && closing > 0) {
        flows.push({ date: now, amount: closing, kind: 'closing' });
        rows.push({ date: now.toISOString().slice(0, 10), amount: closing, kind: 'closing' });
    }

    return { flows, rows, contributed };
};
