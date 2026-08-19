/**
 * Panel typography, split on one line: words in Sora, figures in mono.
 *
 * `DISPLAY` is the face for anything made of words -- labels, titles, tickers,
 * sector names, statuses. It is Sora, the same face as the wordmark, so a panel
 * label and the mark above it are the same voice at different sizes. It is also
 * what globals.css hands to `--font-sans`, so untagged copy (toasts, modal text,
 * buttons) already matches without reaching for this.
 *
 * `NUMERIC` is for figures and nothing else: prices, shares, percentages, dates,
 * counts, chart axes. Mono is here so digits hold their column as prices tick,
 * which is a property only figures need -- a ticker set in it just looks like a
 * teleprinter. The symbols glued to a figure (Rs, %, +/-, the change arrows) stay
 * with it; they're part of the number, not words beside it.
 *
 * Space Grotesk (`--font-heading`) is no longer either of these. It stays loaded
 * for the public screener, which sets its own headings with it.
 */
export const DISPLAY = { fontFamily: 'var(--font-wordmark), sans-serif' } as const;
export const NUMERIC = { fontFamily: 'var(--font-mono), ui-monospace, monospace' } as const;

/**
 * The FINSIP wordmark. The same family as `DISPLAY` now -- kept as its own name
 * because the mark is set at 700/800 and its call sites should say what they are.
 */
export const WORDMARK = { fontFamily: 'var(--font-wordmark), sans-serif' } as const;
