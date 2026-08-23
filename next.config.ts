import type { NextConfig } from "next";

// The signed-in app plus the two account-flow pages. Their layouts and views are
// client components, so they cannot export `metadata` and cannot emit a
// <meta name="robots"> tag -- an X-Robots-Tag header is the only way to mark
// them noindex, and it belongs here. robots.txt already disallows them, but a
// disallowed URL can still be indexed from an inbound link; noindex is what
// actually keeps it out of results.
const PRIVATE_PATHS = [
  "/dashboard/:path*",
  "/ledger/:path*",
  "/entry/:path*",
  "/allocation/:path*",
  "/live/:path*",
  "/peers/:path*",
  "/reset-password/:path*",
  "/profile/:path*",
  "/settings/:path*",
  "/delete-account/:path*",
];

const nextConfig: NextConfig = {
  async headers() {
    return PRIVATE_PATHS.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
