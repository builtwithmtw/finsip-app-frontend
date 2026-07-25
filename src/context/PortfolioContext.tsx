"use client";

import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from 'react';
import { useProxy } from './ProxyContext';
import { supabase } from '../lib/supabase';
import type { Transaction, Stock, RealizedProfit } from '../types';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { avgBuyPriceFor } from '../utils/holdings';

interface PortfolioContextType {
    transactions: Transaction[];
    stocks: Stock[];
    realizedProfits: RealizedProfit[];
    // Month the entry form writes to; picked in the nav bar.
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    /**
     * True while *anything* the portfolio needs is still in flight, including the
     * auth session. Kept for screens that genuinely need all three tables before
     * they can render; prefer the per-table flags below so one slow query does
     * not hold up a section that already has its data.
     */
    loading: boolean;
    stocksLoading: boolean;
    transactionsLoading: boolean;
    realizedLoading: boolean;
    // Live Market Data
    livePrices: Record<string, number>;
    isMarketLive: boolean;
    // True until the first market fetch settles, win or lose.
    marketLoading: boolean;

    refreshData: () => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'totalAmount'>) => Promise<void>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    deleteMonthTransactions: (month: string) => Promise<void>;
    addStock: (symbol: string, sector: string) => Promise<void>;
    removeStock: (id: string) => Promise<void>;
    reorderStocks: (orderedIds: string[]) => Promise<void>;
    setStockWeight: (id: string, weight: number | null) => Promise<void>;
    clearAllData: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [realizedProfits, setRealizedProfits] = useState<RealizedProfit[]>([]);

    // One flag per table rather than one for the batch. They start true because
    // the very first render happens before the session has even resolved, and a
    // screen that read `false` there would show its "nothing here yet" empty
    // state for a moment before the real data arrived.
    const [stocksLoading, setStocksLoading] = useState(true);
    const [transactionsLoading, setTransactionsLoading] = useState(true);
    const [realizedLoading, setRealizedLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Centralized Live Market State
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [isMarketLive, setIsMarketLive] = useState(false);
    const [marketLoading, setMarketLoading] = useState(true);

    const { selectedProxy, setShowModal, setRetryFetch } = useProxy();

    const fetchMarketData = useCallback(async () => {
        try {
            const targetUrl = "https://beta-restapi.sarmaaya.pk/api/indices/ALLSHR/companies?page=1&limit=500";
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
            // setShowModal(true);
            // toast.error(`Connection failed via ${selectedProxy.name}. Please select another gateway.`);
        } finally {
            setMarketLoading(false);
        }
    }, [selectedProxy, setShowModal]);

    // Register retry function for the Proxy Terminal
    useEffect(() => {
        setRetryFetch(() => fetchMarketData);
    }, [fetchMarketData, setRetryFetch]);

    // Poll fast while the feed is down so it recovers on its own, and back off to a
    // normal refresh cadence once it is live.
    const LIVE_REFRESH_MS = 5 * 60 * 1000;
    const RECONNECT_RETRY_MS = 12 * 1000;

    useEffect(() => {
        fetchMarketData();
        const interval = setInterval(
            fetchMarketData,
            isMarketLive ? LIVE_REFRESH_MS : RECONNECT_RETRY_MS
        );
        return () => clearInterval(interval);
    }, [fetchMarketData, isMarketLive]);

    /**
     * The three tables are fetched as independent requests, each clearing its own
     * flag as it lands. They used to share one `Promise.all` and one flag, which
     * meant the slowest of the three decided when *any* of the dashboard could
     * render -- a stalled realized-P&L query blanked the holdings table too.
     */
    const fetchData = async () => {
        if (!user) return;

        const fetchStocks = async () => {
            setStocksLoading(true);
            try {
                const { data: stocksData } = await supabase
                    .from('stocks')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: true });

                if (stocksData) {
                    // Sorted here rather than in the query: `position` only exists once the
                    // add_stock_position migration has run, and ordering by a missing column
                    // would fail the request and blank the whole list.
                    setStocks(
                        stocksData
                            .map(s => ({
                                id: s.id,
                                symbol: s.symbol,
                                sector: s.sector,
                                createdAt: s.created_at,
                                position: s.position ?? null,
                                allocationWeight: s.allocation_weight ?? null
                            }))
                            .sort((a, b) => {
                                if (a.position === null && b.position === null) {
                                    return a.createdAt.localeCompare(b.createdAt);
                                }
                                if (a.position === null) return 1;
                                if (b.position === null) return -1;
                                return a.position - b.position;
                            })
                    );
                } else {
                    setStocks([]);
                }
            } finally {
                setStocksLoading(false);
            }
        };

        const fetchTransactions = async () => {
            setTransactionsLoading(true);
            try {
                const { data: transData } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('month', { ascending: false });

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
            } finally {
                setTransactionsLoading(false);
            }
        };

        const fetchRealized = async () => {
            setRealizedLoading(true);
            try {
                const { data: pnlData } = await supabase
                    .from('realized_pnl')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('sell_date', { ascending: false });

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
            } finally {
                setRealizedLoading(false);
            }
        };

        // allSettled, not all: one table failing should not reject the others or
        // skip their state updates. The toast still fires once for the batch.
        const results = await Promise.allSettled([
            fetchStocks(),
            fetchTransactions(),
            fetchRealized()
        ]);

        const failure = results.find(r => r.status === 'rejected');
        if (failure && failure.status === 'rejected') {
            console.error('Error fetching data:', failure.reason);
            toast.error('Failed to sync with secure backup');
        }
    };

    // `authLoading` is a dependency below, so the effect can re-run for a user it
    // has already loaded (onAuthStateChange settles the flag after the user is
    // set). This keeps the fetch to once per identity.
    const fetchedForUserId = useRef<string | null>(null);

    useEffect(() => {
        if (user) {
            if (fetchedForUserId.current === user.id) return;
            fetchedForUserId.current = user.id;
            fetchData();
            return;
        }

        // While the session is still resolving there is nothing to say yet: a user
        // is about to appear or is about to be confirmed absent. Clearing the flags
        // here would flash every empty state in the app on each reload.
        if (authLoading) return;

        // Reset state when not authorized
        fetchedForUserId.current = null;
        setTransactions([]);
        setStocks([]);
        setRealizedProfits([]);
        setStocksLoading(false);
        setTransactionsLoading(false);
        setRealizedLoading(false);
    }, [user?.id, authLoading]); // Only refetch when user ID actually changes

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
            createdAt: data.created_at,
            position: data.position ?? prev.length,
            allocationWeight: data.allocation_weight ?? null
        }]);
    };

    /**
     * Sets a symbol's target weight for the Allocation tab. Optimistic: the table
     * recomputes under the cursor as the number is typed, and a rejected write puts the
     * old weight back.
     */
    const setStockWeight = async (id: string, weight: number | null) => {
        if (!user) return;

        const previous = stocks;
        setStocks(prev => prev.map(s => (s.id === id ? { ...s, allocationWeight: weight } : s)));

        const { error } = await supabase
            .from('stocks')
            .update({ allocation_weight: weight })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setStocks(previous);
            toast.error('Could not save the weight: ' + error.message);
        }
    };

    /**
     * Persists a drag-to-rearrange. The new order is applied optimistically so the list doesn't
     * snap back under the cursor; a failed write reloads from the server to undo it.
     */
    const reorderStocks = async (orderedIds: string[]) => {
        if (!user) return;

        const byId = new Map(stocks.map(s => [s.id, s]));
        const reordered = orderedIds.flatMap((id, index) => {
            const stock = byId.get(id);
            return stock ? [{ ...stock, position: index }] : [];
        });

        const previous = stocks;
        setStocks(reordered);

        // Plain updates, not an upsert: an upsert proposes a full INSERT row first, and a row
        // carrying only { id, position } has a null symbol, which trips the NOT NULL constraint
        // before the ON CONFLICT clause ever gets a chance to turn it into an update.
        const results = await Promise.all(
            reordered.map(s =>
                supabase
                    .from('stocks')
                    .update({ position: s.position })
                    .eq('id', s.id)
                    .eq('user_id', user.id)
            )
        );

        const failed = results.find(r => r.error);
        if (failed?.error) {
            setStocks(previous);
            toast.error('Could not save the new order: ' + failed.error.message);
        }
    };

    const removeStock = async (id: string) => {
        if (!user) return;
        const { error } = await supabase.from('stocks').delete().eq('id', id).eq('user_id', user.id);
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
        const avgBuyPrice = data.type === 'sell'
            ? avgBuyPriceFor(transactions, data.symbol)
            : 0;

        // A sell with no shares behind it has no cost basis, so booking it would
        // report the whole sale as profit. Skip the P&L record instead.
        if (data.type === 'sell' && avgBuyPrice > 0) {
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
        if (!user) return;
        const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
        if (error) {
            toast.error('Error deleting transaction: ' + error.message);
            return;
        }
        setTransactions(prev => prev.filter(t => t.id !== id));
        // Note: Realized P&L records will be automatically deleted due to ON DELETE CASCADE
        setRealizedProfits(prev => prev.filter(p => (p as any).transaction_id !== id));
    };

    const deleteMonthTransactions = async (month: string) => {
        if (!user) return;
        const { error } = await supabase.from('transactions').delete().eq('month', month).eq('user_id', user.id);
        if (error) {
            toast.error('Error deleting month data: ' + error.message);
            return;
        }
        const deletedIds = transactions.filter(t => t.month === month).map(t => t.id);
        setTransactions(prev => prev.filter(t => t.month !== month));
        setRealizedProfits(prev => prev.filter(p => !deletedIds.includes((p as any).transaction_id)));
    };

    const clearAllData = async () => {
        if (!user) return;
        setStocksLoading(true);
        setTransactionsLoading(true);
        setRealizedLoading(true);
        try {
            await supabase.from('realized_pnl').delete().eq('user_id', user.id);
            await supabase.from('transactions').delete().eq('user_id', user.id);
            await supabase.from('stocks').delete().eq('user_id', user.id);

            await fetchData();
            toast.success('All portfolio data has been purged.');
        } catch (error: any) {
            console.error('Error clearing data:', error);
            toast.error('Failed to clear data: ' + error.message);
            throw error;
        } finally {
            // fetchData clears these on the happy path; this covers the throw.
            setStocksLoading(false);
            setTransactionsLoading(false);
            setRealizedLoading(false);
        }
    };

    return (
        <PortfolioContext.Provider value={{
            transactions,
            stocks,
            realizedProfits,
            selectedMonth,
            setSelectedMonth,
            loading: authLoading || stocksLoading || transactionsLoading || realizedLoading,
            stocksLoading,
            transactionsLoading,
            realizedLoading,
            livePrices,
            isMarketLive,
            marketLoading,
            refreshData: fetchData,
            addTransaction,
            updateTransaction,
            deleteTransaction,
            deleteMonthTransactions,
            addStock,
            removeStock,
            reorderStocks,
            setStockWeight,
            clearAllData
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