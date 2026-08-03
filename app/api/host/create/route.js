import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24) || "guest";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

export async function POST(req) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase isn't configured (missing env vars) — nothing was saved." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { coupleName, themeKey, events, households } = body;

  if (!coupleName || !events?.length || !households?.length) {
    return NextResponse.json(
      { error: "Couple name, at least one event, and at least one household are required." },
      { status: 400 }
    );
  }

  const badPhone = households.find((h) => (h.phone || "").replace(/[^\d+]/g, "").length < 10);
  if (badPhone) {
    return NextResponse.json(
      { error: `${badPhone.name || "A household"} needs a valid mobile number.` },
      { status: 400 }
    );
  }

  // 1. Create the wedding
  const { data: wedding, error: wErr } = await supabaseAdmin
    .from("weddings")
    .insert({ couple_name: coupleName, theme_key: themeKey || "ivory" })
    .select()
    .single();
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  // 2. Create the events, in the order given
  const eventRows = events.map((e, i) => ({
    wedding_id: wedding.id,
    slug: slugify(e.label) + (i > 0 ? `-${i}` : ""),
    label: e.label,
    day_label: e.dayLabel || null,
    date_num: e.dateNum || null,
    month_label: e.monthLabel || null,
    year_label: e.yearLabel || null,
    event_time: e.time || null,
    venue: e.venue || null,
    maps_url: e.venue
      ? `https://maps.google.com/?q=${encodeURIComponent(e.venue)}`
      : null,
    dress: e.dress || null,
    parking: e.parking || null,
    flow: [],
    sort_order: i,
  }));
  const { data: insertedEvents, error: eErr } = await supabaseAdmin
    .from("events")
    .insert(eventRows)
    .select();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  // 3. Create households with unique tokens (retry on collision)
  const createdHouseholds = [];
  for (const h of households) {
    // h.eventCounts is an array aligned with `events` (and therefore
    // `insertedEvents`) — how many of this household are invited to each
    // event. A household's overall "invited" number (shown on their card
    // header) is the largest of those per-event counts.
    const counts = h.eventCounts || [];
    const overallInvited = counts.length ? Math.max(...counts, 1) : (h.invitedCount || 1);

    let token, hErr, hRow;
    for (let attempt = 0; attempt < 5; attempt++) {
      token = `${slugify(h.name)}-${randomSuffix()}`;
      const res = await supabaseAdmin
        .from("households")
        .insert({
          wedding_id: wedding.id,
          token,
          name: h.name,
          invited_count: overallInvited,
          phone: h.phone || null,
        })
        .select()
        .single();
      hErr = res.error;
      hRow = res.data;
      if (!hErr) break; // success, unique token accepted
    }
    if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });
    createdHouseholds.push(hRow);

    // 4. Link this household only to events where they're invited (count > 0),
    // with that event's specific headcount for this household.
    const links = insertedEvents
      .map((e, idx) => ({ household_id: hRow.id, event_id: e.id, invited_count: counts[idx] || 0 }))
      .filter((l) => l.invited_count > 0);
    if (links.length) {
      const { error: linkErr } = await supabaseAdmin.from("household_events").insert(links);
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    wedding,
    households: createdHouseholds.map((h) => ({
      name: h.name,
      invited: h.invited_count,
      token: h.token,
      phone: h.phone,
    })),
  });
}
