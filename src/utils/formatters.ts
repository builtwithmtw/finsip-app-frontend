import { format, parseISO } from 'date-fns';

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        currencyDisplay: 'symbol',
        maximumFractionDigits: 2,
    }).format(amount).replace('PKR', 'Rs');
};

export const formatMonth = (dateString: string) => {
    // Expects YYYY-MM
    try {
        return format(parseISO(dateString + '-01'), 'MMMM yyyy');
    } catch (e) {
        return dateString;
    }
};
