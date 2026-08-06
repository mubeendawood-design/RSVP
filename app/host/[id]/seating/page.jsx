import Link from "next/link";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import SeatingBoard from "./SeatingBoard";

export const dynamic = "force-dynamic";

// Seating planner (host-only, behind /host/* middleware). Per event, every
// confirmed guest becomes a draggable seat: a named attendee where the guest
// entered per-person detail, otherwise a numbered placeholder per remaining
// head. Host lays out colour-coded tables and drags guests onto them.
export default async function SeatingPage({ params }) {
  if (!supabaseAdmin) {
    return <main style={wrap}><p style={muted}>Supabase isn&apos;t configured.</p></main>;
  }

  const weddingId = params.id;
  const [{ data: wedding }, { data: events }, { data: households }, { data: hes }, { data: rsvps }, { data: attendees }, { data: tables }, { data: assigns }] =
    await Promise.all([
      supabaseAdmin.from("weddings").select("*").eq("id", weddingId).single(),
      supabaseAdmin.from("events").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabaseAdmin.from("households").select("*").eq("wedding_id", weddingId),
      supabaseAdmin.from("household_events").select("*"),
      supabaseAdmin.from("rsvps").select("*"),
      supabaseAdmin.from("attendees").select("*"),
      supabaseAdmin.from("seating_tables").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabaseAdmin.from("seat_assignments").select("*").eq("wedding_id", weddingId),
    ]);

  if (!wedding) {
    return (
      <main style={wrap}>
        <p style={muted}>Wedding not found. <Link href="/host">← Back to dashboard</Link></p>
      </main>
    );
  }

  const hhById = new Map((households || []).map((h) => [h.id, h]));
  const hhIds = new Set(hhById.keys());
  const invites = (hes || []).filter((x) => hhIds.has(x.household_id));
  const responses = (rsvps || []).filter((x) => hhIds.has(x.household_id));
  const atts = (attendees || []).filter((x) => hhIds.has(x.household_id));

  // Build a self-contained board model per event.
  const board = (events || []).map((e) => {
    const seats = [];
    for (const inv of invites.filter((x) => x.event_id === e.id)) {
      const h = hhById.get(inv.household_id);
      const r = responses.find((x) => x.household_id === inv.household_id && x.event_id === e.id);
      const attending = r?.attending_count ?? null;
      if (!attending || attending <= 0) continue; // only seat confirmed guests

      const named = atts
        .filter((a) => a.household_id === inv.household_id && a.event_id === e.id)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

      const short = shortName(h?.name);
      for (let slot = 0; slot < attending; slot++) {
        const a = named[slot];
        if (a) {
          seats.push({
            key: a.id,
            label: a.name?.trim() || `${short} #${slot + 1}`,
            householdId: inv.household_id,
            householdName: h?.name || "",
            side: h?.side || null,
            age: a.approx_age ?? null,
            band: ageBand(a.approx_age),
            gender: a.gender || null,
            flags: [a.high_chair && "high chair", a.elder_seating && "elder"].filter(Boolean),
          });
        } else {
          seats.push({
            key: `hh:${inv.household_id}:${slot}`,
            label: `${short} #${slot + 1}`,
            householdId: inv.household_id,
            householdName: h?.name || "",
            side: h?.side || null,
            age: null,
            band: null,
            gender: null,
            flags: [],
            placeholder: true,
          });
        }
      }
    }

    const evTables = (tables || []).filter((t) => t.event_id === e.id);
    const evAssigns = (assigns || []).filter((x) => x.event_id === e.id);
    const assignMap = {};
    for (const x of evAssigns) assignMap[x.seat_key] = x.table_id;

    return { id: e.id, label: e.label, seats, tables: evTables, assignments: assignMap };
  });

  return (
    <main style={wrap}>
      <Link href={`/host/${weddingId}`} style={{ color: "#77705F", fontSize: 13, textDecoration: "none" }}>← Back to {wedding.couple_name}</Link>
      <h1 style={h1}>Seating planner</h1>
      <p style={{ ...muted, fontSize: 13, marginTop: -6 }}>
        Only confirmed guests appear. Named guests carry their age band; households that gave just a headcount show numbered placeholders you can still seat.
      </p>
      <SeatingBoard weddingId={weddingId} board={board} />
    </main>
  );
}

function shortName(name) {
  if (!name) return "Guest";
  // "The Khan Family" -> "Khan"; otherwise first word.
  const cleaned = name.replace(/^the\s+/i, "").replace(/\s+family$/i, "").trim();
  return cleaned.split(/\s+/)[0] || "Guest";
}

function ageBand(age) {
  if (age === null || age === undefined || age === "") return null;
  const n = Number(age);
  if (!Number.isFinite(n)) return null;
  if (n <= 4) return "Infant";
  if (n <= 11) return "Child";
  if (n <= 17) return "High-school";
  if (n <= 24) return "College/Uni";
  if (n <= 39) return "Adults 25+";
  if (n <= 59) return "Adults 40+";
  return "Elders";
}

const wrap = { maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "Georgia, serif" };
const h1 = { fontSize: 28, color: "#3B3527", margin: "8px 0 4px" };
const muted = { color: "#77705F" };
