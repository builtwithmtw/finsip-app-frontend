import { format, parseISO } from 'date-fns';

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        currencyDisplay: 'symbol',
        maximumFractionDigits: 2,
    }).format(amount).replace('PKR', 'Rs');
};

/**
 * The same figure at a glance: "Rs 272k", "Rs 1.2M".
 *
 * For the nav bar only, where Worth and Cost run to seven digits inside a fixed strip
 * that also has to hold the tabs and the controls. Everywhere else the exact figure is
 * the point and prints in full -- this is a headline, not a reading you would act on.
 *
 * One decimal below ten of a unit and none above it, so the string stays roughly the
 * same width whatever the number does: 5k, 9.4k, 272k, 1.2M, 12M. A trailing ".0" is
 * dropped rather than printed, since "1.0M" claims a precision the abbreviation does
 * not have. Under a thousand there is nothing to abbreviate and it prints as-is.
 *
 * The "Rs " prefix is kept in the same shape `formatCurrency` produces, because
 * `Amount` splits on it to set the symbol small and dim beside the figure.
 */
export const formatCompactCurrency = (amount: number): string => {
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);

    const scaled = (value: number, suffix: string) => {
        const text = value < 10
            ? value.toFixed(1).replace(/\.0$/, '')
            : Math.round(value).toLocaleString('en-PK');
        return `${sign}Rs ${text}${suffix}`;
    };

    /*
     * The boundaries are where the *rounded* figure would overflow its unit, not where
     * the raw one does. At a flat 1,000,000 the step below it renders 999,999 as
     * "1,000k" -- arithmetically right and obviously wrong to read, since the whole
     * point of the unit is that it never carries four digits.
     */
    if (abs >= 999_500) return scaled(abs / 1_000_000, 'M');
    if (abs >= 999.5) return scaled(abs / 1_000, 'k');

    return `${sign}Rs ${Math.round(abs).toLocaleString('en-PK')}`;
};

/**
 * Initials from the local part of an email: talha.iways@x.com -> TI, devops@x.com -> DE.
 * Separator-joined names give one letter per name; a single name gives its first two letters.
 */
export const getInitials = (email?: string | null): string => {
    const localPart = (email ?? '').split('@')[0];
    const words = localPart.split(/[._+-]+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

    return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * 1,250,000 -> 1.3m, 120,000 -> 120k. For chart axes, where the tick is there to give
 * the scale and the exact figure belongs in the tooltip.
 */
export const compactNumber = (value: number): string => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);

    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
    return `${sign}${Math.round(abs)}`;
};

export const formatMonth = (dateString: string) => {
    // Expects YYYY-MM, or a bare YYYY from the ledger's yearly columns -- a year has
    // no month to name, so it is already its own label.
    if (/^\d{4}$/.test(dateString)) return dateString;

    try {
        return format(parseISO(dateString + '-01'), 'MMMM yyyy');
    } catch (e) {
        return dateString;
    }
};
