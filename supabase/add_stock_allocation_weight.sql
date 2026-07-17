-- Target allocation weight per symbol, edited on the Allocation tab.
-- Run once in the Supabase SQL editor.
--
-- Weights are relative, not absolute: the Allocation tab normalizes whatever is set here
-- so the funded symbols sum to 100%. Null means "not set yet", which funds nothing.

alter table stocks
    add column if not exists allocation_weight numeric;

-- PostgREST answers from a cached schema and will keep rejecting writes to the new
-- column with "could not find the 'allocation_weight' column ... in the schema cache"
-- until it picks this up. Supabase reloads on DDL by itself, but not always instantly.
notify pgrst, 'reload schema';
