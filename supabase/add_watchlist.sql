-- Watchlist: a per-user list of PSX symbols to track (separate from `stocks`,
-- which is the portfolio's master list). Run once in the Supabase SQL editor.

create table if not exists watchlist (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null references auth.users (id) on delete cascade,
    symbol     text        not null,
    -- Sector captured at add-time so the row still labels itself if the symbol
    -- ever falls out of the live feed. The table prefers the live sector when present.
    sector     text,
    created_at timestamptz not null default now(),

    -- A symbol can only sit in a given user's watchlist once.
    unique (user_id, symbol)
);

-- Each user sees and edits only their own rows.
alter table watchlist enable row level security;

create policy "watchlist owner can read"   on watchlist for select using (auth.uid() = user_id);
create policy "watchlist owner can insert" on watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist owner can delete" on watchlist for delete using (auth.uid() = user_id);

create index if not exists watchlist_user_idx on watchlist (user_id, created_at);
