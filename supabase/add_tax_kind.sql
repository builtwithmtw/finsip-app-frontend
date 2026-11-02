-- Taxes, as a third kind of ledger entry.
--
-- A tax is money the broker cut: it lowers cash available and nothing else. It is not a
-- withdrawal (you did not take it out) and not a contribution, so it stays out of the
-- deposits total and out of XIRR's cashflows. Stored positive, like the other kinds.
--
-- Run after add_withdrawal_kind.sql, in the Supabase SQL editor. Safe to re-run.

alter table sip_deposits
    drop constraint if exists sip_deposits_kind_check;

alter table sip_deposits
    add constraint sip_deposits_kind_check
    check (kind in ('deposit', 'withdrawal', 'tax'));
