-- Removes the payouts and cash-allocation features from the database.
-- Run this in the Supabase SQL editor AFTER deploying the frontend that no longer
-- reads or writes these tables. This is irreversible: take a backup first if the
-- dividend or budget history matters to you.

drop table if exists public.payouts;
drop table if exists public.cash_entries;
