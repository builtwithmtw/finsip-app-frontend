/**
 * Panel typography.
 *
 * Space Grotesk and JetBrains Mono are loaded app-wide by next/font as bare CSS
 * variables, but globals.css only binds them inside `.screener-root`. Surfaces that
 * want the instrument-panel look reach for them directly through these two styles:
 * the geometric display face on labels, mono on every figure so digits hold their
 * column as prices tick.
 */
export const DISPLAY = { fontFamily: 'var(--font-heading), sans-serif' } as const;
export const NUMERIC = { fontFamily: 'var(--font-mono), ui-monospace, monospace' } as const;

/**
 * The FINSIP wordmark, and nothing else. Sora, loaded at 700/800 only -- setting
 * body copy in it would undo the point of having a face reserved for the mark.
 */
export const WORDMARK = { fontFamily: 'var(--font-wordmark), sans-serif' } as const;
