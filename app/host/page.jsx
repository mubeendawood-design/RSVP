import Link from "next/link";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Host dashboard index — every wedding, with headline numbers.
// Server component: uses the service-role client (bypasses RLS by design);
// the password middleware on /host/* is the gate.
export default async function HostDashboard() {
  if (!supabaseAdmin) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Host dashboard</h1>
        <p style={{ color: "#77705F" }}>
          Supabase isn&apos;t configured (missing env vars), so there&apos;s nothing to show yet.
        </p>
      </main>
    );
  }

  const [{ data: weddings, error }, { data: households }, { data: rsvps }] = await Promise.all([
    supabaseAdmin.from("weddings").select("id, couple_name, theme_key, created_at").order("created_at", { ascending: false }),
    supabaseAdmin.from("households").select("id, wedding_id"),
    supabaseAdmin.from("rsvps").select("household_id, attending_count"),
  ]);

  if (error) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Host dashboard</h1>
        <p style={{ color: "#B00020" }}>Couldn&apos;t load weddings: {error.message}</p>
      </main>
    );
  }

  const householdWedding = Object.fromEntries((households || []).map((h) => [h.id, h.wedding_id]));
  const stats = {}; // wedding_id -> { households, responded, confirmedGuests }
  for (const h of households || []) {
    stats[h.wedding_id] = stats[h.wedding_id] || { households: 0, responded: new Set(), confirmedGuests: 0 };
    stats[h.wedding_id].households += 1;
  }
  for (const r of rsvps || []) {
    const wid = householdWedding[r.household_id];
    if (!wid || !stats[wid]) continue;
    if (r.attending_count !== null) stats[wid].responded.add(r.household_id);
    if (r.attending_count > 0) stats[wid].confirmedGuests += r.attending_count;
  }

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <h1 style={h1}>Host dashboard</h1>
        <Link href="/host/new" style={btn}>+ New wedding</Link>
      </div>

      {!weddings?.length && (
        <p style={{ color: "#77705F" }}>
          No weddings yet. <Link href="/host/new" style={{ color: "#6B5B3E" }}>Create your first one →</Link>
        </p>
      )}

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        {(weddings || []).map((w) => {
          const s = stats[w.id] || { households: 0, responded: new Set(), confirmedGuests: 0 };
          return (
            <Link key={w.id} href={`/host/${w.id}`} style={card}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#3B3527" }}>{w.couple_name}</div>
              <div style={{ color: "#77705F", fontSize: 14, marginTop: 6 }}>
                {s.households} household{s.households === 1 ? "" : "s"} · {s.responded.size} responded ·{" "}
                <strong style={{ color: "#3B3527" }}>{s.confirmedGuests} guests confirmed</strong>
              </div>
              <div style={{ color: "#A39C88", fontSize: 12, marginTop: 4 }}>
                Created {new Date(w.created_at).toLocaleDateString("en-GB")} · theme: {w.theme_key}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

const wrap = { maxWidth: 760, margin: "0 auto", padding: "32px 20px", fontFamily: "Georgia, serif" };
const h1 = { fontSize: 28, color: "#3B3527", margin: 0 };
const btn = {
  background: "#3B3527", color: "#F5F1E6", padding: "10px 16px", borderRadius: 8,
  textDecoration: "none", fontSize: 14,
};
const card = {
  display: "block", background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 12,
  padding: "16px 18px", textDecoration: "none",
};
