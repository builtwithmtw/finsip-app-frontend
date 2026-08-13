"use client";

import React, { useMemo } from 'react';

/**
 * A deterministic identicon drawn from a seed -- in practice, the signed-in email.
 *
 * Everything is computed here and rendered as inline SVG: no request leaves the app, so
 * the avatar can't leak who is signed in, can't fail to load, and needs no fallback.
 * The same address always produces the same mark.
 */

const GRID = 5;
// Mirrored down the middle, so only the left half and the spine are decided.
const HALF = Math.ceil(GRID / 2);

// FNV-1a, 32-bit. Not a security hash -- it just has to scatter similar addresses
// (talha1@ / talha2@) onto visibly different marks, which it does.
const hashSeed = (seed: string): number => {
    let hash = 0x811c9dc5;

    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
};

/** Deterministic bit stream from the hash, so the same seed always fills the same cells. */
const bitsFrom = (hash: number, count: number): boolean[] => {
    let state = hash || 1;

    return Array.from({ length: count }, () => {
        // xorshift32: cheap, and its low bit doesn't sit in a short cycle the way an
        // LCG's does -- which would stripe the grid.
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return (state & 1) === 1;
    });
};

interface AvatarProps {
    /** Usually the email. Falsy renders the empty slab rather than a mark for "".  */
    seed?: string | null;
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ seed, className }) => {
    const mark = useMemo(() => {
        const normalized = seed?.trim().toLowerCase();
        if (!normalized) return null;

        const hash = hashSeed(normalized);
        const bits = bitsFrom(hash, HALF * GRID);

        const cells: Array<{ x: number; y: number }> = [];

        for (let col = 0; col < HALF; col++) {
            for (let row = 0; row < GRID; row++) {
                if (!bits[col * GRID + row]) continue;
                cells.push({ x: col, y: row });
                // The mirror. The centre column is its own reflection, so it's skipped.
                if (col < HALF - 1) cells.push({ x: GRID - 1 - col, y: row });
            }
        }

        // Two hues a fixed distance apart rather than one flat colour: the second tone
        // picks out the spine, which is what stops a sparse mark reading as noise.
        const hue = hash % 360;

        return {
            cells,
            primary: `hsl(${hue} 85% 66%)`,
            accent: `hsl(${(hue + 42) % 360} 90% 74%)`,
        };
    }, [seed]);

    if (!mark) return null;

    return (
        <svg
            viewBox={`-0.5 -0.5 ${GRID + 1} ${GRID + 1}`}
            className={className}
            aria-hidden
            shapeRendering="geometricPrecision"
        >
            {mark.cells.map(({ x, y }) => (
                <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width={1}
                    height={1}
                    rx={0.22}
                    fill={x === Math.floor(GRID / 2) ? mark.accent : mark.primary}
                />
            ))}
        </svg>
    );
};

export default Avatar;
