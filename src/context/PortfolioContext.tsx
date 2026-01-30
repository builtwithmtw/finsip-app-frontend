import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useProxy } from './ProxyContext';
import { supabase } from '../lib/supabase';
import type { Transaction, Stock, CashEntry, Payout, RealizedProfit } from '../types';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface PortfolioContextType {
    transactions: Transaction[];
    stocks: Stock[];
    cashEntries: CashEntry[];
    payouts: Payout[];
    realizedProfits: RealizedProfit[];
    loading: boolean;
    // Live Market Data
    livePrices: Record<string, number>;
    isMarketLive: boolean;

    refreshData: () => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => Promise<void>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    deleteMonthTransactions: (month: string) => Promise<void>;
    addStock: (symbol: string, sector: string) => Promise<void>;
    removeStock: (id: string) => Promise<void>;
    addCashEntry: (entry: Omit<CashEntry, 'id' | 'createdAt'>) => Promise<void>;
    updateCashEntry: (id: string, updates: Partial<CashEntry>) => Promise<void>;
    deleteCashEntry: (id: string) => Promise<void>;
    addPayout: (payout: Omit<Payout, 'id' | 'createdAt'>) => Promise<void>;
    updatePayout: (id: string, updates: Partial<Payout>) => Promise<void>;
    deletePayout: (id: string) => Promise<void>;
    importAllData: (data: {
        transactions: Transaction[],
        stocks: Stock[],
        cashEntries: CashEntry[],
        payouts: Payout[],
        realizedProfits: RealizedProfit[]
    }) => Promise<void>;
    recalculateRealizedProfits: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [realizedProfits, setRealizedProfits] = useState<RealizedProfit[]>([]);
    const [loading, setLoading] = useState(false);

    // Centralized Live Market State
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [isMarketLive, setIsMarketLive] = useState(false);

    const { selectedProxy, setShowModal, setRetryFetch } = useProxy();

    const fetchMarketData = useCallback(async () => {
        try {
            const targetUrl = "https://beta-restapi.sarmaaya.pk/api/indices/KSE100/companies?page=1&limit=500";
            const proxyUrl = selectedProxy.url + encodeURIComponent(targetUrl);

            console.log(`[PortfolioContext] Fetching Feed via ${selectedProxy.name}...`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const json = await response.json();
            const prices: Record<string, number> = {};

            const dataArray = (json && json.response?.data) ? json.response.data :
                (json?.data) ? json.data :
                    (Array.isArray(json) ? json : []);

            if (dataArray.length > 0) {
                dataArray.forEach((item: any) => {
                    const symbol = (item.symbol || item.ticker || "").toString().toUpperCase().trim();
                    const price = Number(item.curr || item.last_price || item.price || 0);
                    if (symbol && price > 0) {
                        prices[symbol] = price;
                    }
                });

                if (Object.keys(prices).length > 0) {
                    setLivePrices(prices);
                    setIsMarketLive(true);
                }
            } else {
                throw new Error("Empty data response");
            }
        } catch (err) {
            console.error("[PortfolioContext] Market Data Fetch Warning:", err);
            setIsMarketLive(false);
            setShowModal(true);
            toast.error(`Connection failed via ${selectedProxy.name}. Please select another gateway.`);
        }
    }, [selectedProxy, setShowModal]);

    // Register retry function for the Proxy Terminal
    useEffect(() => {
        setRetryFetch(() => fetchMarketData);
    }, [fetchMarketData, setRetryFetch]);

    useEffect(() => {
        fetchMarketData();
        const interval = setInterval(fetchMarketData, 5 * 60 * 1000); // 5 Minutes
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [
                { data: stocksData },
                { data: transData },
                { data: cashData },
                { data: payoutsData },
                { data: pnlData }
            ] = await Promise.all([
                supabase.from('stocks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
                supabase.from('transactions').select('*').eq('user_id', user.id).order('month', { ascending: false }),
                supabase.from('cash_entries').select('*').eq('user_id', user.id).order('month', { ascending: false }),
                supabase.from('payouts').select('*').eq('user_id', user.id).order('date', { ascending: false }),
                supabase.from('realized_pnl').select('*').eq('user_id', user.id).order('sell_date', { ascending: false })
            ]);

            if (stocksData) {
                setStocks(stocksData.map(s => ({
                    id: s.id,
                    symbol: s.symbol,
                    sector: s.sector,
                    createdAt: s.created_at
                })));
            } else {
                setStocks([]);
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
            } else {
                setTransactions([]);
            }

            if (cashData) {
                setCashEntries(cashData.map(c => ({
                    id: c.id,
                    month: c.month,
                    amount: c.amount,
                    memo: c.memo,
                    createdAt: c.created_at
                })));
            } else {
                setCashEntries([]);
            }

            if (payoutsData) {
                setPayouts(payoutsData.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    amount: p.amount,
                    date: p.date,
                    createdAt: p.created_at
                })));
            } else {
                setPayouts([]);
            }

            if (pnlData) {
                setRealizedProfits(pnlData.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    quantitySold: Number(p.quantity_sold),
                    avgBuyPrice: Number(p.avg_buy_price),
                    avgSellPrice: Number(p.avg_sell_price),
                    realizedProfit: Number(p.realized_profit),
                    sellDate: p.sell_date,
                    createdAt: p.created_at
                })));
            } else {
                setRealizedProfits([]);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to sync with secure backup');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        } else {
            // Reset state when not authorized
            setTransactions([]);
            setStocks([]);
            setCashEntries([]);
            setPayouts([]);
        }
    }, [user?.id]); // Only refetch when user ID actually changes

    const addStock = async (symbol: string, sector: string) => {
        if (!user) return;
        const { data, error } = await supabase
            .from('stocks')
            .insert([{
                symbol: symbol.toUpperCase(),
                sector,
                user_id: user.id
            }])
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
        if (!user) return;
        const totalAmount = data.shares * data.pricePerShare;

        const { data: inserted, error } = await supabase
            .from('transactions')
            .insert([{
                symbol: data.symbol,
                shares: data.shares,
                price_per_share: data.pricePerShare,
                total_amount: totalAmount,
                type: data.type,
                month: data.month,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) {
            toast.error('Error adding transaction: ' + error.message);
            return;
        }

        // If it's a sell, calculate and record realized profit
        if (data.type === 'sell') {
            // Calculate avg buy price using current holdings logic
            const symbolTransactions = transactions.filter(t => t.symbol === data.symbol);
            let totalSharesAtSymbol = 0;
            let totalCostBasisAtSymbol = 0;

            // Sort existing transactions chronologically to calculate avg cost
            [...symbolTransactions]
                .sort((a, b) => a.month.localeCompare(b.month))
                .forEach(t => {
                    if (t.type === 'buy') {
                        totalSharesAtSymbol += t.shares;
                        totalCostBasisAtSymbol += t.totalAmount;
                    } else {
                        const avgPriceBeforeSell = totalSharesAtSymbol > 0 ? totalCostBasisAtSymbol / totalSharesAtSymbol : 0;
                        totalSharesAtSymbol -= t.shares;
                        totalCostBasisAtSymbol -= t.shares * avgPriceBeforeSell;
                    }
                });

            const avgBuyPrice = totalSharesAtSymbol > 0 ? totalCostBasisAtSymbol / totalSharesAtSymbol : 0;
            const realizedProfitValue = (data.pricePerShare - avgBuyPrice) * data.shares;

            const { data: pnlData, error: pnlError } = await supabase
                .from('realized_pnl')
                .insert([{
                    symbol: data.symbol,
                    quantity_sold: data.shares,
                    avg_buy_price: avgBuyPrice,
                    avg_sell_price: data.pricePerShare,
                    realized_profit: realizedProfitValue,
                    sell_date: new Date().toISOString().split('T')[0],
                    transaction_id: inserted.id,
                    user_id: user.id
                }])
                .select()
                .single();

            if (!pnlError && pnlData) {
                setRealizedProfits(prev => [{
                    id: pnlData.id,
                    symbol: pnlData.symbol,
                    quantitySold: Number(pnlData.quantity_sold),
                    avgBuyPrice: Number(pnlData.avg_buy_price),
                    avgSellPrice: Number(pnlData.avg_sell_price),
                    realizedProfit: Number(pnlData.realized_profit),
                    sellDate: pnlData.sell_date,
                    createdAt: pnlData.created_at
                }, ...prev]);
            }
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

    const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
        if (!user) return;
        const existing = transactions.find(t => t.id === id);
        if (!existing) return;

        const updatedShares = updates.shares ?? existing.shares;
        const updatedPrice = updates.pricePerShare ?? existing.pricePerShare;
        const totalAmount = updatedShares * updatedPrice;

        const { error } = await supabase
            .from('transactions')
            .update({
                symbol: updates.symbol,
                shares: updates.shares,
                price_per_share: updates.pricePerShare,
                total_amount: totalAmount,
                type: updates.type,
                month: updates.month
            })
            .eq('id', id);

        if (error) {
            toast.error('Error updating transaction: ' + error.message);
            return;
        }

        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates, totalAmount } : t));
        toast.success('Transaction updated');
    };

    const deleteTransaction = async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) {
            toast.error('Error deleting transaction: ' + error.message);
            return;
        }
        setTransactions(prev => prev.filter(t => t.id !== id));
        // Note: Realized P&L records will be automatically deleted due to ON DELETE CASCADE
        setRealizedProfits(prev => prev.filter(p => (p as any).transaction_id !== id));
    };

    const deleteMonthTransactions = async (month: string) => {
        const { error } = await supabase.from('transactions').delete().eq('month', month);
        if (error) {
            toast.error('Error deleting month data: ' + error.message);
            return;
        }
        const deletedIds = transactions.filter(t => t.month === month).map(t => t.id);
        setTransactions(prev => prev.filter(t => t.month !== month));
        setRealizedProfits(prev => prev.filter(p => !deletedIds.includes((p as any).transaction_id)));
    };

    const addCashEntry = async (data: Omit<CashEntry, 'id' | 'createdAt'>) => {
        if (!user) return;
        const { data: inserted, error } = await supabase
            .from('cash_entries')
            .insert([{
                amount: data.amount,
                month: data.month,
                memo: data.memo,
                user_id: user.id
            }])
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

    const updateCashEntry = async (id: string, updates: Partial<CashEntry>) => {
        if (!user) return;
        const { error } = await supabase
            .from('cash_entries')
            .update({
                amount: updates.amount,
                month: updates.month,
                memo: updates.memo
            })
            .eq('id', id);

        if (error) {
            toast.error('Error updating budget: ' + error.message);
            return;
        }

        setCashEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        toast.success('Budget updated');
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
        if (!user) return;
        const { data: inserted, error } = await supabase
            .from('payouts')
            .insert([{
                symbol: data.symbol,
                amount: data.amount,
                date: data.date,
                user_id: user.id
            }])
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

    const updatePayout = async (id: string, updates: Partial<Payout>) => {
        if (!user) return;
        const { error } = await supabase
            .from('payouts')
            .update({
                symbol: updates.symbol,
                amount: updates.amount,
                date: updates.date
            })
            .eq('id', id);

        if (error) {
            toast.error('Error updating payout: ' + error.message);
            return;
        }

        setPayouts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        toast.success('Payout updated');
    };

    const deletePayout = async (id: string) => {
        const { error } = await supabase.from('payouts').delete().eq('id', id);
        if (error) {
            toast.error('Error deleting payout: ' + error.message);
            return;
        }
        setPayouts(prev => prev.filter(p => p.id !== id));
    };

    const recalculateRealizedProfits = async () => {
        if (!user || transactions.length === 0) return;
        setLoading(true);
        try {
            // 1. Clear existing P&L records in DB
            const { error: delError } = await supabase.from('realized_pnl').delete().eq('user_id', user.id);
            if (delError) throw delError;

            const symbols = Array.from(new Set(transactions.map(t => t.symbol)));
            const newPnlEntries: any[] = [];

            // 2. Process each symbol
            for (const sym of symbols) {
                const symTrans = [...transactions]
                    .filter(t => t.symbol === sym)
                    .sort((a, b) => {
                        // Sort by month first, then by createdAt
                        const monthComp = a.month.localeCompare(b.month);
                        if (monthComp !== 0) return monthComp;
                        return a.createdAt.localeCompare(b.createdAt);
                    });

                let totalShares = 0;
                let totalCostBasis = 0;

                for (const t of symTrans) {
                    if (t.type === 'buy') {
                        totalShares += t.shares;
                        totalCostBasis += t.totalAmount;
                    } else {
                        // It's a sell
                        const avgBuyPrice = totalShares > 0 ? totalCostBasis / totalShares : 0;
                        const realizedProfit = (t.pricePerShare - avgBuyPrice) * t.shares;

                        newPnlEntries.push({
                            symbol: t.symbol,
                            quantity_sold: t.shares,
                            avg_buy_price: avgBuyPrice,
                            avg_sell_price: t.pricePerShare,
                            realized_profit: realizedProfit,
                            sell_date: t.month + "-01", // Approximate date from month
                            transaction_id: t.id,
                            user_id: user.id
                        });

                        // Update inventory
                        totalShares -= t.shares;
                        totalCostBasis -= t.shares * avgBuyPrice;
                    }
                }
            }

            // 3. Batch insert new entries
            if (newPnlEntries.length > 0) {
                const { error: insError } = await supabase.from('realized_pnl').insert(newPnlEntries);
                if (insError) throw insError;
            }

            // 4. Refresh local state
            await fetchData();
            toast.success('Realized profits recalculated successfully');
        } catch (err: any) {
            console.error('Recalculation error:', err);
            toast.error('Failed to recalculate profits: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const importAllData = async (data: {
        transactions: Transaction[],
        stocks: Stock[],
        cashEntries: CashEntry[],
        payouts: Payout[],
        realizedProfits: RealizedProfit[]
    }) => {
        setLoading(true);
        try {
            // Delete existing data for the current user to ensure a clean restore
            const { error: delStocksErr } = await supabase.from('stocks').delete().eq('user_id', user!.id);
            const { error: delTransErr } = await supabase.from('transactions').delete().eq('user_id', user!.id);
            const { error: delCashErr } = await supabase.from('cash_entries').delete().eq('user_id', user!.id);
            const { error: delPayoutsErr } = await supabase.from('payouts').delete().eq('user_id', user!.id);
            const { error: delPnlErr } = await supabase.from('realized_pnl').delete().eq('user_id', user!.id);

            if (delStocksErr || delTransErr || delCashErr || delPayoutsErr || delPnlErr) {
                throw new Error('Failed to clear existing database data before restore.');
            }

            // Insert new data with explicit user_id mapping
            if (data.stocks && data.stocks.length > 0) {
                const { error } = await supabase.from('stocks').insert(
                    data.stocks.map(s => ({
                        symbol: (s.symbol || '').toUpperCase(),
                        sector: s.sector || 'Others',
                        user_id: user!.id
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
                            month: t.month || (t as any).date?.substring(0, 7) || new Date().toISOString().substring(0, 7),
                            user_id: user!.id
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
                        memo: c.memo || (c as any).origin || (c as any).description || '',
                        user_id: user!.id
                    }))
                );
                if (error) throw new Error('Cash entries sync failed: ' + error.message);
            }

            if (data.payouts && data.payouts.length > 0) {
                const { error } = await supabase.from('payouts').insert(
                    data.payouts.map(p => ({
                        symbol: (p.symbol || (p as any).stockSymbol || '').toUpperCase(),
                        amount: p.amount ?? (p as any).amount ?? 0,
                        date: p.date || (p as any).month || new Date().toISOString().split('T')[0],
                        user_id: user!.id
                    }))
                );
                if (error) throw new Error('Payouts sync failed: ' + error.message);
            }

            if (data.realizedProfits && data.realizedProfits.length > 0) {
                const { error } = await supabase.from('realized_pnl').insert(
                    data.realizedProfits.map(p => ({
                        symbol: (p.symbol || '').toUpperCase(),
                        quantity_sold: p.quantitySold ?? (p as any).quantity_sold ?? 0,
                        avg_buy_price: p.avgBuyPrice ?? (p as any).avg_buy_price ?? 0,
                        avg_sell_price: p.avgSellPrice ?? (p as any).avg_sell_price ?? 0,
                        realized_profit: p.realizedProfit ?? (p as any).realized_profit ?? 0,
                        sell_date: p.sellDate ?? (p as any).sell_date ?? new Date().toISOString().split('T')[0],
                        user_id: user!.id
                    }))
                );
                if (error) throw new Error('Realized profit sync failed: ' + error.message);
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
            realizedProfits,
            loading,
            livePrices,
            isMarketLive,
            refreshData: fetchData,
            addTransaction,
            updateTransaction,
            deleteTransaction,
            deleteMonthTransactions,
            addStock,
            removeStock,
            addCashEntry,
            updateCashEntry,
            deleteCashEntry,
            addPayout,
            updatePayout,
            deletePayout,
            importAllData,
            recalculateRealizedProfits
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
