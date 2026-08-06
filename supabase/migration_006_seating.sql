-- Migration 006 — seating planner: tables, seat assignments, attendee gender
--
-- Host-only feature. Everything here is reached through the service-role key
-- server-side (host dashboard + /api/host/seating), never by guests, so RLS is
-- enabled with NO anon policies — same pattern as every other table.
--
-- Seating is PER EVENT (a wedding's mehndi / nikah / walima each seat
-- differently). A "seat" is identified by a stable text key:
--   • a named attendee  -> the attendee's uuid
--   • a headcount-only slot -> 'hh:{household_id}:{n}'  (household gave a
--     number but no per-person detail; we still need a draggable seat for each
--     head). Deriving the key this way means we never mutate guest RSVP data.
--
-- Safe to re-run — every statement is idempotent.

-- ---------- 1. Attendee gender (for kids' tables / gender-aware grouping) ----------
-- Optional. Guest form may capture it later; host can also set it. Nullable.

alter table attendees add column if not exists gender text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attendees_gender_check'
  ) then
    alter table attendees
      add constraint attendees_gender_check
      check (gender is null or gender in ('male', 'female'));
  end if;
end $$;

-- ---------- 2. Tables the host lays out for an event ----------

create table if not exists seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  label text not null,                       -- 'Table 1', 'Head table', ...
  capacity int not null default 10,
  color text,                                -- hex, host-chosen group colour
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists seating_tables_event_idx on seating_tables(event_id);

-- ---------- 3. Which seat sits at which table ----------
-- Primary key (event_id, seat_key) guarantees a seat is on at most one table;
-- reassigning is an upsert. Dropping a table cascades its assignments away.

create table if not exists seat_assignments (
  wedding_id uuid not null references weddings(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  seat_key text not null,
  table_id uuid not null references seating_tables(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  label text,                                -- display snapshot: guest name / 'Family #n'
  created_at timestamptz not null default now(),
  primary key (event_id, seat_key)
);

create index if not exists seat_assignments_table_idx on seat_assignments(table_id);

-- ---------- 4. Lock down (host-only, service-role) ----------

alter table seating_tables enable row level security;
alter table seat_assignments enable row level security;
-- No policies on purpose: anon/authenticated get nothing; the host dashboard
-- and /api/host/seating reach these with the service-role key server-side.
