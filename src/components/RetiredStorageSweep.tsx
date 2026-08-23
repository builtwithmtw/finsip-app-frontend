"use client";

import { useEffect } from "react";

/**
 * localStorage keys nothing in the app reads any more, cleared once on load.
 *
 * A retired key is invisible: it costs nothing, breaks nothing, and stays in every
 * returning visitor's browser forever unless something goes and removes it. That is
 * fine right up until a key is revived for a different purpose, at which point the app
 * reads an answer given by a version that meant something else by it. Sweeping on the
 * way out is cheaper than remembering the hazard later.
 *
 * Add a key here when its last reader goes; drop it again once enough time has passed
 * that no browser plausibly still holds it.
 */
const RETIRED_KEYS = [
    /*
     * The display preferences. They moved into `user_settings` in Supabase so they
     * follow the account rather than the browser -- see `context/SettingsContext.tsx`.
     */
    "finsip:settings",
    /*
     * Which changelog version this browser had been shown. `ChangelogModal` was the
     * only thing that ever wrote it, and that component -- long unmounted, since the
     * modal used to open itself on every new version -- is gone.
     */
    "last_seen_changelog",
    /*
     * Not ours -- no app code and no runtime dependency writes it, so it is left over
     * from something the app no longer ships (the pre-Next Vite build, most likely).
     * Only a log verbosity level, so removing it costs nothing either way.
     */
    "loglevel",
    /*
     * The gateway a user had added by hand, and the one they had picked. Both went
     * with the gateway picker: the list is administered in Supabase and the app takes
     * the first row, so there is no per-browser choice left to remember.
     */
    "custom_proxies",
    "selected_proxy",
];

/**
 * Runs at the root rather than inside the signed-in app: two of these keys were
 * written on public pages as well, and a visitor who never signs in should still have
 * them cleared.
 */
const RetiredStorageSweep: React.FC = () => {
    useEffect(() => {
        try {
            RETIRED_KEYS.forEach((key) => localStorage.removeItem(key));
        } catch {
            // Storage blocked, as in a locked-down private window. Nothing to clean up
            // there, and a housekeeping sweep is not worth an error.
        }
    }, []);

    return null;
};

export default RetiredStorageSweep;
