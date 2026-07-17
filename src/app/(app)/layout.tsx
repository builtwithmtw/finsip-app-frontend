"use client";

import React from "react";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ProxyProvider } from "@/context/ProxyContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProxyModal from "@/components/ProxyModal";
import Layout from "@/components/Layout";

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
    <PrivacyProvider>
      <ProxyProvider>
        <PortfolioProvider>
          <ConfirmProvider>
            {/* ProxyModal stays mounted but only opens on demand; the changelog used to
                auto-open on every new version and greeted users with a popup on launch. */}
            <ProxyModal />
            <ProtectedRoute>
              <Layout>{children}</Layout>
            </ProtectedRoute>
          </ConfirmProvider>
        </PortfolioProvider>
      </ProxyProvider>
    </PrivacyProvider>
  );
}
