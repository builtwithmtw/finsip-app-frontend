import { type ComputedHolding } from './holdings';

/**
 * Scores a book against a position-sizing plan.
 *
 * Everything here is measured on **cost basis** -- what the shares cost, not what the
 * market has since made of them. That is the deliberate difference between this and
 * `utils/rebalance.ts`, which prices the same portfolio at market to work out trades.
 * A position only breaches the per-stock cap here because it was bought that large,
 * never because it rallied, so the score reads as a verdict on the sizing decisions
 * rather than on the market's opinion of them. It also means the figures hold still
 * while the feed ticks.
 *
 * The rules are the ones on the plan: how many names the capital wants, a ceiling per
 * stock and per sector, a floor under a position worth holding at all, and a band a
 * position may drift out of its target before it is due a rebalance.
 */

/** The plan's constants, so the panel quotes the same numbers the arithmetic uses. */
export const SIZING_RULES = {
    /** N = round(sqrt(capital) / 70): 100k wants 5 names, 1M wants 14. */
    COUNT_DIVISOR: 70,
    /** Ceiling on one position, as a share of capital. The plan's range is 15-20%. */
    MAX_PER_STOCK: 20,
    /** Where a position stops being comfortable and starts being a bet. */
    SOFT_PER_STOCK: 15,
    /** Ceiling on one sector. The plan's range is 25-30%. */
    MAX_PER_SECTOR: 30,
    SOFT_PER_SECTOR: 25,
    /** Under this a position is too small to carry on its own, in PKR. */
    MIN_POSITION: 15_000,
    /** Percentage points a position may sit off target before it is due a rebalance. */
    DRIFT_BAND: 5,
} as const;

export type SizingFlag = 'ok' | 'trim' | 'add' | 'thin' | 'over';

export interface SizingRow {
    symbol: string;
    /** From the My Symbols row, where one exists. Null for a symbol never registered. */
    sector: string | null;
    /** Cost of the shares still held, in PKR -- the capital this position stands on. */
    invested: number;
    /** That cost as a share of the whole book, as a percentage. */
    weight: number;
    /** Where the plan puts it, as a percentage. */
    targetWeight: number;
    targetAmount: number;
    /** Actual weight less target weight, in percentage points. */
    drift: number;
    /** What it would take to land on target, in PKR. Positive adds, negative trims. */
    gap: number;
    flag: SizingFlag;
}

export type SizingCheckKey = 'count' | 'concentration' | 'sector' | 'minimum' | 'drift';
export type SizingStatus = 'pass' | 'warn' | 'fail';

export interface SizingCheck {
    key: SizingCheckKey;
    label: string;
    /** The symbol or sector the reading is about, where it is about one. */
    subject: string | null;
    /** What the book reads on this rule, e.g. "23.4%" or "3 of 11 out". */
    reading: string;
    /** What the rule asks for, e.g. "Cap 20%". */
    rule: string;
    /** 0-100, before weighting. */
    score: number;
    status: SizingStatus;
}

export type SizingGrade = 'Disciplined' | 'Balanced' | 'Drifting' | 'Concentrated';

export interface SizingReport {
    /** Cost basis of everything held, which every other figure is a share of. */
    capital: number;
    /** Positions held right now. */
    held: number;
    /** N -- how many names this much capital wants. */
    suggested: number;
    /** The weighted average of the checks that applied, 0-100. */
    score: number;
    grade: SizingGrade;
    /** Only the rules this book can actually be held to; see `capIsMeetable`. */
    checks: SizingCheck[];
    /**
     * The heaviest single position and the heaviest sector, for reading straight against
     * the two caps.
     *
     * On the report rather than dug back out of `checks`, because a check stands down
     * when its cap is unreachable and these two readings are true either way -- the tile
     * shows what the book is concentrated in even where the score does not hold it
     * against you.
     */
    topStock: { symbol: string; weight: number } | null;
    /** Null when not one held symbol has a sector on My Symbols. */
    topSector: { name: string; weight: number } | null;
    rows: SizingRow[];
    /** Nothing held, so there is no book to score. */
    empty: boolean;
    /** No target weight set anywhere, so the rows fall back to an equal split. */
    equalWeighted: boolean;
    /** Positions the plan would have you act on -- everything not flagged 'ok'. */
    flagged: number;
}

/**
 * How many names the capital wants.
 *
 * Grows with the square root rather than linearly, which is what keeps the count
 * climbing slowly: quadrupling the capital adds names, it does not quadruple them.
 */
export const suggestedCount = (capital: number): number =>
    capital > 0 ? Math.max(1, Math.round(Math.sqrt(capital) / SIZING_RULES.COUNT_DIVISOR)) : 0;

export const gradeFor = (score: number): SizingGrade =>
    score >= 85 ? 'Disciplined' : score >= 70 ? 'Balanced' : score >= 55 ? 'Drifting' : 'Concentrated';

/** Full marks at or under `good`, none at or past `bad`, a straight line between. */
const taper = (value: number, good: number, bad: number): number => {
    if (value <= good) return 100;
    if (value >= bad) return 0;
    return ((bad - value) / (bad - good)) * 100;
};

/**
 * Whether a cap is arithmetically reachable at this many names.
 *
 * At four names an equal-weight book is 25% a position, so one sitting over the 20%
 * ceiling is arithmetic and not a mistake. A rule a book cannot satisfy is dropped
 * from the score rather than counted as a failure -- otherwise a small book is marked
 * down for being small, which is the one thing the count rule already says is fine.
 */
const capIsMeetable = (suggested: number, cap: number): boolean =>
    suggested > 0 && 100 / suggested <= cap;

/** How much each rule is worth in the headline score. They sum to 100. */
const CHECK_WEIGHT: Record<SizingCheckKey, number> = {
    concentration: 25,
    drift: 25,
    sector: 20,
    count: 15,
    minimum: 15,
};

const EMPTY: SizingReport = {
    capital: 0,
    held: 0,
    suggested: 0,
    score: 0,
    grade: 'Concentrated',
    checks: [],
    topStock: null,
    topSector: null,
    rows: [],
    empty: true,
    equalWeighted: true,
    flagged: 0,
};

/**
 * What the plan would have you do about one position.
 *
 * `capApplies` and `floorApplies` are the same gates the checks below are built on, and
 * they are passed in rather than recomputed so the two can never disagree: a rule left
 * out of the score for being unreachable must not still be stamping rows. Without that,
 * a four-name book -- where equal weight is 25% and the 20% ceiling is arithmetically
 * out of reach -- had every row flagged over its cap while the cap itself was excused.
 *
 * Order is by what to do first. The floor outranks the drift band because a position
 * under the floor is a question about whether to hold it at all, which has to be settled
 * before the question of how much of it to hold.
 */
const flagFor = (
    row: Omit<SizingRow, 'flag'>,
    capApplies: boolean,
    floorApplies: boolean
): SizingFlag => {
    if (capApplies && row.weight > SIZING_RULES.MAX_PER_STOCK) return 'over';
    if (floorApplies && row.invested < SIZING_RULES.MIN_POSITION) return 'thin';
    if (row.drift > SIZING_RULES.DRIFT_BAND) return 'trim';
    if (row.drift < -SIZING_RULES.DRIFT_BAND) return 'add';
    return 'ok';
};

/**
 * @param holdings      What is held now, from `computeHoldings` -- cost basis, not market.
 * @param targetWeights Per-symbol target weight from My Symbols, keyed uppercase.
 *                      Relative to each other rather than to 100, exactly as the
 *                      Allocation tab reads them, so they double as the plan's
 *                      conviction scores.
 * @param sectors       Per-symbol sector from My Symbols, keyed uppercase.
 */
export function computeSizing(
    holdings: ComputedHolding[],
    targetWeights: Map<string, number>,
    sectors: Map<string, string>
): SizingReport {
    const capital = holdings.reduce((sum, h) => sum + h.totalCostBasis, 0);
    const held = holdings.length;

    if (held === 0 || capital <= 0) return { ...EMPTY, capital, held };

    const suggested = suggestedCount(capital);

    /*
     * Which of the plan's rules this book can actually be held to. Worked out once, up
     * here, because both the row flags and the checks are built from them -- see
     * `capIsMeetable` for why an unreachable rule stands down rather than failing.
     *
     * The floor gate asks whether the capital could fund N positions at the minimum. On
     * a smaller book the floor is describing a portfolio the money cannot buy, and the
     * count rule has already said how many names that much money wants.
     */
    const capApplies = capIsMeetable(suggested, SIZING_RULES.MAX_PER_STOCK);
    const sectorCapApplies = capIsMeetable(suggested, SIZING_RULES.MAX_PER_SECTOR);
    const floorApplies = capital >= SIZING_RULES.MIN_POSITION * suggested;

    // Only the weights of symbols actually held. A target left on a symbol that has
    // since been sold out would otherwise take a slice of a book it is no longer in,
    // and every remaining row would read underweight against it.
    const totalTargetWeight = holdings.reduce((sum, h) => {
        const weight = targetWeights.get(h.symbol.toUpperCase()) ?? 0;
        return sum + (weight > 0 ? weight : 0);
    }, 0);
    const equalWeighted = !(totalTargetWeight > 0);

    const rows: SizingRow[] = holdings
        .map((h) => {
            const symbol = h.symbol.toUpperCase();
            const invested = h.totalCostBasis;
            const weight = (invested / capital) * 100;

            /*
             * Method C on the plan -- weight = score / sum of scores -- with the My
             * Symbols weights standing in as the conviction scores, since that is
             * already what they are. A held symbol with no weight set, among symbols
             * that have one, lands on a target of zero: the honest reading, because the
             * plan as written has no room for it.
             */
            const target = targetWeights.get(symbol) ?? 0;
            const targetWeight = equalWeighted ? 100 / held : (target / totalTargetWeight) * 100;
            const targetAmount = (targetWeight / 100) * capital;

            const base = {
                symbol,
                sector: sectors.get(symbol) ?? null,
                invested,
                weight,
                targetWeight,
                targetAmount,
                drift: weight - targetWeight,
                gap: targetAmount - invested,
            };

            return { ...base, flag: flagFor(base, capApplies, floorApplies) };
        })
        .sort((a, b) => b.invested - a.invested);

    const checks: SizingCheck[] = [];

    // Step 1. The only rule that can be read off the capital alone.
    const countGap = Math.abs(held - suggested);
    checks.push({
        key: 'count',
        label: 'Count',
        subject: null,
        reading: `${held} held · ${suggested} wanted`,
        rule: `√Capital ÷ ${SIZING_RULES.COUNT_DIVISOR}`,
        score: taper(countGap, 1, 6),
        status: countGap <= 1 ? 'pass' : countGap <= 3 ? 'warn' : 'fail',
    });

    // Step 4, per stock. Rows are sorted by cost and share one denominator, so the
    // first of them is also the heaviest weight.
    const largest = rows[0];
    const topStock = { symbol: largest.symbol, weight: largest.weight };

    if (capApplies) {
        checks.push({
            key: 'concentration',
            label: 'Concentration',
            subject: largest.symbol,
            reading: `${largest.weight.toFixed(1)}%`,
            rule: `Cap ${SIZING_RULES.MAX_PER_STOCK}%`,
            score: taper(largest.weight, SIZING_RULES.SOFT_PER_STOCK, 30),
            status:
                largest.weight > SIZING_RULES.MAX_PER_STOCK
                    ? 'fail'
                    : largest.weight > SIZING_RULES.SOFT_PER_STOCK
                      ? 'warn'
                      : 'pass',
        });
    }

    // Step 4, per sector. Built only from the rows that have a sector -- a symbol never
    // registered on My Symbols has none, and bundling those together would invent a
    // sector whose only meaning is "the ones we don't know about".
    const sectorTotals = new Map<string, number>();
    rows.forEach((r) => {
        if (!r.sector) return;
        sectorTotals.set(r.sector, (sectorTotals.get(r.sector) ?? 0) + r.invested);
    });

    const topSector = Array.from(sectorTotals.entries())
        .map(([name, amount]) => ({ name, weight: (amount / capital) * 100 }))
        .sort((a, b) => b.weight - a.weight)[0];

    if (topSector && sectorCapApplies) {
        checks.push({
            key: 'sector',
            label: 'Sector',
            subject: topSector.name,
            reading: `${topSector.weight.toFixed(1)}%`,
            rule: `Cap ${SIZING_RULES.MAX_PER_SECTOR}%`,
            score: taper(topSector.weight, SIZING_RULES.SOFT_PER_SECTOR, 50),
            status:
                topSector.weight > SIZING_RULES.MAX_PER_SECTOR
                    ? 'fail'
                    : topSector.weight > SIZING_RULES.SOFT_PER_SECTOR
                      ? 'warn'
                      : 'pass',
        });
    }

    // Step 4's floor, on the same gate the row flags use.
    if (floorApplies) {
        const thin = rows.filter((r) => r.invested < SIZING_RULES.MIN_POSITION).length;
        checks.push({
            key: 'minimum',
            label: 'Minimum',
            subject: null,
            reading: thin === 0 ? 'None under' : `${thin} of ${held} under`,
            rule: `Min Rs ${SIZING_RULES.MIN_POSITION.toLocaleString('en-PK')}`,
            score: ((held - thin) / held) * 100,
            status: thin === 0 ? 'pass' : thin / held <= 1 / 3 ? 'warn' : 'fail',
        });
    }

    // Step 6. A count rather than an average of the drifts: the plan's rule is written
    // per position, and an average lets one badly placed position hide behind nine tidy
    // ones.
    const offBand = rows.filter((r) => Math.abs(r.drift) > SIZING_RULES.DRIFT_BAND).length;
    checks.push({
        key: 'drift',
        label: 'Drift',
        subject: null,
        reading: offBand === 0 ? 'All in band' : `${offBand} of ${held} out`,
        rule: `±${SIZING_RULES.DRIFT_BAND}pp`,
        score: ((held - offBand) / held) * 100,
        status: offBand === 0 ? 'pass' : offBand / held <= 1 / 3 ? 'warn' : 'fail',
    });

    const weightTotal = checks.reduce((sum, c) => sum + CHECK_WEIGHT[c.key], 0);
    const score =
        weightTotal > 0
            ? Math.round(
                  checks.reduce((sum, c) => sum + c.score * CHECK_WEIGHT[c.key], 0) / weightTotal
              )
            : 0;

    return {
        capital,
        held,
        suggested,
        score,
        grade: gradeFor(score),
        checks,
        topStock,
        topSector: topSector ?? null,
        rows,
        empty: false,
        equalWeighted,
        flagged: rows.filter((r) => r.flag !== 'ok').length,
    };
}
