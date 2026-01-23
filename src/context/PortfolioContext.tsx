import React, { createContext, useContext, type ReactNode } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import type { Transaction, Stock, CashEntry, Payout } from '../types';

interface PortfolioContextType {
    transactions: Transaction[];
    stocks: Stock[];
    cashEntries: CashEntry[];
    payouts: Payout[];
    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => void;
    deleteTransaction: (id: string) => void;
    deleteMonthTransactions: (month: string) => void;
    addStock: (symbol: string, sector: string) => void;
    removeStock: (id: string) => void;
    addCashEntry: (entry: Omit<CashEntry, 'id' | 'createdAt'>) => void;
    deleteCashEntry: (id: string) => void;
    addPayout: (payout: Omit<Payout, 'id' | 'createdAt'>) => void;
    deletePayout: (id: string) => void;
    importAllData: (data: { transactions: Transaction[], stocks: Stock[], cashEntries: CashEntry[], payouts: Payout[] }) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [transactions, setTransactions] = useLocalStorage<Transaction[]>('sip-transactions', []);
    const [stocks, setStocks] = useLocalStorage<Stock[]>('sip-stocks', []);
    const [cashEntries, setCashEntries] = useLocalStorage<CashEntry[]>('sip-cash', []);
    const [payouts, setPayouts] = useLocalStorage<Payout[]>('sip-payouts', []);

    const addStock = (symbol: string, sector: string) => {
        if (stocks.some(s => s.symbol === symbol.toUpperCase())) return;
        const newStock: Stock = {
            id: crypto.randomUUID(),
            symbol: symbol.toUpperCase(),
            sector,
            createdAt: Date.now(),
        };
        setStocks(prev => [...prev, newStock]);
    };

    const removeStock = (id: string) => {
        setStocks(prev => prev.filter(s => s.id !== id));
    };

    const addTransaction = (data: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => {
        const newTransaction: Transaction = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            totalAmount: data.shares * data.pricePerShare,
        };
        setTransactions((prev) => [newTransaction, ...prev]);
    };

    const deleteTransaction = (id: string) => {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
    };

    const deleteMonthTransactions = (month: string) => {
        setTransactions((prev) => prev.filter((t) => t.month !== month));
    };

    const addCashEntry = (data: Omit<CashEntry, 'id' | 'createdAt'>) => {
        const newEntry: CashEntry = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        setCashEntries(prev => [...prev, newEntry]);
    };

    const deleteCashEntry = (id: string) => {
        setCashEntries(prev => prev.filter(e => e.id !== id));
    };

    const addPayout = (data: Omit<Payout, 'id' | 'createdAt'>) => {
        const newPayout: Payout = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        setPayouts(prev => [...prev, newPayout]);
    };

    const deletePayout = (id: string) => {
        setPayouts(prev => prev.filter(p => p.id !== id));
    };

    const importAllData = (data: { transactions: Transaction[], stocks: Stock[], cashEntries: CashEntry[], payouts: Payout[] }) => {
        if (data.transactions) setTransactions(data.transactions);
        if (data.stocks) setStocks(data.stocks);
        if (data.cashEntries) setCashEntries(data.cashEntries);
        if (data.payouts) setPayouts(data.payouts);
    };

    return (
        <PortfolioContext.Provider value={{
            transactions,
            stocks,
            cashEntries,
            payouts,
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
