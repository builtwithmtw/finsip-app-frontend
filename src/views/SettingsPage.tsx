"use client";

import React from 'react';
import clsx from 'clsx';
import { useSettings } from '../context/SettingsContext';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import { DISPLAY, NUMERIC } from '../utils/typography';
import { Panel, PanelHeader } from '../components/Panel';

/**
 * A switch, in the app's own grammar: the dark slab means on, the recessed track means
 * off -- the same pair the Ledger's toggles and the Allocation tabs already use.
 */
const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({
    checked,
    onChange,
    label,
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            checked ? 'bg-slate-900' : 'bg-slate-200'
        )}
    >
        <span
            className={clsx(
                'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all',
                checked ? 'left-6' : 'left-1'
            )}
        />
    </button>
);

/**
 * One setting: its name, what it does, and the control. The description carries the
 * consequence rather than restating the label -- a row that says "Short amounts:
 * shortens amounts" has spent a line saying nothing.
 */
const Setting: React.FC<{
    title: string;
    description: string;
    children: React.ReactNode;
    preview?: React.ReactNode;
}> = ({ title, description, children, preview }) => (
    <div className="flex items-start justify-between gap-6 rounded-xl bg-slate-50/70 px-4 py-3.5 ring-1 ring-slate-900/5">
        <div className="min-w-0">
            <p
                className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-900"
                style={DISPLAY}
            >
                {title}
            </p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
            {preview && <div className="mt-3">{preview}</div>}
        </div>

        <div className="shrink-0 pt-0.5">{children}</div>
    </div>
);


const SettingsPage: React.FC = () => {
    const {
        compactNavAmounts,
        setCompactNavAmounts,
        showTransactionsLedger,
        setShowTransactionsLedger,
    } = useSettings();

    // The figure the switch is actually about, drawn the way the bar will draw it. A
    // preference about formatting is easier to answer by looking at it than by reading
    // a sentence describing it.
    const sample = 1_284_000;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 animate-in fade-in duration-500">
            <Panel>
                <PanelHeader title="Display" caption="How Figures Are Drawn" />

                <div className="mt-4 flex flex-col gap-3">
                    <Setting
                        title="Short amounts in the nav bar"
                        description="Worth and Cost are the widest figures in the app, in the narrowest strip it has. Shortening them keeps the bar from crowding the tabs. Every other screen prints the exact figure either way."
                        preview={
                            <span
                                className="inline-flex items-baseline gap-2 rounded-lg bg-slate-950 px-3 py-2"
                                style={NUMERIC}
                            >
                                <span
                                    className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                                    style={DISPLAY}
                                >
                                    Worth
                                </span>
                                <span className="text-[13px] font-semibold tabular-nums text-white">
                                    {(compactNavAmounts
                                        ? formatCompactCurrency(sample)
                                        : formatCurrency(sample)
                                    ).replace(/^Rs\s*/, '')}
                                </span>
                            </span>
                        }
                    >
                        <Switch
                            checked={compactNavAmounts}
                            onChange={setCompactNavAmounts}
                            label="Short amounts in the nav bar"
                        />
                    </Setting>
                </div>
            </Panel>

            <Panel>
                <PanelHeader title="Ledger" caption="Which Reading Opens" />

                <div className="mt-4 flex flex-col gap-3">
                    <Setting
                        title="Display transactions ledger"
                        description="On, the Ledger is the transaction log with Returns and Activity beside it. Off, it is the symbol-by-month grid, which you can then cut monthly or yearly on the page. Both read the same rows — each simply wants the whole page, so only one is up at a time."
                    >
                        <Switch
                            checked={showTransactionsLedger}
                            onChange={setShowTransactionsLedger}
                            label="Display transactions ledger"
                        />
                    </Setting>
                </div>
            </Panel>
        </div>
    );
};

export default SettingsPage;
