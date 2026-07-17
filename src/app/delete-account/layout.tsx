"use client";

import React from "react";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { ProxyProvider } from "@/context/ProxyContext";
import ProtectedRoute from "@/components/ProtectedRoute";

/**
 * Protected, but deliberately outside the (app) group: the delete flow renders
 * without the nav chrome, exactly as it did under the old router. It still needs
 * the portfolio context to report what is about to be destroyed.
 */
export default function DeleteAccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProxyProvider>
      <PortfolioProvider>
        <ProtectedRoute>{children}</ProtectedRoute>
      </PortfolioProvider>
    </ProxyProvider>
  );
}
