-- Profile: the parts of an account the user gets to choose. Email is not among them --
-- it is the login, and Supabase Auth owns it -- so only a display name and a picture
-- live here. Run once in the Supabase SQL editor, after `add_user_settings.sql`.

-- Same row as the display preferences. One row per user either way, and folding the
-- profile into it keeps the app's boot to a single read rather than two.
alter table user_settings add column if not exists display_name text;
alter table user_settings add column if not exists avatar_url   text;

-- Long enough for a real name, short enough that it can't be used as a scratchpad.
-- `not valid` so the constraint applies to new writes without the table having to be
-- scanned for rows that predate it.
alter table user_settings drop constraint if exists user_settings_display_name_len;
alter table user_settings
    add constraint user_settings_display_name_len
    check (display_name is null or char_length(display_name) <= 60) not valid;

-- The uploaded pictures themselves. Public-read, because the URL is what the <img> in
-- the nav bar loads and a signed URL would expire under a session that stays open for
-- days. Nothing sensitive is in here: a user's own picture, at a path only they can
-- write to.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    5242880,                                                -- 5 MB, matched in lib/avatars.ts
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Every object is filed under a folder named for its owner's uid, which is what these
-- policies check. A user can therefore only ever write over their own picture.
drop policy if exists "avatars are publicly readable"  on storage.objects;
drop policy if exists "avatar owner can upload"        on storage.objects;
drop policy if exists "avatar owner can overwrite"     on storage.objects;
drop policy if exists "avatar owner can delete"        on storage.objects;

create policy "avatars are publicly readable" on storage.objects
    for select using (bucket_id = 'avatars');

create policy "avatar owner can upload" on storage.objects
    for insert with check (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Uploading over an existing picture is an update, not an insert, so the overwrite
-- needs its own policy or the second save of an avatar would be rejected.
create policy "avatar owner can overwrite" on storage.objects
    for update using (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
    ) with check (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "avatar owner can delete" on storage.objects
    for delete using (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
    );
