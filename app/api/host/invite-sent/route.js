import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Marks a household's invitation as sent (or clears it). Host-only — sits under
// /api/host/* so the password middleware gates it; writes with the service-role
// key. POST { householdId, sent } -> sets invite_sent_at to now() or null.
export async function POST(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { householdId, sent } = body;
  if (!householdId) {
    return NextResponse.json({ error: "householdId is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("households")
    .update({ invite_sent_at: sent === false ? null : new Date().toISOString() })
    .eq("id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
