-- Withdrawals, and the end of reconciliations.
--
-- The ledger is now two things: money in (deposit) and money out (withdrawal). Both are
-- stored as positive amounts; the kind says which way it moved. Dividends are no longer
-- their own kind: existing dividend rows become deposits, notes kept.
--
-- Reconciliations go. They existed to patch cash available over a gap that was really
-- the profit booked on sales; the app now counts that profit directly, so the old
-- corrections would only count it twice. The app already ignores them -- this removes
-- them for good.
--
-- Run in the Supabase SQL editor. Safe to re-run.

delete from sip_deposits where kind = 'reconciliation';

update sip_deposits
set kind = 'deposit',
    note = coalesce(nullif(note, ''), 'Dividend')
where kind = 'dividend';

alter table sip_deposits
    drop constraint if exists sip_deposits_kind_check;

alter table sip_deposits
    add constraint sip_deposits_kind_check
    check (kind in ('deposit', 'withdrawal'));

alter table sip_deposits
    drop constraint if exists sip_deposits_amount_check;

alter table sip_deposits
    add constraint sip_deposits_amount_check check (amount > 0);
