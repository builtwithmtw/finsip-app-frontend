import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Transaction, Stock, CashEntry, Payout } from '../types';
import { toast } from 'sonner';

interface PortfolioContextType {
    transactions: Transaction[];
    stocks: Stock[];
    cashEntries: CashEntry[];
    payouts: Payout[];
    loading: boolean;
    refreshData: () => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    deleteMonthTransactions: (month: string) => Promise<void>;
    addStock: (symbol: string, sector: string) => Promise<void>;
    removeStock: (id: string) => Promise<void>;
    addCashEntry: (entry: Omit<CashEntry, 'id' | 'createdAt'>) => Promise<void>;
    deleteCashEntry: (id: string) => Promise<void>;
    addPayout: (payout: Omit<Payout, 'id' | 'createdAt'>) => Promise<void>;
    deletePayout: (id: string) => Promise<void>;
    importAllData: (data: { transactions: Transaction[], stocks: Stock[], cashEntries: CashEntry[], payouts: Payout[] }) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                { data: stocksData },
                { data: transData },
                { data: cashData },
                { data: payoutsData }
            ] = await Promise.all([
                supabase.from('stocks').select('*').order('created_at', { ascending: true }),
                supabase.from('transactions').select('*').order('month', { ascending: false }),
                supabase.from('cash_entries').select('*').order('month', { ascending: false }),
                supabase.from('payouts').select('*').order('date', { ascending: false })
            ]);

            if (stocksData) {
                setStocks(stocksData.map(s => ({
                    id: s.id,
                    symbol: s.symbol,
                    sector: s.sector,
                    createdAt: s.created_at
                })));
            }

            if (transData) {
                setTransactions(transData.map(t => ({
                    id: t.id,
                    symbol: t.symbol,
                    shares: t.shares,
                    pricePerShare: t.price_per_share,
                    totalAmount: t.total_amount,
                    type: t.type,
                    month: t.month,
                    createdAt: t.created_at
                })));
            }

            if (cashData) {
                setCashEntries(cashData.map(c => ({
                    id: c.id,
                    month: c.month,
                    amount: c.amount,
                    memo: c.memo,
                    createdAt: c.created_at
                })));
            }

            if (payoutsData) {
                setPayouts(payoutsData.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    amount: p.amount,
                    date: p.date,
                    createdAt: p.created_at
                })));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to connect to Supabase');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const addStock = async (symbol: string, sector: string) => {
        const { data, error } = await supabase
            .from('stocks')
            .insert([{ symbol: symbol.toUpperCase(), sector }])
            .select()
            .single();

        if (error) {
            toast.error('Error adding stock: ' + error.message);
            return;
        }

        setStocks(prev => [...prev, {
            id: data.id,
            symbol: data.symbol,
            sector: data.sector,
            createdAt: data.created_at
        }]);
    };

    const removeStock = async (id: string) => {
        const { error } = await supabase.from('stocks').delete().eq('id', id);
        if (error) {
            toast.error('Error removing stock: ' + error.message);
            return;
        }
        setStocks(prev => prev.filter(s => s.id !== id));
    };

    const addTransaction = async (data: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => {
        const totalAmount = data.shares * data.pricePerShare;
        const { data: inserted, error } = await supabase
            .from('transactions')
            .insert([{
                symbol: data.symbol,
                shares: data.shares,
                price_per_share: data.pricePerShare,
                total_amount: totalAmount,
                type: data.type,
                month: data.month
            }])
            .select()
            .single();

        if (error) {
            toast.error('Error adding transaction: ' + error.message);
            return;
        }

        setTransactions(prev => [{
            id: inserted.id,
            symbol: inserted.symbol,
            shares: inserted.shares,
            pricePerShare: inserted.price_per_share,
            totalAmount: inserted.total_amount,
            type: inserted.type,
            month: inserted.month,
            createdAt: inserted.created_at
        }, ...prev]);
    };

    const deleteTransaction = async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) {
            toast.error('Error deleting transaction: ' + error.message);
            return;
        }
        setTransactions(prev => prev.filter(t => t.id !== id));
    };

    const deleteMonthTransactions = async (month: string) => {
        const { error } = await supabase.from('transactions').delete().eq('month', month);
        if (error) {
            toast.error('Error deleting month data: ' + error.message);
            return;
        }
        setTransactions(prev => prev.filter(t => t.month !== month));
    };

    const addCashEntry = async (data: Omit<CashEntry, 'id' | 'createdAt'>) => {
        const { data: inserted, error } = await supabase
            .from('cash_entries')
            .insert([{ amount: data.amount, month: data.month, memo: data.memo }])
            .select()
            .single();

        if (error) {
            toast.error('Error adding budget: ' + error.message);
            return;
        }

        setCashEntries(prev => [...prev, {
            id: inserted.id,
            month: inserted.month,
            amount: inserted.amount,
            memo: inserted.memo,
            createdAt: inserted.created_at
        }]);
    };

    const deleteCashEntry = async (id: string) => {
        const { error } = await supabase.from('cash_entries').delete().eq('id', id);
        if (error) {
            toast.error('Error deleting budget: ' + error.message);
            return;
        }
        setCashEntries(prev => prev.filter(e => e.id !== id));
    };

    const addPayout = async (data: Omit<Payout, 'id' | 'createdAt'>) => {
        const { data: inserted, error } = await supabase
            .from('payouts')
            .insert([{ symbol: data.symbol, amount: data.amount, date: data.date }])
            .select()
            .single();

        if (error) {
            toast.error('Error adding payout: ' + error.message);
            return;
        }

        setPayouts(prev => [...prev, {
            id: inserted.id,
            symbol: inserted.symbol,
            amount: inserted.amount,
            date: inserted.date,
            createdAt: inserted.created_at
        }]);
    };

    const deletePayout = async (id: string) => {
        const { error } = await supabase.from('payouts').delete().eq('id', id);
        if (error) {
            toast.error('Error deleting payout: ' + error.message);
            return;
        }
        setPayouts(prev => prev.filter(p => p.id !== id));
    };

    const importAllData = async (data: { transactions: Transaction[], stocks: Stock[], cashEntries: CashEntry[], payouts: Payout[] }) => {
        setLoading(true);
        try {
            // Delete existing data sequentially to avoid foreign key issues (though none currently exist)
            // and to catch errors early.
            const { error: delStocksErr } = await supabase.from('stocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error: delTransErr } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error: delCashErr } = await supabase.from('cash_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error: delPayoutsErr } = await supabase.from('payouts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            if (delStocksErr || delTransErr || delCashErr || delPayoutsErr) {
                throw new Error('Failed to clear existing database data before restore.');
            }

            // Insert new data
            if (data.stocks && data.stocks.length > 0) {
                const { error } = await supabase.from('stocks').insert(
                    data.stocks.map(s => ({
                        symbol: (s.symbol || '').toUpperCase(),
                        sector: s.sector || 'Others'
                    }))
                );
                if (error) throw new Error('Stocks sync failed: ' + error.message);
            }

            if (data.transactions && data.transactions.length > 0) {
                const { error } = await supabase.from('transactions').insert(
                    data.transactions.map(t => {
                        const shares = t.shares ?? 0;
                        const price = t.pricePerShare ?? (t as any).price_per_share ?? 0;
                        return {
                            symbol: (t.symbol || '').toUpperCase(),
                            shares: shares,
                            price_per_share: price,
                            total_amount: t.totalAmount ?? (t as any).total_amount ?? (shares * price),
                            type: t.type || 'buy',
                            month: t.month || (t as any).date?.substring(0, 7) || new Date().toISOString().substring(0, 7)
                        };
                    })
                );
                if (error) throw new Error('Transactions sync failed: ' + error.message);
            }

            if (data.cashEntries && data.cashEntries.length > 0) {
                const { error } = await supabase.from('cash_entries').insert(
                    data.cashEntries.map(c => ({
                        amount: c.amount ?? (c as any).amount ?? 0,
                        month: c.month || (c as any).date || new Date().toISOString().substring(0, 7),
                        memo: c.memo || (c as any).origin || (c as any).description || ''
                    }))
                );
                if (error) throw new Error('Cash entries sync failed: ' + error.message);
            }

            if (data.payouts && data.payouts.length > 0) {
                const { error } = await supabase.from('payouts').insert(
                    data.payouts.map(p => ({
                        symbol: (p.symbol || (p as any).stockSymbol || '').toUpperCase(),
                        amount: p.amount ?? (p as any).amount ?? 0,
                        date: p.date || (p as any).month || new Date().toISOString().split('T')[0]
                    }))
                );
                if (error) throw new Error('Payouts sync failed: ' + error.message);
            }

            await fetchData();
            toast.success('Full sync complete!');
        } catch (error: any) {
            console.error('Import error:', error);
            toast.error(error.message || 'Failed to import data to Supabase');
            throw error; // Re-throw to be caught by toast.promise in DataPage
        } finally {
            setLoading(false);
        }
    };

    return (
        <PortfolioContext.Provider value={{
            transactions,
            stocks,
            cashEntries,
            payouts,
            loading,
            refreshData: fetchData,
            addTransaction,
            deleteTransaction,
            deleteMonthTransactions,
            addStock,
            removeStock,
            addCashEntry,
            deleteCashEntry,
            addPayout,
            deletePayout,
            importAllData
        }}>
            {children}
        </PortfolioContext.Provider>
    );
};

export const usePortfolio = () => {
    const context = useContext(PortfolioContext);
    if (context === undefined) {
        throw new Error('usePortfolio must be used within a PortfolioProvider');
    }
    return context;
};
