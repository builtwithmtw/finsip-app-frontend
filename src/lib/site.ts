/**
 * The canonical origin, in one place because three separate consumers need it
 * and all three break quietly if they disagree: metadataBase (canonical + OG
 * URLs), sitemap.ts (absolute URLs are required -- relative ones are ignored by
 * Google) and robots.ts (the Sitemap: line).
 *
 * Override with NEXT_PUBLIC_SITE_URL in Netlify's env once a custom domain is
 * attached. Netlify also injects URL/DEPLOY_PRIME_URL at build time, but those
 * point at the deploy-preview origin on PR builds, which is exactly the wrong
 * thing to bake into a canonical tag -- so they are deliberately not read here.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://finsip.netlify.app"
).replace(/\/$/, "");
