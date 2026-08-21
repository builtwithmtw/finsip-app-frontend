import React from 'react';
import clsx from 'clsx';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { RollingNumber } from './RollingNumber';

/**
 * "Rs 1,234" -> ["Rs", "1,234", false], so the symbol can sit small and dim beside the
 * number instead of competing with it.
 *
 * The sign comes off first. `Intl` puts it in front of the currency symbol -- a loss
 * formats as "-Rs 2,166" -- so a pattern anchored at "Rs" missed every negative figure
 * in the app and handed the whole string back as the number, symbol and all. That is
 * why a loss used to render with a full-size "Rs" where a profit had the small one.
 *
 * The privacy mask has neither symbol nor sign to peel off, so it falls through as the
 * figure and is never bracketed -- masking hides the direction along with the amount.
 */
const splitAmount = (formatted: string): [string | null, string, boolean] => {
    // Both the ASCII hyphen Intl emits and the typographic minus used elsewhere.
    const negative = /^[-−]/.test(formatted);
    const unsigned = negative ? formatted.slice(1) : formatted;
    const match = unsigned.match(/^Rs\s*(.*)$/);

    return match ? ['Rs', match[1], negative] : [null, unsigned, negative];
};

/**
 * A currency figure in panel dress: dim symbol, mono numerals. The symbol inherits
 * `currentColor` at low opacity, so it recedes correctly inside a coloured (P/L)
 * context as well as a neutral one.
 *
 * `bare` drops the symbol altogether, for places that repeat several figures in a row
 * and where the currency is never in question -- the navbar panel, chiefly.
 *
 * `roll` sets the digits on an odometer, for figures that change under the reader while
 * they are looking at them.
 */
export const Amount: React.FC<{
    value: string;
    size?: string;
    className?: string;
    bare?: boolean;
    roll?: boolean;
}> = ({
    value,
    size = 'text-[17px]',
    className,
    bare = false,
    roll = false,
}) => {
    const [symbol, figure, negative] = splitAmount(value);

    /*
     * Accounting brackets rather than a leading minus: the sign wraps the figure instead
     * of sitting where the eye starts reading the first digit, and it can't be taken for
     * the dash in a range. Not aria-hidden -- the brackets are the only thing left
     * carrying the sign once the minus is gone, and colour alone doesn't reach a reader
     * who isn't looking at it.
     *
     * The brackets are laid out with margins rather than the container's `gap`, which
     * would hold them a quarter-rem clear of the number they belong to.
     */
    const paren = clsx(size, 'font-semibold leading-none opacity-70');

    return (
        <span className={clsx('flex items-baseline', className)}>
            {negative && (
                <span className={paren} style={NUMERIC}>
                    (
                </span>
            )}
            {symbol && !bare && (
                <span className="mr-1 text-[9px] font-medium text-current opacity-45" style={DISPLAY}>
                    {symbol}
                </span>
            )}
            <span className={clsx(size, 'font-semibold leading-none tracking-[-0.03em] tabular-nums')} style={NUMERIC}>
                {roll ? <RollingNumber value={figure} /> : figure}
            </span>
            {negative && (
                <span className={paren} style={NUMERIC}>
                    )
                </span>
            )}
        </span>
    );
};

export default Amount;
