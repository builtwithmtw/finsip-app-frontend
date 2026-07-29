# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FINSIP — working agreement

## Verification

- **Don't run `npm run build`.** It is slow and the user does not want it in the loop.
- **Don't run linting** (`eslint`, `npm run lint`) as a check on your own work. This repo
  has pre-existing lint errors that are not yours to fix, and reporting them is noise.
- `npx tsc --noEmit` is fine and fast when a change could plausibly break types.

Verify by making the change carefully and reading it back, not by running the toolchain
over it.

## Focus

Execute the feature that was asked for. Don't widen the change into adjacent cleanups,
don't fix unrelated pre-existing problems, and don't report them unless they block the
task. Keep the diff to the thing requested.

## Commands

```bash
npm run dev     # next dev on :3000 — the only command normally needed
```

There is no test suite. `README.md` is a leftover Vite template from before the Next
port; it describes nothing in this repo — ignore it.

`.env` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both public
by design; row-level security, not secrecy, is what protects the data).

## What this is

A Next.js 16 App Router app (React 19, Tailwind v4, Supabase) for Pakistan Stock Exchange
investors: a **public screener** and a **signed-in SIP portfolio tracker**.

## Architecture

### The public/private split is the main structural fact

`src/app/(app)/` is the signed-in app; everything else under `src/app/` is public. That
route group exists so anonymous visitors on `/` and `/screener` pay for none of the
signed-in machinery.

- `app/layout.tsx` → `RootProviders`: **only** `AuthProvider` + `Toaster` + the
  password-recovery redirect. Global because the public screener's header calls `useAuth`.
- `app/(app)/layout.tsx`: react-query `Providers` → `PrivacyProvider` → `ProxyProvider` →
  `PortfolioProvider` → `ConfirmProvider` → `ProtectedRoute` → `AppBootGate` → `Layout`
  (the nav chrome). Adding a provider here rather than at the root is the default;
  mounting `PortfolioProvider` globally would fire market polling for anonymous visitors.

### Everything loads once, before the app shell

`components/AppBootGate.tsx` holds the signed-in app behind one full-screen loader until
every source has answered, then renders the shell. After that **nothing refetches on its
own**: `app/providers.tsx` sets `staleTime: Infinity`, `gcTime: Infinity` and turns off
refetch on mount/focus/reconnect, so a tab switch is a cache read and each tab already
has its data. This is load-bearing — a feature that fetches when its tab mounts
reintroduces exactly the per-tab skeletons the gate exists to remove.

Consequences to respect when adding anything that reads data:

- Put the query key and fetcher in `lib/queries.ts` and warm it in the gate's prefetch
  list. A hook that invents its own key silently misses the warm cache.
- Mutations update the cache directly (`setQueryData`) rather than invalidating —
  an invalidation would refetch and put a populated tab back into a loading state.
- `hooks/useAppRefresh.ts` (`refreshAll`) is the one deliberate refresh: it re-reads the
  Supabase tables silently, refetches every query, and nudges the live feed. The nav
  bar's refresh button is its only caller. `PortfolioContext.refreshData()` is silent by
  design — it does not raise the loading flags, so a refresh never blanks a screen.
- The gate has a 20s ceiling. Every source behind it is a third-party feed through a
  public CORS gateway, and one being down must not mean an app that never opens.
- `components/QueryCacheReset.tsx` sits above `ProtectedRoute` on purpose: sign-out
  unmounts the whole signed-in tree, so nothing inside it can observe that transition.

Pages under `app/` are thin: they render a matching component from `src/views/`
(`DashboardPage`, `LedgerPage`, `AllocationPage`, `LivePortfolioPage`, `WatchlistPage`,
`EntryPage`). New signed-in screens follow that pattern — a route file plus a view — and
`components/Layout.tsx` holds the nav array that lists them.

There is no `/login` route. `/` is both the landing page and the sign-in form —
the pitch on the dark left, `components/home/AuthPanel.tsx` (the page's only client
island) on the light right. `ProtectedRoute` redirects signed-out visitors there;
`AuthPanel` sends them to `/dashboard` after a successful submit, but never
auto-redirects an already-signed-in visitor away from `/`.

`next.config.ts` sets `X-Robots-Tag: noindex` on the private paths; those layouts are
client components and cannot export `metadata`, so the header is the only way. A new
private route needs adding to `PRIVATE_PATHS` there and to `app/robots.ts`.

### Two separate market-data paths — don't conflate them

1. **Screener data (server-side).** `app/api/stocks/route.ts` → `lib/sarmaaya.ts` reads
   the Sarmaaya REST feed on the server (avoids browser CORS), maps it onto the fixed
   ticker universe in `lib/seed.ts`, and caches per response (long TTL for a complete
   result, short for a degraded one). Clients reach it through `lib/api.ts` /
   `hooks/useStocks.ts` (react-query). `hooks/useShariah.ts` rides the same cache, so
   Shariah answers can't diverge between screener badges and the dashboard;
   `lib/shariah.ts` is only the fallback snapshot. The public `/screener` route mounts
   its own `Providers`, so it has a separate cache and is not gated.
2. **Live portfolio prices (browser-side).** `PortfolioContext` fetches the same upstream
   feed *through a user-selected CORS proxy* (`ProxyContext`, proxies stored in Supabase
   plus localStorage customs) and publishes `livePrices` / `liveChanges` /
   `consecutiveFailures` / `nextRefreshAt`. Poll cadence is driven by
   `utils/marketSchedule.ts` (`getPsxMarketState`): 30s while PSX is open, 5min closed,
   12s while reconnecting.

### PortfolioContext is the app's core

`src/context/PortfolioContext.tsx` (~640 lines) owns transactions, stocks, realized P&L,
the live feed, the selected month, and every mutation. Conventions that hold throughout
and are load-bearing:

- **Per-table loading flags** (`stocksLoading` / `transactionsLoading` / `realizedLoading`)
  fetched independently via `Promise.allSettled`. Prefer these over the aggregate
  `loading` — one slow query shouldn't blank an unrelated section.
- **Optimistic writes with snapshot rollback** (`setStockWeight`, `reorderStocks`): keep
  `previous`, apply locally, restore + `toast.error` on failure.
- **snake_case in Supabase, camelCase in app types.** Mapping happens inline at every
  query/insert site; there is no shared row mapper.
- Ordering by a column added in a later migration is done in JS, not SQL, so an
  unmigrated database degrades instead of erroring.

### Derived numbers live in `utils/holdings.ts`

`computeHoldings` / `computeLiveHoldings` / `summarizeLive` / `avgBuyPriceFor` are the
single source for share counts, cost basis and P&L. Two rules encoded there: buys sort
before sells within a month (otherwise a same-month full exit leaves a phantom holding),
and an unpriced symbol is held at cost basis, never at zero.

### Supabase

Tables: `stocks`, `transactions`, `realized_pnl`, `watchlist`, `remembered_entries`,
`proxies`. Every user-owned query filters `.eq('user_id', user.id)` on top of RLS.
Schema changes are hand-run SQL in `supabase/*.sql` (there is no migration tool) — add a
file there and run it in the Supabase SQL editor. A GitHub Action pings the project every
3 days so the free tier doesn't pause it.

### Styling

Tailwind v4 (`@tailwindcss/postcss`, no config file — theme lives in `app/globals.css`),
shadcn-style primitives in `components/ui/`, `@/*` → `src/*`. The app is **light-only**;
there is no dark class or theme script. Fonts are declared as bare CSS variables in
`app/layout.tsx` and only bound to `.screener-root` in globals.css — FINSIP's own panels
opt into the display/mono faces through `utils/typography.ts` (`DISPLAY`, `NUMERIC`), and
figures use mono so digits hold their column as prices tick.

`PrivacyContext` masks every currency figure app-wide (Shift+H); render amounts through
its `useCurrency` rather than importing `formatCurrency` directly in signed-in UI.
