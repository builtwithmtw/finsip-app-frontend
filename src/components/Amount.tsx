import React from 'react';
import clsx from 'clsx';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { RollingNumber } from './RollingNumber';

// "Rs 1,234" -> ["Rs", "1,234"], so the symbol can sit small and dim beside the
// number instead of competing with it. The privacy mask has no symbol to peel off.
const splitAmount = (formatted: string): [string | null, string] => {
    const match = formatted.match(/^Rs\s*(.*)$/);
    return match ? ['Rs', match[1]] : [null, formatted];
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
    const [symbol, figure] = splitAmount(value);
    return (
        <span className={clsx('flex items-baseline gap-1', className)}>
            {symbol && !bare && (
                <span className="text-[9px] font-medium text-current opacity-45" style={DISPLAY}>
                    {symbol}
                </span>
            )}
            <span className={clsx(size, 'font-semibold leading-none tracking-[-0.03em] tabular-nums')} style={NUMERIC}>
                {roll ? <RollingNumber value={figure} /> : figure}
            </span>
        </span>
    );
};

export default Amount;
