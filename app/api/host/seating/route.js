import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Host-only seating actions. Sits under /api/host/* so the password middleware
// already gates it. All writes use the service-role client (bypasses RLS);
// seating_tables / seat_assignments have no anon policies.
//
// POST body: { action, ...payload }
//   create_table   { weddingId, eventId, label, capacity, color }
//   update_table   { tableId, label?, capacity?, color? }
//   delete_table   { tableId }
//   assign         { weddingId, eventId, seatKey, tableId, householdId, label }
//   unassign       { eventId, seatKey }

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

  const { action } = body;

  try {
    switch (action) {
      case "create_table": {
        const { weddingId, eventId, label, capacity, color } = body;
        if (!weddingId || !eventId || !label?.trim()) {
          return bad("weddingId, eventId and label are required.");
        }
        // Append after the current last table for this event.
        const { count } = await supabaseAdmin
          .from("seating_tables")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);
        const { data, error } = await supabaseAdmin
          .from("seating_tables")
          .insert({
            wedding_id: weddingId,
            event_id: eventId,
            label: label.trim(),
            capacity: clampCapacity(capacity),
            color: color || null,
            sort_order: count ?? 0,
          })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, table: data });
      }

      case "update_table": {
        const { tableId, label, capacity, color } = body;
        if (!tableId) return bad("tableId is required.");
        const patch = {};
        if (typeof label === "string") patch.label = label.trim();
        if (capacity !== undefined) patch.capacity = clampCapacity(capacity);
        if (color !== undefined) patch.color = color || null;
        if (Object.keys(patch).length === 0) return bad("Nothing to update.");
        const { error } = await supabaseAdmin
          .from("seating_tables")
          .update(patch)
          .eq("id", tableId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "delete_table": {
        const { tableId } = body;
        if (!tableId) return bad("tableId is required.");
        // seat_assignments cascade on table delete (FK on delete cascade).
        const { error } = await supabaseAdmin
          .from("seating_tables")
          .delete()
          .eq("id", tableId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "assign": {
        const { weddingId, eventId, seatKey, tableId, householdId, label } = body;
        if (!weddingId || !eventId || !seatKey || !tableId) {
          return bad("weddingId, eventId, seatKey and tableId are required.");
        }
        // Upsert on (event_id, seat_key): moving a seat between tables just
        // overwrites its table_id.
        const { error } = await supabaseAdmin
          .from("seat_assignments")
          .upsert(
            {
              wedding_id: weddingId,
              event_id: eventId,
              seat_key: seatKey,
              table_id: tableId,
              household_id: householdId || null,
              label: label || null,
            },
            { onConflict: "event_id,seat_key" }
          );
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "unassign": {
        const { eventId, seatKey } = body;
        if (!eventId || !seatKey) return bad("eventId and seatKey are required.");
        const { error } = await supabaseAdmin
          .from("seat_assignments")
          .delete()
          .eq("event_id", eventId)
          .eq("seat_key", seatKey);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      default:
        return bad(`Unknown action: ${action}`);
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || "Seating action failed." }, { status: 500 });
  }
}

function bad(msg) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function clampCapacity(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return 10;
  return Math.min(50, Math.max(1, Math.round(n)));
}
