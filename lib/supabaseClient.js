import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Anon key only — safe for the browser. It can ONLY call get_invite / submit_rsvp
// (see supabase/schema.sql grants). No table is directly readable/writable by anon.
// Null until env vars are set (e.g. before Supabase project exists) — callers
// must check for this rather than assume a client is always available.
export const supabase = url && key ? createClient(url, key) : null;
