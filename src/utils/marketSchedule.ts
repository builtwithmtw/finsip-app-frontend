/**
 * PSX (Pakistan Stock Exchange) Regular Market schedule.
 *
 * All timings are anchored to Pakistan Standard Time (Asia/Karachi, UTC+5) and
 * evaluated against that timezone regardless of where the viewer's clock sits,
 * so the navbar reads the same for a user in Karachi or in New York.
 *
 * Source: PSX Market State — the Regular Market row of the trading schedule.
 *   Mon–Thu:  Pre-Open 09:15–09:30, Break 09:30–09:32, Open 09:32–15:30,
 *             Close 15:30, Post-Close 15:35–15:50.
 *   Friday:   two sessions —
 *             1st: Pre-Open 09:00–09:15, Break 09:15–09:17, Open 09:17–12:00, Close 12:00.
 *             2nd: Pre-Open 14:15–14:30, Break 14:30–14:32, Open 14:32–16:30, Close 16:30,
 *                  Post-Close 16:35–16:50.
 *   Sat/Sun:  Closed.
 *
 * The intervening Break (order matching & confirmation) minutes are folded into
 * the surrounding Pre-Open window: for the navbar's purposes the market is not
 * yet Open during them.
 */

export type MarketPhase = 'pre-open' | 'open' | 'post-close' | 'closed';

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
    phase: Exclude<MarketPhase, 'closed'>;
}

// Monday–Thursday (single session).
const MON_THU: Window[] = [
    { start: min(9, 15), end: min(9, 32), phase: 'pre-open' },
    { start: min(9, 32), end: min(15, 30), phase: 'open' },
    { start: min(15, 35), end: min(15, 50), phase: 'post-close' },
];

// Friday (two sessions with a midday break).
const FRIDAY: Window[] = [
    { start: min(9, 0), end: min(9, 17), phase: 'pre-open' },
    { start: min(9, 17), end: min(12, 0), phase: 'open' },
    { start: min(14, 15), end: min(14, 32), phase: 'pre-open' },
    { start: min(14, 32), end: min(16, 30), phase: 'open' },
    { start: min(16, 35), end: min(16, 50), phase: 'post-close' },
];

const LABELS: Record<MarketPhase, string> = {
    'pre-open': 'Pre-Open',
    open: 'Market Open',
    'post-close': 'Post-Close',
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

    const active = schedule.find((w) => minutes >= w.start && minutes < w.end);
    const phase: MarketPhase = active ? active.phase : 'closed';

    return { phase, isOpen: phase === 'open', label: LABELS[phase] };
}
