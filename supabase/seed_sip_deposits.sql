-- The account's own deposit ledger, as read off the broker statement.
--
-- Run AFTER add_sip_deposits.sql, in the Supabase SQL editor. If that one was run before
-- the `kind` column existed, re-run it first -- it now upgrades an existing table rather
-- than only creating a new one.
--
-- The user is looked up by email rather than having an id pasted in, so the script is
-- safe to read and safe to run: it cannot write to the wrong account by transcription
-- error. Change the address in both places below if you are seeding a different one.
--
-- Safe to re-run. The rows are listed once and the delete rides along in a CTE, so the
-- list cannot drift out of step with itself the way two copies of it would.

-- Fail early and say why. Without this, an address that matches no account makes the
-- lookup return nothing, the insert takes a null user_id, and the whole thing dies on a
-- not-null constraint several lines later -- an error about the wrong problem.
do $$
begin
    if not exists (select 1 from auth.users where email = 'muhammadtalhawaseem@gmail.com') then
        raise exception 'No account found for that email. Check the address in this script.';
    end if;
end $$;

with account as (
    select id from auth.users where email = 'muhammadtalhawaseem@gmail.com'
),
rows_to_load (deposit_date, kind, amount, note) as (
    values
        (date '2025-10-27', 'deposit',        1862.00::numeric, 'Opening Balance'),
        (date '2025-11-06', 'deposit',       15000.00::numeric, 'Sipping Amount'),
        (date '2025-12-08', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-01-05', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-02-06', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-03-05', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-04-03', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-05-06', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-06-04', 'deposit',       30000.00::numeric, 'Sipping'),
        (date '2026-06-18', 'reconciliation',  102.75::numeric, 'Reconciled Against My Broker'),
        (date '2026-07-05', 'deposit',       31486.00::numeric, null),
        (date '2026-08-06', 'deposit',       35964.00::numeric, 'SIP of August'),
        (date '2026-08-07', 'reconciliation',  -55.49::numeric, 'Reconcilled in August')
),
-- Clears only this user's rows, and only on the dates about to be written, so a re-run
-- replaces rather than doubles and anything entered by hand on other dates survives.
cleared as (
    delete from sip_deposits
    where user_id = (select id from account)
      and deposit_date in (select deposit_date from rows_to_load)
    returning 1
)
insert into sip_deposits (user_id, deposit_date, kind, amount, note)
select
    account.id,
    r.deposit_date,
    r.kind,
    r.amount,
    r.note
-- Joined rather than sub-selected: with no matching account this writes nothing at all,
-- where `(select id from account)` would happily supply a null and hit the constraint.
from rows_to_load r
cross join account;

-- Should report: deposit 11 entries / 294312.00, reconciliation 2 entries / 47.26.
select
    kind,
    count(*)    as entries,
    sum(amount) as total
from sip_deposits
where user_id = (select id from auth.users where email = 'muhammadtalhawaseem@gmail.com')
group by kind
order by kind;
