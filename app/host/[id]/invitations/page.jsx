import Link from "next/link";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import InvitationsSender from "./InvitationsSender";

export const dynamic = "force-dynamic";

// "Send invitations" — the personal-first invite flow. The app already holds
// every household's number and composes the message, so the host never touches
// their contact list: they tap through one WhatsApp send per household and we
// track who's been done. Fully automatic reminders (business API) come later.
export default async function InvitationsPage({ params }) {
  if (!supabaseAdmin) {
    return <main style={wrap}><p style={muted}>Supabase isn&apos;t configured.</p></main>;
  }

  const weddingId = params.id;
  const [{ data: wedding }, { data: households }, { data: hes }] = await Promise.all([
    supabaseAdmin.from("weddings").select("*").eq("id", weddingId).single(),
    supabaseAdmin.from("households").select("*").eq("wedding_id", weddingId).order("name"),
    supabaseAdmin.from("household_events").select("household_id, invited_count"),
  ]);

  if (!wedding) {
    return (
      <main style={wrap}>
        <p style={muted}>Wedding not found. <Link href="/host">← Back to dashboard</Link></p>
      </main>
    );
  }

  // Total invited heads per household (max across its events — a household
  // invited to 6 at the Nikah and 2 at the Walima is a party of up to 6).
  const headByHh = {};
  for (const x of hes || []) {
    headByHh[x.household_id] = Math.max(headByHh[x.household_id] || 0, x.invited_count || 0);
  }

  const rows = (households || []).map((h) => ({
    id: h.id,
    name: h.name,
    phone: h.phone || null,
    token: h.token,
    side: h.side || null,
    invited: headByHh[h.id] || h.invited_count || 0,
    sentAt: h.invite_sent_at || null,
  }));

  return (
    <main style={wrap}>
      <Link href={`/host/${weddingId}`} style={{ color: "#77705F", fontSize: 13, textDecoration: "none" }}>← Back to {wedding.couple_name}</Link>
      <h1 style={h1}>Send invitations</h1>
      <p style={{ ...muted, fontSize: 13, marginTop: -6, maxWidth: 620 }}>
        Each invite goes from your own WhatsApp — warm and personal, no unknown business number. The message and link are pre-filled; just tap send for each household. We tick off who’s done so you can stop and resume anytime.
      </p>
      <InvitationsSender weddingId={weddingId} coupleName={wedding.couple_name} rows={rows} />
    </main>
  );
}

const wrap = { maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "Georgia, serif" };
const h1 = { fontSize: 28, color: "#3B3527", margin: "8px 0 4px" };
const muted = { color: "#77705F" };
