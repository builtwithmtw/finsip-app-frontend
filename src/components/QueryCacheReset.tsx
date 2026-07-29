"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

/**
 * Empties the query cache when the session changes hands.
 *
 * The cache is configured to hold everything for the life of the page --
 * `gcTime: Infinity`, nothing evicts on unmount -- which is what lets a tab
 * switch be free. The cost is that a signed-out user's rows would otherwise sit
 * in memory until a reload, and the next person to sign in on the same page
 * would inherit them.
 *
 * This has to live above ProtectedRoute rather than inside the boot gate: on
 * sign-out ProtectedRoute swaps the whole signed-in tree for the login form, so
 * anything inside it unmounts before an effect could notice the user went away.
 * Rendered as a sibling of that tree, this component is still mounted to see it.
 *
 * Nothing is dropped on the way in (null -> a user), which is the ordinary first
 * sign-in and would only throw away the boot gate's work.
 */
export default function QueryCacheReset() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const lastUserId = useRef<string | null>(null);

    const userId = user?.id ?? null;

    useEffect(() => {
        if (lastUserId.current === userId) return;
        if (lastUserId.current !== null) queryClient.clear();
        lastUserId.current = userId;
    }, [userId, queryClient]);

    return null;
}
