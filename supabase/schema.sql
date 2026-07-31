-- Haanji — Supabase schema (step 2 of README roadmap)
-- Run this whole file once in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)

create extension if not exists pgcrypto;

-- ---------- Core tables ----------

create table if not exists weddings (
  id uuid primary key default gen_random_uuid(),
  couple_name text not null,
  theme_key text not null default 'ivory',
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  slug text not null,              -- 'mehndi' | 'nikah' | 'walima' etc — free-named per host flow
  label text not null,
  day_label text,                  -- 'FRIDAY'
  date_num text,                   -- '11'
  month_label text,                -- 'SEP'
  year_label text,                 -- '2026'
  event_time text,                 -- '6:00 PM'
  venue text,
  maps_url text,
  dress text,
  flow jsonb not null default '[]'::jsonb,   -- [["6:00 PM","Guests arrive..."], ...]
  parking text,
  sort_order int not null default 0,
  unique (wedding_id, slug)
);

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  token text not null unique,      -- the /i/[token] value shared via WhatsApp
  name text not null,              -- 'The Khan Family'
  invited_count int not null,
  phone text,
  created_at timestamptz not null default now()
);

-- which events each household is invited to, and how many of them
-- (per-event invitation lists + per-event headcount, per host flow step 4)
create table if not exists household_events (
  household_id uuid not null references households(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  invited_count int not null default 0,
  primary key (household_id, event_id)
);

create table if not exists rsvps (
  household_id uuid not null references households(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  attending_count int,             -- null = no response, 0 = declined, >0 = attending
  dietary text,
  responded_at timestamptz,
  primary key (household_id, event_id)
);

-- ---------- Row-level security ----------
-- Guests never query these tables directly — only via the two SECURITY DEFINER
-- functions below, keyed on the token. No login, no exposed table scans.

alter table weddings enable row level security;
alter table events enable row level security;
alter table households enable row level security;
alter table household_events enable row level security;
alter table rsvps enable row level security;
-- (No policies added = no direct anon access. Host dashboard will use the
-- Supabase service-role key server-side, which bypasses RLS by design.)

-- ---------- Guest-facing RPCs ----------

-- 1. Look up everything a guest link needs by token, in one call.
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

-- 2. Submit/update an RSVP for one event, validated against the token.
create or replace function submit_rsvp(p_token text, p_event_slug text, p_attending int, p_dietary text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h_id uuid;
  e_id uuid;
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

  return true;
end;
$$;

-- Allow the anon key to call these two functions (and nothing else)
grant execute on function get_invite(text) to anon;
grant execute on function submit_rsvp(text, text, int, text) to anon;

-- ---------- Demo seed data (matches the current InviteCard mock) ----------

do $$
declare
  w_id uuid;
  h_id uuid;
  ev_id uuid;
begin
  insert into weddings (couple_name, theme_key) values ('The Khan Family Wedding', 'ivory') returning id into w_id;

  insert into households (wedding_id, token, name, invited_count)
  values (w_id, 'demo-khan', 'The Khan Family', 6) returning id into h_id;

  insert into events (wedding_id, slug, label, day_label, date_num, month_label, year_label, event_time, venue, maps_url, dress, flow, parking, sort_order)
  values (w_id, 'mehndi', 'Mehndi', 'FRIDAY', '11', 'SEP', '2026', '6:00 PM', 'Gulshan Banqueting, Preston',
    'https://maps.google.com/?q=Gulshan+Banqueting+Preston', 'Vibrant colours — yellows, oranges, greens',
    '[["6:00 PM","Guests arrive, welcome drinks"],["6:45 PM","Bride''s entrance & mehndi ceremony"],["8:00 PM","Dinner served"],["9:30 PM","Music & dancing"]]'::jsonb,
    'Free parking on site. Overflow at Fishergate Centre car park, 3 min walk.', 1)
  returning id into ev_id;
  insert into household_events (household_id, event_id, invited_count) values (h_id, ev_id, 6);

  insert into events (wedding_id, slug, label, day_label, date_num, month_label, year_label, event_time, venue, maps_url, dress, flow, parking, sort_order)
  values (w_id, 'nikah', 'Nikah', 'SATURDAY', '12', 'SEP', '2026', '1:00 PM', 'Masjid-e-Salaam, Preston',
    'https://maps.google.com/?q=Masjid-e-Salaam+Preston', 'Modest formal. Headscarves available at entrance.',
    '[["1:00 PM","Guests seated — please arrive by 12:45"],["1:15 PM","Nikah ceremony"],["2:00 PM","Dua & congratulations"],["2:30 PM","Lunch served"]]'::jsonb,
    'Masjid car park is limited — please use Avenham multi-storey (5 min walk).', 2)
  returning id into ev_id;
  insert into household_events (household_id, event_id, invited_count) values (h_id, ev_id, 6);

  insert into events (wedding_id, slug, label, day_label, date_num, month_label, year_label, event_time, venue, maps_url, dress, flow, parking, sort_order)
  values (w_id, 'walima', 'Walima', 'SUNDAY', '13', 'SEP', '2026', '5:30 PM', 'The Regency Suite, Manchester',
    'https://maps.google.com/?q=The+Regency+Suite+Manchester', 'Formal — lounge suits & evening wear',
    '[["5:30 PM","Arrival & seating (seating plan applies)"],["6:15 PM","Couple''s entrance"],["7:00 PM","Dinner service"],["9:00 PM","Speeches & cake"]]'::jsonb,
    'Valet available. Additional parking announced closer to the date.', 3)
  returning id into ev_id;
  insert into household_events (household_id, event_id, invited_count) values (h_id, ev_id, 6);
end $$;
