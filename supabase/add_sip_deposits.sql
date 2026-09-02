-- Money you actually put into the brokerage account, as you recorded it.
--
-- The app has always had to guess at this. It records what was bought and sold, never
-- what was transferred in, so it inferred deposits from buying: a purchase not covered
-- by earlier sale proceeds must have been funded from outside. That inference is right
-- often enough to be useful and wrong exactly where it matters -- it cannot see a
-- deposit that sat as cash before being spent, or one spent across two months.
--
-- XIRR is only as good as this list, so this is the list, stated rather than deduced.
-- When an account has rows here they are the cashflows; when it has none the app falls
-- back to the inference, so nothing has to be entered before the figure works at all.
--
-- Run in the Supabase SQL editor. Safe to re-run, and safe on a table created by an
-- earlier version of this file: the ALTERs below bring it up to date, because
-- `create table if not exists` does nothing at all to a table that already exists and
-- would otherwise leave a half-built schema behind.

create table if not exists sip_deposits (
    id           uuid          primary key default gen_random_uuid(),
    user_id      uuid          not null references auth.users (id) on delete cascade,
    -- The day the money reached the account. A date, not a timestamp: XIRR discounts by
    -- whole days and the hour it landed is neither known nor useful.
    deposit_date date          not null,
    -- numeric, never float: money that drifts a paisa at a time is money you cannot
    -- reconcile against a statement.
    amount       numeric(14,2) not null,
    note         text,
    created_at   timestamptz   not null default now()
);

-- 'deposit' is money you put in, and the only kind XIRR is scored on. 'reconciliation'
-- is an adjustment bringing the recorded balance back in line with the broker -- a fee,
-- a rounding, a credit -- recorded so the ledger reconciles, but not counted as a
-- contribution: correcting a number is not the same as funding an account.
alter table sip_deposits
    add column if not exists kind text not null default 'deposit';

alter table sip_deposits
    drop constraint if exists sip_deposits_kind_check;

alter table sip_deposits
    add constraint sip_deposits_kind_check check (kind in ('deposit', 'reconciliation'));

-- The first version of this file wrote `check (amount > 0)`, which is right for a
-- deposit and wrong for a reconciliation: an adjustment can go either way, and a fee is
-- negative. Dropped by name and replaced, so a table built under the old rule accepts
-- the new one rather than rejecting the first correction anyone enters.
alter table sip_deposits
    drop constraint if exists sip_deposits_amount_check;

alter table sip_deposits
    add constraint sip_deposits_amount_check check (amount <> 0);

-- Every read is "this user's entries, oldest first".
create index if not exists sip_deposits_user_date on sip_deposits (user_id, deposit_date);

alter table sip_deposits enable row level security;

-- Dropped first so re-running does not fail on a policy that is already there --
-- `create policy` has no `if not exists`.
drop policy if exists "sip_deposits owner can read"   on sip_deposits;
drop policy if exists "sip_deposits owner can insert" on sip_deposits;
drop policy if exists "sip_deposits owner can update" on sip_deposits;
drop policy if exists "sip_deposits owner can delete" on sip_deposits;

create policy "sip_deposits owner can read"   on sip_deposits for select using (auth.uid() = user_id);
create policy "sip_deposits owner can insert" on sip_deposits for insert with check (auth.uid() = user_id);
create policy "sip_deposits owner can update" on sip_deposits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sip_deposits owner can delete" on sip_deposits for delete using (auth.uid() = user_id);
