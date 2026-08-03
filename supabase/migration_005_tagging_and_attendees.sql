-- Migration 005 — household side-tagging + per-guest attendee capture
--
-- Two additions, both prerequisites for seating logic later:
--
-- 1. households.side — host-only internal tag (groom's side / bride's side /
--    mutual / community). Never shown on the guest invite. Lets the host
--    dashboard filter ("who from the bride's side hasn't replied?") and is
--    the first input the future seating engine needs.
--
-- 2. attendees — a real per-person record (name, approx age, high-chair
--    flag for young children, elder flag for 70+, free-text accessibility
--    notes) tied to a household+event. Replaces "just a headcount" with
--    something seating can actually use. Guest-facing: submitted via
--    submit_rsvp, returned via get_invite so a guest reopening their link
--    sees what they already entered.
--
-- Safe to re-run — every statement is idempotent.

-- ---------- 1. Household side tag ----------

alter table households add column if not exists side text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'households_side_check'
  ) then
    alter table households
      add constraint households_side_check
      check (side is null or side in ('groom', 'bride', 'mutual', 'community'));
  end if;
end $$;

-- ---------- 2. Attendees table ----------

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  name text,
  approx_age int,
  high_chair boolean not null default false,
  elder_seating boolean not null default false,
  accessibility_notes text,
  created_at timestamptz not null default now()
);

create index if not exists attendees_household_event_idx
  on attendees(household_id, event_id);

alter table attendees enable row level security;
-- No policies — same pattern as every other table: guests only ever reach
-- this through the SECURITY DEFINER RPCs below, host dashboard reads via
-- the service-role key server-side.

-- ---------- 3. get_invite — now also returns saved attendees per event ----------

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
    'couple_name', w.couple_name,
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
        'dietary', r.dietary,
        'attendees', coalesce(att.attendees, '[]'::jsonb)
      ) order by e.sort_order
    ) filter (where e.id is not null), '[]'::jsonb)
  )
  into result
  from households hh
  join weddings w on w.id = hh.wedding_id
  join household_events he on he.household_id = hh.id
  join events e on e.id = he.event_id
  left join rsvps r on r.household_id = hh.id and r.event_id = e.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'name', a.name,
        'approxAge', a.approx_age,
        'highChair', a.high_chair,
        'elderSeating', a.elder_seating,
        'accessibility', a.accessibility_notes
      ) order by a.created_at
    ) as attendees
    from attendees a
    where a.household_id = hh.id and a.event_id = e.id
  ) att on true
  where hh.token = p_token
  group by w.theme_key, w.couple_name, hh.name, hh.invited_count;

  return result;
end;
$$;

-- ---------- 4. submit_rsvp — now also accepts an attendees array ----------
-- Old 4-arg signature is dropped in favour of a single 5-arg version (last
-- param defaulted) so existing callers keep working without changes.

drop function if exists submit_rsvp(text, text, int, text);

create or replace function submit_rsvp(
  p_token text,
  p_event_slug text,
  p_attending int,
  p_dietary text,
  p_attendees jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h_id uuid;
  e_id uuid;
  a jsonb;
begin
  select h.id into h_id from households h where h.token = p_token;
  if h_id is null then
    return false;
  end if;

  select e.id into e_id
  from events e
  join household_events he on he.event_id = e.id and he.household_id = h_id
  join households h on h.id = h_id
  where e.slug = p_event_slug and e.wedding_id = h.wedding_id;

  if e_id is null then
    return false;   -- household isn't invited to this event — reject
  end if;

  insert into rsvps (household_id, event_id, attending_count, dietary, responded_at)
  values (h_id, e_id, p_attending, p_dietary, now())
  on conflict (household_id, event_id)
  do update set attending_count = excluded.attending_count,
                dietary = excluded.dietary,
                responded_at = now();

  -- Replace the attendee list for this household+event with whatever was
  -- just submitted (guest may be editing a previous answer).
  delete from attendees where household_id = h_id and event_id = e_id;

  if p_attendees is not null and jsonb_typeof(p_attendees) = 'array' then
    for a in select * from jsonb_array_elements(p_attendees)
    loop
      insert into attendees (household_id, event_id, name, approx_age, high_chair, elder_seating, accessibility_notes)
      values (
        h_id, e_id,
        nullif(a->>'name', ''),
        nullif(a->>'approxAge', '')::int,
        coalesce((a->>'highChair')::boolean, false),
        coalesce((a->>'elderSeating')::boolean, false),
        nullif(a->>'accessibility', '')
      );
    end loop;
  end if;

  return true;
end;
$$;

grant execute on function submit_rsvp(text, text, int, text, jsonb) to anon;
grant execute on function get_invite(text) to anon;
