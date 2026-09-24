import React from 'react';

/**
 * Shariah compliance, drawn rather than typed.
 *
 * lucide has no mosque, so this is one in its house style -- 24 unit box, 2 unit
 * strokes, round caps, `currentColor` -- which is what keeps it a sibling of every
 * other icon in the app instead of a picture pasted next to them. That is also the
 * whole difference from the 🕌 it replaces: an emoji arrives at whatever size, weight
 * and colour the reader's font vendor chose, full-bleed and usually multicolour, which
 * is why it read as an ornament. This one is a hairline in the row's own green.
 *
 * Kept to seven strokes -- finial, dome, two walls, two minarets, ground -- because it
 * is drawn at 13px and an arched doorway at that size is a smudge.
 *
 * Lives here rather than beside the allocation table it was drawn for, because the
 * watchlist marks its compliant rows with it too and two copies of the same seven paths
 * would drift.
 */
export const ShariahMark: React.FC = () => (
    <svg
        role="img"
        aria-label="Shariah compliant"
        viewBox="0 0 24 24"
        width={13}
        height={13}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-emerald-600"
    >
        <title>Shariah compliant</title>
        <path d="M12 4v1.5" />
        <path d="M7.5 12.5a4.5 4.5 0 0 1 9 0" />
        <path d="M7.5 12.5V20" />
        <path d="M16.5 12.5V20" />
        <path d="M4 9.5V20" />
        <path d="M20 9.5V20" />
        <path d="M3 20h18" />
    </svg>
);

export default ShariahMark;
