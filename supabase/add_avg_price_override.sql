-- The broker's average cost, pinned onto the ledger.
--
-- Transactions only record the month, not the day, so when a symbol was bought and sold
-- within the same month the order is lost and the average the app rebuilds can drift
-- from the broker's. This lets the broker's figure be written down: the app resets the
-- position's cost to it right after the marked transaction, and any later trades build
-- on top as usual.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table transactions
    add column if not exists avg_price_override numeric(14,4);

-- Broker averages as of 2026-11-02. Each is pinned to the symbol's latest real trade,
-- in the same order the app replays them: by month, buys before sells, then entry time.
-- Zero-share placeholder rows are skipped -- the app ignores them, and the override
-- with them.
with account as (
    select id from auth.users where email = 'muhammadtalhawaseem@gmail.com'
),
broker (symbol, avg_price) as (
    values
        ('SYS',    138.94::numeric),
        ('FFC',    560.27::numeric),
        ('MEBL',   494.14::numeric),
        ('OGDC',   300.26::numeric),
        ('LUCK',   453.98::numeric),
        ('SAZEW', 2005.00::numeric),
        ('MLCF',    86.63::numeric),
        ('MARI',   666.59::numeric),
        ('ILP',    102.93::numeric),
        ('GCIL',    36.50::numeric)
),
latest as (
    select distinct on (t.symbol) t.id, t.symbol
    from transactions t
    where t.user_id = (select id from account)
      and t.symbol in (select symbol from broker)
      and t.shares > 0
      and t.price_per_share > 0
    order by t.symbol, t.month desc, (t.type = 'sell') desc, t.created_at desc
),
cleared as (
    update transactions
    set avg_price_override = null
    where user_id = (select id from account)
      and symbol in (select symbol from broker)
      and avg_price_override is not null
      and id not in (select id from latest)
    returning 1
)
update transactions t
set avg_price_override = b.avg_price
from latest l
join broker b on b.symbol = l.symbol
where t.id = l.id;

-- Shares held per symbol, to check against the broker: SYS 400, FFC 76, MEBL 80,
-- OGDC 105, LUCK 78, SAZEW 21, MLCF 265, MARI 35, ILP 180, GCIL 400.
select symbol,
       sum(case when type = 'buy' then shares else -shares end) as shares_held
from transactions
where user_id = (select id from auth.users where email = 'muhammadtalhawaseem@gmail.com')
group by symbol
having sum(case when type = 'buy' then shares else -shares end) > 0.001
order by symbol;
