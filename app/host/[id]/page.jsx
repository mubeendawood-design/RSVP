import Link from "next/link";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import HouseholdActions from "./HouseholdActions";

export const dynamic = "force-dynamic";

// Wedding detail: live RSVP tracker per event (invited / confirmed / declined /
// awaiting + dietary notes) and the full household table with per-household
// invite links. Server component behind the /host/* password middleware.
export default async function WeddingDetail({ params }) {
  if (!supabaseAdmin) {
    return <main style={wrap}><p style={muted}>Supabase isn&apos;t configured.</p></main>;
  }

  const weddingId = params.id;
  const [{ data: wedding }, { data: events }, { data: households }, { data: hes }, { data: rsvps }] =
    await Promise.all([
      supabaseAdmin.from("weddings").select("*").eq("id", weddingId).single(),
      supabaseAdmin.from("events").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabaseAdmin.from("households").select("*").eq("wedding_id", weddingId).order("name"),
      supabaseAdmin.from("household_events").select("*"),
      supabaseAdmin.from("rsvps").select("*"),
    ]);

  if (!wedding) {
    return (
      <main style={wrap}>
        <p style={muted}>Wedding not found. <Link href="/host">← Back to dashboard</Link></p>
      </main>
    );
  }

  const hhIds = new Set((households || []).map((h) => h.id));
  const invites = (hes || []).filter((x) => hhIds.has(x.household_id));
  const responses = (rsvps || []).filter((x) => hhIds.has(x.household_id));

  const inviteFor = (hid, eid) => invites.find((x) => x.household_id === hid && x.event_id === eid);
  const rsvpFor = (hid, eid) => responses.find((x) => x.household_id === hid && x.event_id === eid);
  const nameOf = (hid) => (households || []).find((h) => h.id === hid)?.name || "?";

  // Per-event rollups
  const eventStats = (events || []).map((e) => {
    const evInvites = invites.filter((x) => x.event_id === e.id);
    const invitedGuests = evInvites.reduce((n, x) => n + (x.invited_count || 0), 0);
    let confirmed = 0, declinedHH = 0, respondedHH = 0;
    const dietary = [];
    for (const inv of evInvites) {
      const r = rsvpFor(inv.household_id, e.id);
      if (r && r.attending_count !== null) {
        respondedHH += 1;
        if (r.attending_count > 0) confirmed += r.attending_count;
        else declinedHH += 1;
        if (r.dietary) dietary.push({ name: nameOf(inv.household_id), note: r.dietary });
      }
    }
    return {
      event: e, invitedGuests, confirmed, declinedHH,
      awaitingHH: evInvites.length - respondedHH, invitedHH: evInvites.length, dietary,
    };
  });

  return (
    <main style={wrap}>
      <Link href="/host" style={{ color: "#77705F", fontSize: 13, textDecoration: "none" }}>← All weddings</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        <h1 style={h1}>{wedding.couple_name}</h1>
        <Link href={`/host/${weddingId}/seating`} style={{ fontSize: 14, color: "#FBF7EE", background: "#3B3527", border: "1px solid #3B3527", borderRadius: 8, padding: "8px 16px", textDecoration: "none" }}>
          Seating planner →
        </Link>
      </div>

      {/* ---- Per-event RSVP tracker ---- */}
      <section style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {eventStats.map(({ event: e, invitedGuests, confirmed, declinedHH, awaitingHH, invitedHH, dietary }) => (
          <div key={e.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#3B3527" }}>{e.label}</div>
                <div style={{ fontSize: 13, color: "#77705F" }}>
                  {[e.day_label, e.date_num && `${e.date_num} ${e.month_label} ${e.year_label}`, e.event_time, e.venue]
                    .filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#3B3527", lineHeight: 1 }}>
                  {confirmed}<span style={{ fontSize: 14, color: "#A39C88" }}> / {invitedGuests} guests</span>
                </div>
                <div style={{ fontSize: 12, color: "#77705F", marginTop: 4 }}>
                  {invitedHH} households · {declinedHH} declined · {awaitingHH} awaiting
                </div>
              </div>
            </div>
            {dietary.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#5C563F", background: "#F3EEDD", borderRadius: 8, padding: "8px 12px" }}>
                <strong>Dietary:</strong>{" "}
                {dietary.map((d, i) => (
                  <span key={i}>{d.name}: {d.note}{i < dietary.length - 1 ? " · " : ""}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ---- Household table ---- */}
      <h2 style={{ fontSize: 20, color: "#3B3527", marginTop: 32 }}>Households</h2>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {(households || []).map((h) => (
          <div key={h.id} style={{ ...card, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, color: "#3B3527", display: "flex", alignItems: "center", gap: 8 }}>
                  {h.name}
                  {h.side && <span style={sideBadge(h.side)}>{SIDE_LABEL[h.side] || h.side}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#77705F", marginTop: 2 }}>
                  {(events || []).map((e) => {
                    const inv = inviteFor(h.id, e.id);
                    if (!inv) return null;
                    const r = rsvpFor(h.id, e.id);
                    const status =
                      !r || r.attending_count === null ? "awaiting"
                        : r.attending_count === 0 ? "declined"
                        : `${r.attending_count} attending`;
                    return (
                      <span key={e.id} style={{ marginRight: 10 }}>
                        {e.label}: {inv.invited_count} invited, <em>{status}</em>
                      </span>
                    );
                  })}
                </div>
              </div>
              <HouseholdActions
                token={h.token}
                householdName={h.name}
                coupleName={wedding.couple_name}
                phone={h.phone}
              />
            </div>
          </div>
        ))}
        {!households?.length && <p style={muted}>No households yet for this wedding.</p>}
      </div>
    </main>
  );
}

const wrap = { maxWidth: 820, margin: "0 auto", padding: "32px 20px", fontFamily: "Georgia, serif" };
const h1 = { fontSize: 28, color: "#3B3527", margin: 0 };
const muted = { color: "#77705F" };
const card = { background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 12, padding: "16px 18px" };

const SIDE_LABEL = { groom: "Groom's side", bride: "Bride's side", mutual: "Mutual", community: "Community" };
const SIDE_COLOR = { groom: "#3B5D8A", bride: "#A34C6B", mutual: "#77705F", community: "#7A8F52" };
const sideBadge = (side) => ({
  fontSize: 11, fontWeight: 400, textTransform: "none", color: SIDE_COLOR[side] || "#77705F",
  border: `1px solid ${SIDE_COLOR[side] || "#77705F"}55`, borderRadius: 999, padding: "1px 8px",
});
