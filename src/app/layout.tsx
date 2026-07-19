import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RootProviders } from "./root-providers";
import { SITE_URL } from "@/lib/site";

// Declared as CSS variables only -- next/font defines the var without applying
// the family. globals.css then points them at .screener-root, so FINSIP's own
// pages keep the system stack they were designed against.
const fontScreenerSans = Manrope({
  variable: "--font-screener-sans",
  subsets: ["latin"],
});

const fontHeading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase is what turns the relative URLs below (and in each page's own
  // metadata) into the absolute ones canonical/OG tags require. Without it Next
  // warns at build time and falls back to localhost.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FinSIP",
    // Pages set a bare title; this appends the brand once, in one place, so
    // "FinSIP Screener | FinSIP" can't happen.
    template: "%s | FinSIP",
  },
  description:
    "Screen Pakistan Stock Exchange tickers by Shariah and sector filters, and track your SIP portfolio.",
  applicationName: "FinSIP",
  // Every page is its own canonical unless it overrides this. Relative values
  // resolve against metadataBase.
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Lets Google show full-length text snippets and large image previews
      // instead of guessing conservatively.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "FinSIP",
    locale: "en_US",
    url: "/",
    title: "FinSIP — PSX Screener & SIP Portfolio Tracker",
    description:
      "Screen Pakistan Stock Exchange tickers by Shariah and sector filters, and track your SIP portfolio.",
    // No purpose-built 1200x630 card exists yet, so this reuses the PWA icon.
    // It renders as a small square in most unfurls -- worth replacing with a
    // real og-image.png when there is one.
    images: [{ url: "/pwa-512x512.png", width: 512, height: 512, alt: "FinSIP" }],
  },
  twitter: {
    card: "summary",
    title: "FinSIP — PSX Screener & SIP Portfolio Tracker",
    description:
      "Screen Pakistan Stock Exchange tickers by Shariah and sector filters, and track your SIP portfolio.",
    images: ["/pwa-512x512.png"],
  },
  // Everything below came from index.html's <head> under Vite. Next emits these
  // tags from metadata instead, so they had to be restated when that file went
  // away. There is no favicon.ico in public/, which is why the browser's default
  // probe found nothing -- the icon has always been the SVG.
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  // iOS reads these rather than the manifest's display/name for "Add to Home
  // Screen", so they have to agree with app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "FinSIP",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // No pre-paint theme script and no `dark` class: the app is light-only.
    <html
      lang="en"
      className={`${fontScreenerSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
