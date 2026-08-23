"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import RetiredStorageSweep from "@/components/RetiredStorageSweep";
import { supabase } from "@/lib/supabase";

/**
 * Sends a password-recovery link to the reset form wherever the user opens it.
 * Lives at the root because the link can land on any route, including the public
 * screener.
 */
const AuthRecoveryHandler: React.FC = () => {
  const router = useRouter();

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Password recovery event detected, navigating to reset page");
        router.push("/reset-password");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
};

/**
 * Only auth lives at the root. The portfolio, proxy, privacy and confirm
 * providers are scoped to the signed-in app -- mounting PortfolioProvider here
 * would have the public screener firing market fetches for anonymous visitors.
 * The screener's header needs useAuth, which is why that one is global.
 */
export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Outside AuthProvider: it hides its children behind a loader, which would take the
          Toaster with it and swallow any toast raised during that window. */}
      <Toaster position="top-right" richColors closeButton />
      {/* Outside AuthProvider too: the keys it clears were written on the public
          pages as well, so it must not wait on a session that may never arrive. */}
      <RetiredStorageSweep />
      <AuthProvider>
        <AuthRecoveryHandler />
        {children}
      </AuthProvider>
    </>
  );
}
