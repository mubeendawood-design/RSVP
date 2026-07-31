# Haanji

Beautiful digital invitations for South Asian weddings. The link *is* the invitation — no app, no login, RSVP in two taps.

**Status:** MVP prototype (design v3), now wired to Supabase. Without env vars set, every route falls back to the built-in demo data — nothing breaks pre-launch.

## What's here

- `app/i/[token]/page.jsx` — the tokenised guest route. Looks up the token via the `get_invite` RPC; falls back to demo data if Supabase isn't configured or the token isn't found.
- `components/InviteCard.jsx` — the full invitation experience: wax-seal opening, Mughal-arch card design, two themes (Ivory Botanical / Emerald & Gold), household-level RSVP steppers per event, per-event detail pages (dress code, flow of the day, parking), Google Maps links, dietary capture, confirmation. RSVPs write back to Supabase via `submit_rsvp` when live data is present.
- `app/page.jsx` — redirects to the demo invite for now; becomes the marketing page later.
- `app/host/new/page.jsx` + `app/api/host/create/route.js` — bare-bones host flow: enter couple name, events (label/day/time/venue/dress/parking), households (name/count/phone), submit → creates the wedding + events + households in Supabase and returns copy-ready `/i/[token]` links, one per household. Uses the service-role key server-side only (`lib/supabaseAdmin.js`), so it bypasses RLS as the host — this route has no auth yet, so don't share the `/host/new` URL publicly.
- `lib/supabaseClient.js` — shared anon-key client, `null` if env vars aren't set.
- `lib/supabaseAdmin.js` — server-only service-role client for the host route. Never imported client-side.
- `supabase/schema.sql` — full schema: `weddings`, `events`, `households`, `household_events`, `rsvps`, RLS locked down, two SECURITY DEFINER RPCs (`get_invite`, `submit_rsvp`) grant anon access to nothing else. Includes seed data matching the `demo-khan` mock.

## Supabase setup

1. Create a project at supabase.com.
2. SQL Editor → paste all of `supabase/schema.sql` → Run. This creates the schema, RLS, RPCs, and seeds a real `demo-khan` household.
3. Project Settings → API → copy the URL, the `anon` `public` key, AND the `service_role` key (keep this one secret — server-only).
4. Locally: copy `.env.example` to `.env.local` and fill in all three values.
5. On Vercel: Project → Settings → Environment Variables → add the same three, then redeploy.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy

Push to GitHub, then import the repo at vercel.com — zero config needed.

## Roadmap (from project brief)

1. ~~Guest invite experience (this repo)~~
2. ~~Supabase schema: `weddings`, `events`, `households` (unique token), `rsvps`~~
3. ~~`/i/[token]` reads real household + events from Supabase~~
4. ~~RSVP write-back~~ — .ics calendar files still outstanding
5. ~~Bare-bones host creation flow~~ (`/host/new`) — create wedding, add events, add households, generate links. No auth, no editing existing weddings, no live headcount/dietary view yet — those are next.
6. Host dashboard proper: view/edit an existing wedding, live RSVP headcount + dietary tracker, per-household resend. (Fuller version built in a separate earlier session — not yet merged into this repo.)
7. Auth on `/host/*` routes (currently open to anyone with the URL)
8. Reminders (Twilio SMS → WhatsApp Business API), Stripe checkout, seating planner

## Notes

- Themes are token sets — adding a new design is data, not code.
- RSVPs are **household-level** (family units, not named individuals) by design.
- Demo data lives inline in `InviteCard.jsx`; it moves to Supabase in step 3.
