import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, Wallet, PieChart, ArrowRight } from "lucide-react";
import { SECTORS } from "@/lib/types";
import { TICKERS } from "@/lib/seed";
import { SITE_URL } from "@/lib/site";
import { AuthPanel } from "@/components/home/AuthPanel";
import { DISPLAY, NUMERIC, WORDMARK } from "@/utils/typography";

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

/**
 * Real counts, read from the screener's own universe at build time rather than
 * typed in as copy -- add a ticker to seed.ts and this page stays honest.
 *
 * The horizons are what the feed actually carries: same-day change and the
 * 52-week range. This used to advertise "5Y Return History", which stopped being
 * true when the per-ticker EOD scrape was replaced -- see the note on `d1` in
 * lib/types.ts.
 */
const STATS = [
  { value: String(TICKERS.length), label: "PSX Tickers" },
  { value: String(SECTORS.length), label: "Sectors" },
  { value: "52W", label: "High / Low" },
  { value: "Live", label: "Prices" },
];

const FEATURES = [
  {
    icon: LineChart,
    title: "Screener",
    body: "Day move, 52-week range and market cap on every ticker. Filter by Shariah, sector or blue chip.",
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
 * The home page, which is also the way in.
 *
 * Split down the middle: the pitch on the dark left, the sign-in form on the
 * light right. There is no separate /login route -- this page is it, and
 * ProtectedRoute sends signed-out visitors here rather than rendering a second
 * copy of the form in place of whatever they asked for.
 *
 * One viewport, never a scrollbar on the left: the root layout's body is
 * h-full/overflow-hidden, the three blocks in the pitch column space themselves
 * with justify-between, and the headline scales with the viewport instead of
 * stepping at breakpoints. Anything added there has to earn its vertical space.
 * The form column is the one exception and keeps `overflow-y-auto` -- on a short
 * window, scrolling to reach the submit button beats hiding it.
 *
 * Below `lg` the pitch column is dropped entirely rather than stacked above the
 * form: someone on a phone came here to get in, and a screenful of scenery in
 * front of that is a toll. A condensed version of the message rides above the
 * form instead.
 *
 * Four things are deliberately absent, because together they are the house style
 * of every generated landing page and the page was read as one: a rounded badge
 * "pill" above the headline, a gradient clipped into the headline text, blurred
 * colour pools in the background, and a floating glass card. What carries the
 * design instead is the app's own vocabulary -- hairline rules, uppercase
 * micro-labels and mono figures. Please don't put them back.
 *
 * A server component but for `AuthPanel`, which has to be a client island
 * because the session only exists in the browser. Everything a visitor sees
 * first is server-rendered.
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
        "PSX screener with day move and 52-week range",
        "Shariah and sector filters",
        "SIP portfolio tracking",
        "Monthly allocation planning",
      ],
    },
  ],
};

export default function Home() {
  return (
    <main className="flex h-full min-h-0 flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* The pitch                                                           */}
      {/* ------------------------------------------------------------------ */}
      {/* Exactly half. The form column is `flex-1`, so this width is the only
          thing deciding the split -- anything other than 1/2 here makes the two
          sides visibly uneven. */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex xl:p-12">
        {/* The only background treatment: a hairline grid at the layout's own
            64px pitch, fading out well before it reaches any text. No blurred
            colour pools -- the light in this column comes from the type being
            white on near-black, not from gradients behind it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(148 163 184 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
          }}
        />

        {/* The mark stands on its own: no tagline under it and no gloss on what
            the name expands to. It is set in Sora at 800 -- the one face in the
            app reserved for the wordmark. */}
        <div className="relative flex items-center gap-2">
          {/* Sized to the wordmark's cap height rather than to its line box, so
              the mark and the letters read as one object. The corner radius comes
              down with it -- rounded-xl on a 24px square is nearly a circle. */}
          <img src="/logo.svg" alt="" className="size-6 shrink-0 rounded-md xl:size-7" />
          <span
            className="text-[26px] font-extrabold uppercase leading-none tracking-[-0.03em] text-white xl:text-[30px]"
            style={WORDMARK}
          >
            FinSIP
          </span>
        </div>

        <div className="relative">
          {/* A ruled caption, not a badge: a hairline, then small tracked-out
              caps, the same construction as the micro-labels the app puts over
              its figures. */}
          <span className="flex items-center gap-3">
            <span aria-hidden className="h-px w-8 bg-teal-400/60" />
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.26em] text-slate-400"
              style={DISPLAY}
            >
              Shariah-screened · Pakistan Stock Exchange
            </span>
          </span>

          {/* Two tones, no gradient: the second line is the one that matters, so
              the first recedes. */}
          <h1
            className="mt-6 text-[clamp(1.9rem,3.4vw,3.1rem)] font-semibold leading-none tracking-[-0.03em]"
            style={DISPLAY}
          >
            <span className="text-slate-500">Invest monthly.</span>
            <br />
            <span className="text-white">Know every rupee.</span>
          </h1>

          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-slate-400">
            Screen the PSX, track what you own, and plan the next instalment —
            without a spreadsheet.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href="/screener"
              style={DISPLAY}
              className="group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-900 transition-colors hover:bg-slate-200"
            >
              Open Screener
              <ArrowRight
                size={13}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <span className="text-[11px] text-slate-500">
              Free, and needs no account.
            </span>
          </div>
        </div>

        {/* Coverage. Every figure is read from the screener's own universe --
            there are no mocked-up prices here pretending to be a live market. */}
        <div className="relative">
          <div className="flex items-center gap-10 border-y border-white/[0.07] py-5">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p
                  className="text-xl font-semibold leading-none tracking-tight text-white"
                  style={NUMERIC}
                >
                  {stat.value}
                </p>
                <p
                  className="mt-2 text-[8.5px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  style={DISPLAY}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.07]">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5 py-3.5">
                <feature.icon size={14} className="mt-0.5 shrink-0 text-teal-400/80" />
                <div className="min-w-0">
                  <h2
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
                    style={DISPLAY}
                  >
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="pt-4 text-[9px] text-slate-600">
            Data from the PSX portal · Not investment advice
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The way in                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <header className="flex h-16 shrink-0 items-center justify-between px-5 sm:px-8">
          {/* The mark only needs repeating where the pitch column isn't. */}
          <span className="flex items-center gap-2.5 lg:invisible">
            <img src="/logo.svg" alt="" className="size-9 shrink-0 rounded-lg" />
            <span
              className="text-[20px] font-extrabold uppercase leading-none tracking-widest text-slate-900"
              style={WORDMARK}
            >
              FinSIP
            </span>
          </span>

          {/* No screener link here: the pitch column's Open Screener button is
              the way there, and this side is for one thing only. The bar still
              occupies h-16 -- pb-16 below balances against it to centre the form
              on the viewport rather than on what the header leaves over. */}
        </header>

        {/* pb-16 matches the header's h-16. Centring inside what the header
            leaves over would put the form half a header-height below the middle
            of the screen; a phantom header's worth of padding at the bottom
            balances the real one at the top. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-16 sm:px-8">
          {/* The message, condensed, for the widths where the pitch column is
              gone. */}
          {/* max-w-md, matching AuthPanel, so this and the form share one left edge. */}
          <div className="mb-8 w-full max-w-md lg:hidden">
            <span className="flex items-center gap-3">
              <span aria-hidden className="h-px w-6 bg-teal-500" />
              <span
                className="text-[8.5px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                style={DISPLAY}
              >
                Shariah-screened · PSX
              </span>
            </span>
            <p
              className="mt-3 text-2xl font-semibold leading-[1.05] tracking-[-0.03em]"
              style={DISPLAY}
            >
              <span className="text-slate-400">Invest monthly.</span>
              <br />
              <span className="text-slate-900">Know every rupee.</span>
            </p>
          </div>

          <AuthPanel />

          <p className="mt-8 w-full max-w-md text-[9px] text-slate-400 lg:hidden">
            Data from the PSX portal · Not investment advice
          </p>
        </div>
      </div>
    </main>
  );
}
