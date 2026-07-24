-- Remembered Monthly Entry quantities: one saved snapshot per user that the
-- "Remember"/"Recall" button in Monthly Entry writes and reads. Stored as a
-- single jsonb blob keyed by symbol -> { shares, type } so recalling is one read
-- and remembering is one upsert. Run once in the Supabase SQL editor.

create table if not exists remembered_entries (
    user_id    uuid        primary key references auth.users (id) on delete cascade,
    -- { "MEBL": { "shares": "100", "type": "buy" }, ... }
    entries    jsonb       not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- Each user reads and writes only their own snapshot.
alter table remembered_entries enable row level security;

create policy "remembered owner can read"   on remembered_entries for select using (auth.uid() = user_id);
create policy "remembered owner can insert" on remembered_entries for insert with check (auth.uid() = user_id);
create policy "remembered owner can update" on remembered_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "remembered owner can delete" on remembered_entries for delete using (auth.uid() = user_id);
