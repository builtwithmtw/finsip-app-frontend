"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Columns3, RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrency, useMask } from '../context/PrivacyContext';
import { usePeers } from '../hooks/usePeers';
import useLocalStorage from '../hooks/useLocalStorage';
import { isAdmin } from '../lib/admins';
import {
    computeLiveHoldings,
    summarizeDay,
    summarizeLive,
    type DaySummary,
    type LiveTotals,
} from '../utils/holdings';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Avatar } from '../components/Avatar';
import { Panel } from '../components/Panel';
import { SkeletonCard, SkeletonTableRows } from '../components/DashboardSkeleton';
import PeerPortfolioModal from '../components/PeerPortfolioModal';
import type { Peer } from '../types';

// Every money column drops the "Rs": seven figures across one row, and the unit
// repeated seven times is noise the header already carries. Same call the Live
// Portfolio table makes. The privacy mask has no symbol to strip, so it falls
// through untouched.
const bare = (formatted: string) => formatted.replace(/^Rs\s*/, '');

// Signed figure in the mono face, coloured by direction. Used for the three
// columns that can go either way (1D, Unrealized, Realized) so they read as one
// family rather than three hand-rolled cells.
const Signed: React.FC<{ value: number; text: string; muted?: boolean }> = ({ value, text, muted }) => (
    <span
        className={clsx(
            "text-[13px] font-semibold tabular-nums",
            muted ? "text-slate-300" : value >= 0 ? "text-emerald-600" : "text-rose-600"
        )}
        style={NUMERIC}
    >
        {muted ? '—' : `${value >= 0 ? '+' : '−'}${text}`}
    </span>
);

// A percentage in a tinted pill, the shape used for every % in the app.
const Pill: React.FC<{ percent: number }> = ({ percent }) => (
    <span
        className={clsx(
            "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
            percent > 0 && "bg-emerald-500/10 text-emerald-600",
            percent < 0 && "bg-rose-500/10 text-rose-600",
            percent === 0 && "bg-slate-100 text-slate-400"
        )}
        style={NUMERIC}
    >
        {percent !== 0 && <span className="text-[8px]">{percent > 0 ? '▲' : '▼'}</span>}
        {Math.abs(percent).toFixed(2)}%
    </span>
);

// The day's leader / laggard for one account: which symbol, and by how much.
const Mover: React.FC<{ mover: { symbol: string; change: number } | null; mask: (t: string) => string }> = ({ mover, mask }) => {
    if (!mover) return <span className="text-[13px] tabular-nums text-slate-300" style={NUMERIC}>—</span>;

    return (
        <div className="flex flex-col items-end">
            <span
                className="text-[12px] font-semibold uppercase leading-none tracking-[-0.02em] text-slate-900"
                style={DISPLAY}
            >
                {mask(mover.symbol)}
            </span>
            <Pill percent={mover.change} />
        </div>
    );
};

interface PeerRow {
    peer: Peer;
    totals: LiveTotals;
    day: DaySummary;
    realized: number;
}

interface CellContext {
    formatCurrency: (amount: number) => string;
    mask: (text: string | number) => string;
}

/**
 * The metric columns, as data rather than as markup.
 *
 * Hiding one is then a filter over this list instead of a conditional wrapped
 * around a `<td>` and a matching one around its `<th>` -- two edits that have to
 * agree, in two places far enough apart to drift. Peer and the action button are
 * not in here: they are the row's identity and its way in, and there is no
 * reading of this table that wants either of them gone.
 */
const COLUMNS: {
    id: string;
    label: string;
    cell: (row: PeerRow, ctx: CellContext) => React.ReactNode;
}[] = [
    {
        id: 'invested',
        label: 'Invested',
        // Leads because it is what the table is ranked by, and quieter than Worth
        // beside it: settled history against the figure that moves.
        cell: ({ totals }, { formatCurrency }) => (
            <span className="text-[13px] tabular-nums text-slate-500" style={NUMERIC}>
                {bare(formatCurrency(Math.round(totals.totalCost)))}
            </span>
        ),
    },
    {
        id: 'worth',
        label: 'Worth',
        cell: ({ totals }, { formatCurrency }) => (
            <span className="text-[13px] font-semibold tabular-nums text-slate-900" style={NUMERIC}>
                {bare(formatCurrency(Math.round(totals.totalValue)))}
            </span>
        ),
    },
    {
        id: 'day',
        label: '1D',
        // Aggregated: what the whole book made or lost today, in rupees, not an
        // average of its symbols' percentages.
        cell: ({ day }, { formatCurrency }) => {
            const flat = day.move === 0 && day.percent === 0;
            return (
                <div className="flex flex-col items-end">
                    <Signed
                        value={day.move}
                        text={bare(formatCurrency(Math.round(Math.abs(day.move))))}
                        muted={flat}
                    />
                    {!flat && <Pill percent={day.percent} />}
                </div>
            );
        },
    },
    {
        id: 'unrealized',
        label: 'Unrealized',
        cell: ({ totals }, { formatCurrency }) => (
            <div className="flex flex-col items-end">
                <Signed
                    value={totals.totalPL}
                    text={bare(formatCurrency(Math.round(Math.abs(totals.totalPL))))}
                    muted={totals.totalCost === 0}
                />
                {totals.totalCost > 0 && <Pill percent={(totals.totalPL / totals.totalCost) * 100} />}
            </div>
        ),
    },
    {
        id: 'realized',
        label: 'Realized',
        // Banked, not on paper. Nothing sold yet is a dash rather than a zero --
        // they are different facts.
        cell: ({ peer, realized }, { formatCurrency }) => (
            <Signed
                value={realized}
                text={bare(formatCurrency(Math.round(Math.abs(realized))))}
                muted={peer.realized.length === 0}
            />
        ),
    },
    {
        id: 'todayUp',
        label: "Today's Up",
        cell: ({ day }, { mask }) => <Mover mover={day.best} mask={mask} />,
    },
    {
        id: 'todayDown',
        label: "Today's Down",
        cell: ({ day }, { mask }) => <Mover mover={day.worst} mask={mask} />,
    },
];

/**
 * Which columns are switched off, persisted per browser.
 *
 * Hidden ids rather than visible ones, so a column added later shows up for
 * someone who already has a preference saved instead of being invisible to the
 * one person who most wanted the new figure.
 */
const HIDDEN_COLUMNS_KEY = 'finsip:peers-hidden-columns';

/**
 * Every other account on the app, ranked by how much is invested.
 *
 * Admin-only, and the check that matters is not this component's: the RPCs
 * behind `usePeers` read the caller's JWT and refuse anyone else. The guard here
 * exists so a non-admin who types the URL gets a sentence instead of a toast.
 *
 * Every figure is derived by `utils/holdings.ts` from the peer's own ledger,
 * priced against the one live sweep `PortfolioContext` runs for the whole app --
 * so a peer's Worth is computed exactly the way the admin's own is, off the same
 * prices, with no second fetch and nothing to drift.
 */
const PeersPage: React.FC = () => {
    const { user } = useAuth();
    const { peers, loading } = usePeers();
    const { livePrices, liveChanges } = usePortfolio();
    const formatCurrency = useCurrency();
    const mask = useMask();

    const [openPeer, setOpenPeer] = useState<Peer | null>(null);
    const [hiddenColumns, setHiddenColumns] = useLocalStorage<string[]>(HIDDEN_COLUMNS_KEY, []);
    const [columnsOpen, setColumnsOpen] = useState(false);
    const columnsRef = useRef<HTMLDivElement>(null);

    const admin = isAdmin(user?.email);

    useEffect(() => {
        if (!columnsOpen) return;

        const onPointerDown = (e: MouseEvent) => {
            if (!columnsRef.current?.contains(e.target as Node)) setColumnsOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setColumnsOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [columnsOpen]);

    const visibleColumns = useMemo(
        () => COLUMNS.filter(c => !hiddenColumns.includes(c.id)),
        [hiddenColumns]
    );

    const toggleColumn = (id: string) =>
        setHiddenColumns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );

    const rows = useMemo(() =>
        peers
            .map(peer => {
                const holdings = computeLiveHoldings(peer.transactions, livePrices);
                const totals = summarizeLive(holdings);
                const day = summarizeDay(holdings, liveChanges);

                return {
                    peer,
                    totals,
                    day,
                    // Booked profits are their own table, not something the ledger
                    // can be made to yield -- a sold position leaves no trace of
                    // what it made once its shares are gone.
                    realized: peer.realized.reduce((sum, r) => sum + r.realizedProfit, 0),
                };
            })
            // Ranked on Invested whether or not that column is on screen: hiding a
            // figure is about what you want to read, not about what the table is.
            .sort((a, b) => b.totals.totalCost - a.totals.totalCost),
        [peers, livePrices, liveChanges]
    );

    // Re-read from the current list rather than holding the object the button was
    // clicked with, so a refresh reaches an open modal.
    const activePeer = openPeer
        ? peers.find(p => p.userId === openPeer.userId) ?? openPeer
        : null;

    const cellContext: CellContext = { formatCurrency, mask };

    if (!admin) {
        return (
            <Panel className="py-16 text-center">
                <ShieldAlert size={22} className="mx-auto text-slate-300" />
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400" style={DISPLAY}>
                    Admins Only
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[11px] font-medium text-slate-400">
                    This page lists other accounts, and this one is not an admin.
                </p>
            </Panel>
        );
    }

    if (loading) {
        return (
            <SkeletonCard className="!rounded-2xl">
                <SkeletonTableRows rows={6} cols={6} />
            </SkeletonCard>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <Panel flush>
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div>
                        <h3
                            className="text-[15px] font-semibold uppercase leading-none tracking-[-0.03em] text-slate-900"
                            style={DISPLAY}
                        >
                            Peers
                        </h3>
                        <p
                            className="mt-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                            style={DISPLAY}
                        >
                            Ranked By Invested
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="hidden items-center gap-2 text-slate-400 sm:flex">
                            <Users size={13} className="shrink-0" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={DISPLAY}>
                                {rows.length} Account{rows.length === 1 ? '' : 's'}
                            </span>
                        </span>

                        {/* Column picker. Eight figures across a row is more than most
                            readings need at once, and which eight matter depends on the
                            question -- so the choice is the reader's and it sticks. */}
                        <div ref={columnsRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setColumnsOpen(open => !open)}
                                aria-haspopup="menu"
                                aria-expanded={columnsOpen}
                                style={DISPLAY}
                                className={clsx(
                                    "flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase",
                                    "tracking-[0.14em] ring-1 ring-slate-900/5 transition-all",
                                    columnsOpen
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <Columns3 size={13} className="shrink-0" />
                                Columns
                                {hiddenColumns.length > 0 && (
                                    <span
                                        className={clsx(
                                            "rounded-md px-1.5 py-0.5 text-[9px] leading-none tabular-nums",
                                            columnsOpen ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                                        )}
                                        style={NUMERIC}
                                    >
                                        {visibleColumns.length}/{COLUMNS.length}
                                    </span>
                                )}
                            </button>

                            {columnsOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-24px_rgba(2,6,23,0.35)] ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-top-1 duration-150"
                                >
                                    <span
                                        className="block border-b border-slate-100 px-4 py-3 text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                                        style={DISPLAY}
                                    >
                                        Show Columns
                                    </span>

                                    {COLUMNS.map(col => {
                                        const shown = !hiddenColumns.includes(col.id);
                                        return (
                                            <button
                                                key={col.id}
                                                role="menuitemcheckbox"
                                                aria-checked={shown}
                                                onClick={() => toggleColumn(col.id)}
                                                style={DISPLAY}
                                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                            >
                                                <span
                                                    className={clsx(
                                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition-colors",
                                                        shown ? "bg-slate-900 text-white" : "ring-1 ring-slate-200"
                                                    )}
                                                >
                                                    {shown && <Check size={11} strokeWidth={3} />}
                                                </span>
                                                {col.label}
                                            </button>
                                        );
                                    })}

                                    {hiddenColumns.length > 0 && (
                                        <button
                                            role="menuitem"
                                            onClick={() => setHiddenColumns([])}
                                            style={DISPLAY}
                                            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            <RotateCcw size={13} className="shrink-0" />
                                            Show All
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table
                        className={clsx(
                            "w-full border-collapse text-left",
                            // Narrows as columns come off, so hiding half of them
                            // actually buys back the horizontal scroll.
                            visibleColumns.length > 4 ? "min-w-[1100px]" : "min-w-[640px]"
                        )}
                    >
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th
                                    style={DISPLAY}
                                    className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                                >
                                    Peer
                                </th>
                                {visibleColumns.map(col => (
                                    <th
                                        key={col.id}
                                        style={DISPLAY}
                                        className="whitespace-nowrap px-4 py-3 text-right text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70">
                            {rows.map(row => (
                                <tr key={row.peer.userId} className="group transition-colors hover:bg-slate-50/70">
                                    <td className="relative py-3 pl-4 pr-4">
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100"
                                        />
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                seed={row.peer.email}
                                                src={row.peer.avatarUrl}
                                                className="h-9 w-9 shrink-0 overflow-hidden rounded-xl"
                                            />
                                            <div className="min-w-0">
                                                <div
                                                    className="truncate text-[13px] font-semibold tracking-[-0.02em] text-slate-900"
                                                    style={DISPLAY}
                                                >
                                                    {row.peer.displayName?.trim() || row.peer.email.split('@')[0] || '—'}
                                                </div>
                                                <div className="truncate text-[11px] font-medium text-slate-400">
                                                    {row.peer.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {visibleColumns.map(col => (
                                        <td key={col.id} className="px-4 py-3 text-right">
                                            {col.cell(row, cellContext)}
                                        </td>
                                    ))}

                                    <td className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setOpenPeer(row.peer)}
                                            style={DISPLAY}
                                            className={clsx(
                                                "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase",
                                                "tracking-[0.14em] text-white transition-all hover:ring-4 hover:ring-slate-900/10"
                                            )}
                                        >
                                            View Portfolio
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rows.length === 0 && (
                    <div className="py-14 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400" style={DISPLAY}>
                            No Other Accounts
                        </p>
                    </div>
                )}
            </Panel>

            {activePeer && (
                <PeerPortfolioModal peer={activePeer} onClose={() => setOpenPeer(null)} />
            )}
        </div>
    );
};

export default PeersPage;
