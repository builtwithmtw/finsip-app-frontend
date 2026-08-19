import React from 'react';
import clsx from 'clsx';

/**
 * The verified mark, drawn the way the platforms draw it: the scalloped badge is
 * filled and the check is knocked out of it in white. Lucide's `BadgeCheck` is the
 * same silhouette but outlined, which reads as an icon sitting next to a name rather
 * than as a badge attached to it.
 *
 * The colour comes from `currentColor`, so the caller sets it with a text class.
 */
export const VerifiedBadge: React.FC<{ size?: number; className?: string; title?: string }> = ({
    size = 14,
    className,
    title = 'Verified',
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-label={title}
        className={clsx('shrink-0', className)}
    >
        <title>{title}</title>
        <path
            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
            fill="currentColor"
        />
        <path
            d="m9 12 2 2 4-4"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default VerifiedBadge;
