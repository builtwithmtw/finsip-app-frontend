/**
 * PSX (Pakistan Stock Exchange) Regular Market schedule.
 *
 * All timings are anchored to Pakistan Standard Time (Asia/Karachi, UTC+5) and
 * evaluated against that timezone regardless of where the viewer's clock sits,
 * so the navbar reads the same for a user in Karachi or in New York.
 *
 * Source: PSX Market State — the Regular Market row of the trading schedule.
 *   Mon–Thu:  Open 09:32–15:30.
 *   Friday:   two sessions — Open 09:17–12:00 and Open 14:32–16:30.
 *   Sat/Sun:  Closed.
 *
 * Only Open matters here. The exchange's Pre-Open, Break and Post-Close windows
 * are all folded into Closed: prices don't move during them, so a separate state
 * bought a third label in the navbar without changing anything downstream.
 */

export type MarketPhase = 'open' | 'closed';

export interface MarketState {
    phase: MarketPhase;
    /** True only during the Regular Market Open phase — when live prices actually move. */
    isOpen: boolean;
    /** Short label for the navbar chip, e.g. "Market Open" / "Market Closed". */
    label: string;
}

const min = (h: number, m: number) => h * 60 + m;

interface Window {
    start: number; // minutes from midnight, inclusive
    end: number;   // minutes from midnight, exclusive
}

// Monday–Thursday (single session).
const MON_THU: Window[] = [
    { start: min(9, 32), end: min(15, 30) },
];

// Friday (two sessions with a midday break).
const FRIDAY: Window[] = [
    { start: min(9, 17), end: min(12, 0) },
    { start: min(14, 32), end: min(16, 30) },
];

const LABELS: Record<MarketPhase, string> = {
    open: 'Market Open',
    closed: 'Market Closed',
};

/** Weekday (0=Sun … 6=Sat) and minutes-from-midnight, read in Asia/Karachi. */
function karachiParts(now: Date): { day: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[get('weekday')] ?? 0;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));

    return { day, minutes };
}

/**
 * The current PSX Regular Market state. Pure: pass a `now` in tests, otherwise
 * it reads the real clock and maps it into Pakistan time.
 */
export function getPsxMarketState(now: Date = new Date()): MarketState {
    const { day, minutes } = karachiParts(now);

    // Saturday (6) and Sunday (0): closed all day.
    const schedule = day === 5 ? FRIDAY : day >= 1 && day <= 4 ? MON_THU : [];

    const active = schedule.some((w) => minutes >= w.start && minutes < w.end);
    const phase: MarketPhase = active ? 'open' : 'closed';

    return { phase, isOpen: phase === 'open', label: LABELS[phase] };
}
