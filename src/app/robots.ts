import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Serves /robots.txt.
 *
 * The (app) route group sits behind ProtectedRoute, so a crawler never sees
 * anything there but a login flash -- disallowing it keeps those URLs out of
 * the index and spends the crawl budget on the two pages that have content.
 * /api is disallowed for the same reason: /api/stocks returns JSON.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/ledger",
        "/entry",
        "/allocation",
        "/live",
        "/peers",
        "/reset-password",
        "/profile",
        "/settings",
        "/delete-account",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
