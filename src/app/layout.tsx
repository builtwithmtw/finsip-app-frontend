import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RootProviders } from "./root-providers";

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
  title: "FinSIP",
  description:
    "Screen Pakistan Stock Exchange tickers by Shariah and sector filters, and track your SIP portfolio.",
  // Everything below came from index.html's <head> under Vite. Next emits these
  // tags from metadata instead, so they had to be restated when that file went
  // away. There is no favicon.ico in public/, which is why the browser's default
  // probe found nothing -- the icon has always been the SVG.
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  // Kept even though the PWA was dropped: these still give iOS "Add to Home
  // Screen" the standalone treatment it had before, and cost nothing.
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
