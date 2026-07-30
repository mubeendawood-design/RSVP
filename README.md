# Haanji

Beautiful digital invitations for South Asian weddings. The link *is* the invitation — no app, no login, RSVP in two taps.

**Status:** MVP prototype (design v3). Mock data only — Supabase integration is the next step.

## What's here

- `app/i/[token]/page.jsx` — the tokenised guest route (`/i/demo-khan`). Every guest household gets a unique link like this via WhatsApp.
- `components/InviteCard.jsx` — the full invitation experience: wax-seal opening, Mughal-arch card design, two themes (Ivory Botanical / Emerald & Gold), household-level RSVP steppers per event, per-event detail pages (dress code, flow of the day, parking), Google Maps links, dietary capture, confirmation.
- `app/page.jsx` — redirects to the demo invite for now; becomes the marketing page later.

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
2. Supabase schema: `weddings`, `events`, `households` (unique token), `rsvps`
3. `/i/[token]` reads real household + events from Supabase
4. RSVP write-back + .ics calendar files
5. Host dashboard: create wedding, add households, generate links, live headcount + dietary tracker
6. Reminders (Twilio SMS → WhatsApp Business API), Stripe checkout, seating planner

## Notes

- Themes are token sets — adding a new design is data, not code.
- RSVPs are **household-level** (family units, not named individuals) by design.
- Demo data lives inline in `InviteCard.jsx`; it moves to Supabase in step 3.
