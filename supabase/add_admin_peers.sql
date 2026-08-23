-- Peers: the admin's read-only view of every other account's portfolio.
--
-- Nothing in the app could do this before. Every table is row-level-secured to
-- `auth.uid()`, and `lib/admins.ts` is a label the client draws a badge from --
-- it decides nothing, and a modified client can claim it. So the admin check
-- that actually matters lives here, in two SECURITY DEFINER functions that read
-- the caller's own JWT and refuse anyone else.
--
-- Deliberately not done by loosening RLS on `transactions`: an admin-read policy
-- would widen every existing query in the app, and these two functions are the
-- only cross-user reads that should ever exist. Run once in the Supabase SQL
-- editor.

-- Kept in step with ADMIN_EMAILS in src/lib/admins.ts by hand -- there are two
-- lists because they answer two different questions (what to draw, and what to
-- allow), and only this one is authoritative.
create or replace function public.finsip_admin_emails()
returns text[]
language sql
immutable
as $$ select array['muhammadtalhawaseem@gmail.com']::text[] $$;

-- The caller's address comes off the verified JWT, not off anything the client
-- sent as data.
create or replace function public.is_finsip_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select lower(coalesce(auth.jwt() ->> 'email', '')) = any (public.finsip_admin_emails())
$$;

/* -------------------------------------------------------------------------- */
/* Who the peers are                                                          */
/* -------------------------------------------------------------------------- */

-- Every account except the admins themselves. Identity only: the display name
-- and picture come from `user_settings`, which the admin cannot read directly
-- for another user, so they are joined in here.
--
-- Returned even for a peer with no transactions -- an account that signed up and
-- never invested is exactly the kind of thing this screen exists to show.
create or replace function public.admin_peers()
returns table (
    user_id      uuid,
    email        text,
    display_name text,
    avatar_url   text,
    created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
    if not public.is_finsip_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query
    select
        u.id,
        u.email::text,
        s.display_name,
        s.avatar_url,
        u.created_at
    from auth.users u
    left join public.user_settings s on s.user_id = u.id
    where lower(coalesce(u.email, '')) <> all (public.finsip_admin_emails())
    order by u.created_at asc;
end;
$$;

/* -------------------------------------------------------------------------- */
/* What they hold                                                             */
/* -------------------------------------------------------------------------- */

-- Every peer's ledger in one call, tagged with its owner.
--
-- One call rather than one per peer because the client derives both the table
-- (invested, symbols) and the modal (holdings, P/L) from the same rows through
-- `utils/holdings.ts` -- the same code that computes the admin's own numbers, so
-- a peer's figures cannot drift from the way the app counts everywhere else.
-- Recomputing cost basis in SQL would have been a second implementation of it.
--
-- Casts throughout so the declared shape holds whatever the column types are.
create or replace function public.admin_peer_transactions()
returns table (
    id              text,
    user_id         uuid,
    month           text,
    symbol          text,
    shares          numeric,
    price_per_share numeric,
    total_amount    numeric,
    type            text,
    created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
    if not public.is_finsip_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query
    select
        t.id::text,
        t.user_id,
        t.month::text,
        t.symbol::text,
        t.shares::numeric,
        t.price_per_share::numeric,
        t.total_amount::numeric,
        t.type::text,
        t.created_at::timestamptz
    from public.transactions t
    join auth.users u on u.id = t.user_id
    where lower(coalesce(u.email, '')) <> all (public.finsip_admin_emails());
end;
$$;

/* -------------------------------------------------------------------------- */
/* What they have banked                                                      */
/* -------------------------------------------------------------------------- */

-- Every peer's booked profits. Separate from the ledger because it is a separate
-- table in the app -- a sell writes a `realized_pnl` row alongside the
-- transaction, and the two are never derived from one another.
create or replace function public.admin_peer_realized()
returns table (
    id              text,
    user_id         uuid,
    symbol          text,
    quantity_sold   numeric,
    avg_buy_price   numeric,
    avg_sell_price  numeric,
    realized_profit numeric,
    sell_date       text,
    created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
    if not public.is_finsip_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query
    select
        r.id::text,
        r.user_id,
        r.symbol::text,
        r.quantity_sold::numeric,
        r.avg_buy_price::numeric,
        r.avg_sell_price::numeric,
        r.realized_profit::numeric,
        r.sell_date::text,
        r.created_at::timestamptz
    from public.realized_pnl r
    join auth.users u on u.id = r.user_id
    where lower(coalesce(u.email, '')) <> all (public.finsip_admin_emails());
end;
$$;

/* -------------------------------------------------------------------------- */
/* Grants                                                                     */
/* -------------------------------------------------------------------------- */

-- Signed-in callers only. The functions refuse a non-admin themselves, but an
-- anonymous visitor should not be able to reach them at all.
revoke execute on function public.admin_peers()             from public, anon;
revoke execute on function public.admin_peer_transactions()  from public, anon;
revoke execute on function public.admin_peer_realized()      from public, anon;
revoke execute on function public.is_finsip_admin()          from public, anon;

grant execute on function public.admin_peers()              to authenticated;
grant execute on function public.admin_peer_transactions()  to authenticated;
grant execute on function public.admin_peer_realized()      to authenticated;
grant execute on function public.is_finsip_admin()          to authenticated;
