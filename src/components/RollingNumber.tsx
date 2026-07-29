"use client";

import React from 'react';
import clsx from 'clsx';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Odometer digits.
 *
 * Each digit position is a 1em window over a stacked column of 0-9; changing the value
 * just moves the column, and the browser tweens the transform. Separators (commas, a
 * minus, the privacy mask) are printed as-is -- only digits roll.
 *
 * Sizing is in `em` throughout, so the same component works at any font size without
 * being told what that size is. It relies on the figure being set in the mono face, as
 * every figure in the app is: proportional digits would make each window a different
 * width and the number would jitter as it rolled.
 *
 * The visual stack is hidden from assistive tech behind a plain copy of the value, so a
 * screen reader reads the number once instead of announcing ten digits per position.
 */
export const RollingNumber: React.FC<{ value: string; className?: string }> = ({ value, className }) => (
    <span className={clsx('inline-flex leading-none', className)}>
        <span className="sr-only">{value}</span>
        {value.split('').map((char, i) => {
            const digit = DIGITS.indexOf(char);

            if (digit === -1) {
                return (
                    <span key={i} aria-hidden>
                        {char}
                    </span>
                );
            }

            return (
                <span key={i} className="relative inline-block h-[1em] overflow-hidden align-bottom" aria-hidden>
                    {/* Holds the column's width open; the rolling stack is absolute. */}
                    <span className="invisible">0</span>
                    <span
                        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-700 ease-out motion-reduce:transition-none"
                        style={{ transform: `translateY(-${digit}em)` }}
                    >
                        {DIGITS.map(d => (
                            <span key={d} className="flex h-[1em] items-center justify-center">
                                {d}
                            </span>
                        ))}
                    </span>
                </span>
            );
        })}
    </span>
);

export default RollingNumber;
