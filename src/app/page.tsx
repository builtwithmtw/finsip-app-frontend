import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, Wallet, PieChart, ArrowRight, ShieldCheck } from "lucide-react";
import { SECTORS } from "@/lib/types";
import { TICKERS } from "@/lib/seed";
import { AuthAction } from "@/components/home/AuthAction";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s | FinSIP" template -- the brand
  // is already in this title.
  title: { absolute: "FinSIP — PSX Screener & SIP Portfolio Tracker" },
  description:
    "Screen Pakistan Stock Exchange tickers by Shariah and sector, track your SIP portfolio, and plan how each rupee is allocated.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "FinSIP — PSX Screener & SIP Portfolio Tracker",
    description:
      "Screen Pakistan Stock Exchange tickers by Shariah and sector, track your SIP portfolio, and plan how each rupee is allocated.",
  },
  verification: {
    google: "egYOUN5b0osd7QhwRiU8gCzQEptchx_yClgb2Tx1ezM",
  },
};

// Real counts, read from the screener's own universe at build time rather than
// typed in as copy -- add a ticker to seed.ts and this page stays honest.
const STATS = [
  { value: String(TICKERS.length), label: "PSX Tickers" },
  { value: String(SECTORS.length), label: "Sectors" },
  { value: "5Y", label: "Return History" },
  { value: "Live", label: "Market Prices" },
];

const FEATURES = [
  {
    icon: LineChart,
    title: "Screener",
    body: "Every ticker with 1D through 5Y returns. Filter by Shariah, sector, or blue-chip market cap.",
  },
  {
    icon: Wallet,
    title: "Portfolio",
    body: "Log each month's buys and sells. Live P&L and a ledger of exactly where your money went.",
  },
  {
    icon: PieChart,
    title: "Allocation",
    body: "Split an instalment across your symbols by weight, or mirror the KMI 30. Whole shares only.",
  },
];

/**
 * The public landing page.
 *
 * Fits a single viewport with no scrolling: the body is h-full/overflow-hidden,
 * the middle band centres in whatever is left over, and every size steps up only
 * at `lg`. Anything added here has to earn its vertical space.
 *
 * A server component on purpose -- it ships no JS beyond the framework, so the
 * first thing a visitor sees paints immediately.
 */
// Structured data. WebSite gives Google the name to show in results instead of
// one it infers from the domain; WebApplication is what the app actually is.
// Injected as a raw <script> because JSON-LD must not be JSX-escaped -- Next has
// no first-class metadata field for it.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "FinSIP",
      description:
        "Screen Pakistan Stock Exchange tickers by Shariah and sector, track your SIP portfolio, and plan how each rupee is allocated.",
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "FinSIP",
      url: `${SITE_URL}/`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      description:
        "PSX screener and SIP portfolio tracker for Pakistan Stock Exchange investors.",
      featureList: [
        "PSX screener with 1D to 5Y returns",
        "Shariah and sector filters",
        "SIP portfolio tracking",
        "Monthly allocation planning",
      ],
    },
  ],
};

export default function Home() {
  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Depth, cheaply: two blurred colour pools and a faint grid. Pointer-events
          off so none of it interferes with the buttons. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[128px]" />
        <div className="absolute -bottom-52 -right-24 size-[32rem] rounded-full bg-teal-500/10 blur-[128px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(148 163 184 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.07) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      <header className="relative shrink-0 border-b border-white/5">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-8 shrink-0 rounded-lg" />
            <div className="flex flex-col justify-center leading-none">
              <span className="text-base font-black tracking-tight text-white">FINSIP</span>
              <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.28em] text-slate-500">
                SIP Tracker
              </span>
            </div>
          </div>

          {/* A client island: this page stays a server component, but the session
              only exists in the browser, so the one control that depends on it
              has to resolve there. */}
          <AuthAction />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 backdrop-blur">
              <ShieldCheck size={11} className="text-teal-400" />
              Shariah-screened · Pakistan Stock Exchange
            </span>

            <h1 className="mt-5 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-[3.25rem]">
              Invest monthly.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
                Know every rupee.
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400 lg:text-base">
              Screen the PSX, track what you own, and plan the next instalment —
              without a spreadsheet.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/screener"
                className="group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-blue-500/10 transition-all hover:bg-slate-100"
              >
                Open Screener
                <ArrowRight
                  size={13}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 backdrop-blur transition-colors hover:border-white/20 hover:text-white"
              >
                Track Portfolio
              </Link>
            </div>

            <p className="mt-3 text-[10px] font-medium text-slate-600">
              Screener is free and needs no account.
            </p>
          </div>

          {/* Real numbers, not adjectives. */}
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-4 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 lg:mt-10">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-slate-950/40 px-2 py-3 text-center backdrop-blur">
                <p className="text-lg font-black tracking-tight text-white lg:text-xl">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:mt-5">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-sky-300">
                    <feature.icon size={14} />
                  </span>
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-white">
                    {feature.title}
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative shrink-0 border-t border-white/5">
        <div className="mx-auto flex h-10 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
            FinSIP
          </span>
          <span className="text-[9px] font-medium text-slate-600">
            Data from the PSX portal · Not investment advice
          </span>
        </div>
      </footer>
    </main>
  );
}
