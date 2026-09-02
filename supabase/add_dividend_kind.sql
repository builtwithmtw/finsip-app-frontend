-- Dividends, as a third kind of ledger entry.
--
-- A dividend is money the investment produced, not money you put in. Recording it as a
-- deposit is wrong in a way that quietly flatters nothing and penalises you: it inflates
-- the capital the return is measured against, so the portfolio looks like it earned less
-- than it did. On one 7,084 dividend across a 294k book that was the difference between
-- reading -1.83% and +3.82% a year.
--
-- So it sits alongside 'reconciliation' as an entry that is recorded and shown but is
-- never a contribution. The two differ in where else they count:
--
--   deposit        money in from you       -> contribution, and cash
--   dividend       money in from the book  -> cash only
--   reconciliation a correction            -> cash only
--
-- Cash available is the same arithmetic either way, which is the check that this is the
-- right shape: deposits + dividends + corrections - invested.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table sip_deposits
    drop constraint if exists sip_deposits_kind_check;

alter table sip_deposits
    add constraint sip_deposits_kind_check
    check (kind in ('deposit', 'dividend', 'reconciliation'));

-- The 7,084 entered on this account was a dividend recorded as a deposit. Scoped by
-- amount and kind so it cannot touch a real deposit of a different size, and it does
-- nothing at all once the row is already correct.
update sip_deposits
set kind = 'dividend',
    note = coalesce(nullif(note, ''), 'Dividend')
where user_id = (select id from auth.users where email = 'muhammadtalhawaseem@gmail.com')
  and kind = 'deposit'
  and amount = 7084.00;

select kind, count(*) as entries, sum(amount) as total
from sip_deposits
where user_id = (select id from auth.users where email = 'muhammadtalhawaseem@gmail.com')
group by kind
order by kind;
