import type { MetadataRoute } from "next";

/**
 * Restates the manifest vite-plugin-pwa used to generate. The Next migration
 * dropped the plugin and nothing replaced it, so installed copies of the app
 * were left on the last manifest Vite ever built -- which is why they still wore
 * the pre-rebrand icon.
 *
 * Metadata only: there is deliberately no service worker (see public/sw.js for
 * why the old one had to go), so this restores the app's identity and icons
 * without restoring offline support.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinSIP",
    short_name: "FinSIP",
    description:
      "Screen Pakistan Stock Exchange tickers by Shariah and sector filters, and track your SIP portfolio.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Its own file, padded into the safe zone. The old config pointed "maskable"
      // at the square icon above, so launchers that crop to a circle cut the mark.
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
