import { supabase } from "../../../../lib/supabaseClient";
import { buildICS, icsFilename, parseEventDateTime } from "../../../../lib/ics";

// GET /api/calendar/[token]
//
// Serves the guest's wedding events as a real .ics URL with the proper
// text/calendar content type. This is the difference between "a file lands
// in your downloads folder" and "the calendar app opens with Add ready":
// when the file arrives over the network with the calendar MIME type, both
// iOS and Android hand it directly to the native calendar app — including
// from inside WhatsApp's in-app browser, and with no login, because it
// never touches a calendar provider's website.
//
// Only events the household has RSVP'd attending (count > 0) are included,
// so the diary reflects what they actually said yes to. Before any RSVP is
// saved, all invited events are included (?all=1 forces this too, used
// nowhere yet but harmless).
//
// Uses the anon Supabase client via the get_invite RPC — same access the
// guest page itself has, so this route exposes nothing the token doesn't
// already unlock.
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { token } = params;
  if (!supabase) {
    return new Response("Calendar not available", { status: 503 });
  }

  const { data, error } = await supabase.rpc("get_invite", { p_token: token });
  if (error || !data || !Array.isArray(data.events)) {
    return new Response("Invite not found", { status: 404 });
  }

  const includeAll = new URL(req.url).searchParams.get("all") === "1";
  const anyAnswered = data.events.some((e) => e.rsvp !== null && e.rsvp !== undefined);

  const events = data.events.filter((e) => {
    if (!parseEventDateTime(e)) return false; // no confirmed date yet
    if (includeAll || !anyAnswered) return true; // pre-RSVP: show everything invited
    return (e.rsvp ?? 0) > 0; // post-RSVP: only events they're attending
  });

  if (!events.length) {
    return new Response("No dated events to add", { status: 404 });
  }

  const coupleLabel = data.couple_name || "Wedding";
  const ics = buildICS(events, coupleLabel, token);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(coupleLabel)}"`,
      "Cache-Control": "no-store",
    },
  });
}
