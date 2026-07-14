-- Custom ordering for the symbol list (drag to rearrange in Stock Manager).
-- Run once in the Supabase SQL editor.

alter table stocks
    add column if not exists position integer;

-- Seed existing rows with their current order (created_at), per user, starting at 0.
with ordered as (
    select id, row_number() over (partition by user_id order by created_at) - 1 as seq
    from stocks
)
update stocks
set position = ordered.seq
from ordered
where stocks.id = ordered.id
  and stocks.position is null;

-- New rows get appended by the app, which sets position explicitly.
create index if not exists stocks_user_position_idx on stocks (user_id, position);
