import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Serves /sitemap.xml.
 *
 * Only the two publicly readable pages are listed. Everything under (app) needs
 * an account, and a sitemap entry that redirects to login is a soft-404 as far
 * as Search Console is concerned -- it would report errors, not pages.
 *
 * lastModified is the build time rather than a hardcoded date: the screener's
 * universe comes from seed.ts at build time, so a deploy really is the moment
 * these pages last changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/screener`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}
