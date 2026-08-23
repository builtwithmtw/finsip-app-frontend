-- Per-user display preferences: the answers about how the app draws itself for this
-- account. One row per user, created the first time a switch is flipped -- an account
-- that has never opened Settings simply has no row, and the app's defaults are its
-- answer. Run once in the Supabase SQL editor.

create table if not exists user_settings (
    user_id                  uuid        primary key references auth.users (id) on delete cascade,
    -- Abbreviate Worth and Cost in the nav bar: "Rs 272k" rather than "Rs 272,000".
    compact_nav_amounts      boolean     not null default false,
    -- Which reading the Ledger opens on: the transaction log (true) or the
    -- symbol-by-month grid (false).
    show_transactions_ledger boolean     not null default true,
    updated_at               timestamptz not null default now()
);

-- Each user sees and edits only their own row.
alter table user_settings enable row level security;

create policy "user_settings owner can read"   on user_settings for select using (auth.uid() = user_id);
create policy "user_settings owner can insert" on user_settings for insert with check (auth.uid() = user_id);
-- Both halves: the app writes with an upsert, which is an insert that falls through to
-- an update, so a missing update policy would let the first save through and reject
-- every one after it.
create policy "user_settings owner can update" on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
