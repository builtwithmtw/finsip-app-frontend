"use client";

import React from "react";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ProxyProvider } from "@/context/ProxyContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { SettingsProvider } from "@/context/SettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppBootGate from "@/components/AppBootGate";
import QueryCacheReset from "@/components/QueryCacheReset";
import Layout from "@/components/Layout";
import { Providers } from "@/app/providers";

/**
 * The signed-in app: everything that needs a user.
 *
 * This is the old App.tsx provider stack, minus the auth provider (now at the
 * root) and the router. It sits in a route group so the public screener at "/"
 * pays for none of it.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* react-query moves up from the individual pages that used it (watchlist,
       screener) so the whole signed-in app shares one cache: the dashboard's
       Shariah score and the screener's badges then read the same `/api/stocks`
       response instead of fetching it once each. */
    <Providers>
      {/* Outside ProtectedRoute so it survives the sign-out that unmounts
          everything below it -- that transition is the one it exists to catch. */}
      <QueryCacheReset />
      {/* Above the data providers: these are preferences about how the app draws
          itself, read by the nav bar and set on the Settings page, and they depend
          on nothing below them. */}
      <SettingsProvider>
        <PrivacyProvider>
          <ProxyProvider>
            <PortfolioProvider>
              <ConfirmProvider>
                <ProtectedRoute>
                  {/* Inside ProtectedRoute so it only ever gates a signed-in user,
                      and outside Layout so the nav bar appears with the data
                      rather than above a set of empty panels. */}
                  <AppBootGate>
                    <Layout>{children}</Layout>
                  </AppBootGate>
                </ProtectedRoute>
              </ConfirmProvider>
            </PortfolioProvider>
          </ProxyProvider>
        </PrivacyProvider>
      </SettingsProvider>
    </Providers>
  );
}
