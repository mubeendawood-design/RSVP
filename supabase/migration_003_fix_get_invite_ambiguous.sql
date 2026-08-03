-- Migration 003 — fix ambiguous "h.wedding_id" in get_invite
-- The PL/pgSQL variable `h` (households%rowtype, used to check the token
-- exists) had the same name as the table alias `h` in the main query below
-- it — Postgres couldn't tell which one `h.wedding_id` meant and errored
-- with "column reference is ambiguous" on every real invite, silently
-- falling back to demo data on the guest page. Fixed by renaming the alias.

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
    'household', jsonb_build_object('name', hh.name, 'invited', hh.invited_count),
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
  from households hh
  join weddings w on w.id = hh.wedding_id
  join household_events he on he.household_id = hh.id
  join events e on e.id = he.event_id
  left join rsvps r on r.household_id = hh.id and r.event_id = e.id
  where hh.token = p_token
  group by w.theme_key, hh.name, hh.invited_count;

  return result;
end;
$$;
