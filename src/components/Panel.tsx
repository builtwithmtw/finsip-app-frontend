import React from 'react';
import clsx from 'clsx';
import { DISPLAY } from '../utils/typography';

/**
 * The surfaces every dashboard card is built from.
 *
 * The look is carried by three things and nothing else: a hairline ring instead of a
 * border, a light seam along the top edge, and micro-labels in the display face keyed
 * to their metric by a short accent tick. Keeping them here means the panels can't
 * drift apart the way eight hand-rolled cards did.
 */

// Light pane. `flush` drops the padding for cards that own their own layout (a table
// that needs to bleed to the edges, for instance).
export const Panel: React.FC<{
    children: React.ReactNode;
    className?: string;
    flush?: boolean;
}> = ({ children, className, flush }) => (
    <div
        className={clsx(
            'relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5',
            'shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]',
            !flush && 'p-4 lg:p-5',
            className
        )}
    >
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent"
        />
        {children}
    </div>
);

// Micro-label. `tone="dark"` lifts it for use on the slate slab.
export const MetricLabel: React.FC<{
    label: string;
    tone?: 'dark' | 'light';
    className?: string;
}> = ({ label, tone = 'light', className }) => (
    <span className={clsx('flex items-center', className)}>
        <span
            className={clsx(
                'text-[10px] font-semibold uppercase leading-none tracking-[0.18em]',
                tone === 'dark' ? 'text-slate-300' : 'text-slate-500'
            )}
            style={DISPLAY}
        >
            {label}
        </span>
    </span>
);

// Card title with its qualifier underneath, and room on the right for a headline
// figure. The title sheds the old font-black for the display face at semibold —
// at this size the heavier weight just closed up the counters.
export const PanelHeader: React.FC<{
    title: string;
    caption?: string;
    children?: React.ReactNode;
}> = ({ title, caption, children }) => (
    <div className="mb-4 flex items-start justify-between gap-4">
        <div>
            <h3
                className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                style={DISPLAY}
            >
                {title}
            </h3>
            {caption && (
                <p
                    className="mt-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                    style={DISPLAY}
                >
                    {caption}
                </p>
            )}
        </div>
        {children && <div className="shrink-0 text-right">{children}</div>}
    </div>
);
