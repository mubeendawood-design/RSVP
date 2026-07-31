import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// SERVER-ONLY. Never import this from a "use client" file — the service role
// key bypasses every RLS policy we set up in schema.sql. Used only by the
// /api/host/create route to write weddings/events/households as the host.
export const supabaseAdmin = url && serviceKey ? createClient(url, serviceKey) : null;
