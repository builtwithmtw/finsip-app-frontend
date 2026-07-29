"use client";

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { DISPLAY, NUMERIC } from "../utils/typography";

export interface BootStep {
    label: string;
    done: boolean;
}

/**
 * The lines that flip while the app loads. Deliberately about the user's own
 * money rather than about the machinery -- "Fetching /api/stocks" is not what
 * someone is waiting to hear.
 */
const MESSAGES = [
    "Loading your portfolio",
    "Pulling live PSX prices",
    "Adding up your holdings",
    "Almost there — hold tight",
];

const FLIP_MS = 1900;

/**
 * Full-screen loader shown once, between signing in and landing on Overview,
 * while every request the app needs is in flight.
 *
 * It replaces the per-tab skeletons that used to stand in for data as each
 * screen mounted: the trade is one wait up front for an app where every tab is
 * already populated when it opens. The step row is the honest version of a
 * progress bar -- it moves when something actually lands, not on a timer.
 */
const BootLoader: React.FC<{ steps: BootStep[] }> = ({ steps }) => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        // Stops on the last line rather than looping back to "Loading your
        // portfolio", which reads like the load restarted.
        const id = setInterval(() => {
            setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
        }, FLIP_MS);
        return () => clearInterval(id);
    }, []);

    const doneCount = steps.filter((s) => s.done).length;
    const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
            <div className="flex flex-col items-center w-full max-w-sm animate-in fade-in duration-500">
                {/* Logo with a ring orbiting it */}
                <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 animate-spin" />
                    <img
                        src="/logo.svg"
                        alt=""
                        className="absolute inset-0 m-auto w-9 h-9 rounded-lg animate-pulse"
                    />
                </div>

                {/* Keyed on the index so React remounts the line and the entrance
                    animation runs again on every flip. */}
                <p
                    key={messageIndex}
                    style={DISPLAY}
                    className="text-sm font-bold text-slate-700 mb-1.5 text-center animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                    {MESSAGES[messageIndex]}
                </p>

                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">
                    Your data is on its way
                </p>

                {/* Determinate: width tracks the steps that have actually landed. */}
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 rounded-full transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.max(percent, 6)}%` }}
                    />
                </div>

                <p
                    style={NUMERIC}
                    className="mt-2 text-[10px] font-bold text-slate-400 tabular-nums"
                >
                    {percent}%
                </p>

                <ul className="mt-6 w-full space-y-1.5">
                    {steps.map((step) => (
                        <li
                            key={step.label}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em]"
                        >
                            <span
                                className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${step.done
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-slate-300 bg-white"
                                    }`}
                            >
                                {step.done ? <Check size={9} strokeWidth={4} /> : null}
                            </span>
                            <span
                                className={
                                    step.done ? "text-slate-500" : "text-slate-300"
                                }
                            >
                                {step.label}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default BootLoader;
