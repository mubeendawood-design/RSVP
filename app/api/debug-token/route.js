import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// GET /api/debug-token?token=xxxx
// Read-only. Shows the raw DB state for a household token, and the exact
// result get_invite would return, so we can see the real state directly
// instead of guessing from the rendered page.
export async function GET(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Pass ?token=xxxx" }, { status: 400 });
  }

  const { data: household, error: hErr } = await supabaseAdmin
    .from("households")
    .select("*, weddings(couple_name, theme_key)")
    .eq("token", token)
    .maybeSingle();

  const { data: links, error: lErr } = household
    ? await supabaseAdmin
        .from("household_events")
        .select("invited_count, events(label, slug, venue, event_time)")
        .eq("household_id", household.id)
    : { data: null, error: null };

  const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("get_invite", { p_token: token });

  return NextResponse.json({
    household: household || null,
    householdError: hErr?.message || null,
    linkedEvents: links || null,
    linkedEventsError: lErr?.message || null,
    get_invite_result: rpcResult,
    get_invite_error: rpcErr?.message || null,
  });
}
