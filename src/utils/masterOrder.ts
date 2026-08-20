/**
 * The Asset Master List order -- the one set by dragging chips on Overview.
 *
 * It is the app's canonical order for positions, so Live Portfolio and the allocation
 * tables open in it rather than each ranking by whichever figure they happen to show.
 * A symbol that isn't on the master list (bought before it was added, or removed from
 * it) sorts after everything that is, keeping its own relative order.
 */
export const masterRankOf = (stocks: { symbol: string }[]) => {
    const rank = new Map<string, number>();
    stocks.forEach((s, index) => rank.set(s.symbol.toUpperCase(), index));

    return (symbol: string): number =>
        rank.get(symbol.toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
};
