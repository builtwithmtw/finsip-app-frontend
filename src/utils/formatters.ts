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

export const formatMonth = (dateString: string) => {
    // Expects YYYY-MM
    try {
        return format(parseISO(dateString + '-01'), 'MMMM yyyy');
    } catch (e) {
        return dateString;
    }
};

export const formatDate = (dateString: string) => {
    try {
        return format(parseISO(dateString), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
        return dateString;
    }
};
