-- Migration 002 — per-event invited counts
-- Run this in Supabase SQL Editor. Safe to run once against the existing DB
-- from schema.sql (uses IF NOT EXISTS / CREATE OR REPLACE throughout).

-- A household's invite count can now differ per event — e.g. all 6 of the
-- Khan family invited to the Nikah, but only 2 to the Walima.
alter table household_events add column if not exists invited_count int not null default 0;

-- Backfill: existing rows (from before this migration) get the household's
-- overall invited_count as a reasonable default, so nothing breaks.
update household_events he
set invited_count = h.invited_count
from households h
where he.household_id = h.id and he.invited_count = 0;

-- Replace get_invite to return the per-event invited count instead of relying
-- on the household-level number for every event.
create or replace function get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h households%rowtype;
  result jsonb;
begin
  select * into h from households where token = p_token;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'household', jsonb_build_object('name', h.name, 'invited', h.invited_count),
    'theme_key', w.theme_key,
    'events', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', e.slug,
        'label', e.label,
        'day', e.day_label,
        'dateNum', e.date_num,
        'month', e.month_label,
        'year', e.year_label,
        'time', e.event_time,
        'venue', e.venue,
        'maps', e.maps_url,
        'dress', e.dress,
        'flow', e.flow,
        'parking', e.parking,
        'invited', he.invited_count,
        'rsvp', r.attending_count,
        'dietary', r.dietary
      ) order by e.sort_order
    ) filter (where e.id is not null), '[]'::jsonb)
  )
  into result
  from households h
  join weddings w on w.id = h.wedding_id
  join household_events he on he.household_id = h.id
  join events e on e.id = he.event_id
  left join rsvps r on r.household_id = h.id and r.event_id = e.id
  where h.token = p_token
  group by w.theme_key;

  return result;
end;
$$;
