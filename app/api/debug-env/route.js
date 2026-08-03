import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function info(v) {
  if (!v) return { present: false, length: 0 };
  return { present: true, length: v.length, trimmedLength: v.trim().length };
}

function urlShape(u) {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return {
      protocol: parsed.protocol,
      hostSuffix: parsed.host.slice(-14), // just enough to confirm ".supabase.co", not the ref
      pathname: parsed.pathname, // should be "/" or "" — anything else is the bug
      hasTrailingSlashInEnv: u.endsWith('/'),
      rawEndsWithChars: u.slice(-3), // last 3 chars, to catch stray junk
    };
  } catch (e) {
    return { parseError: e.message };
  }
}

export async function GET() {
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: info(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: info(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: info(process.env.SUPABASE_SERVICE_ROLE_KEY),
    HOST_PASSWORD: info(process.env.HOST_PASSWORD),
  };

  let dbConnection = 'not tested';
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { error, count } = await supabase
        .from('weddings')
        .select('*', { count: 'exact', head: true });
      dbConnection = error ? `error: ${error.message}` : `connected, ${count ?? 0} rows in weddings`;
    } else {
      dbConnection = 'skipped — missing URL or service key';
    }
  } catch (e) {
    dbConnection = `threw: ${e.message}`;
  }

  // Insert test: mirrors exactly what /api/host/create does, then deletes
  // the test row immediately. Isolates whether the failure is in the
  // Supabase client itself vs. something in the create route's logic.
  let insertTest = 'not tested';
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data, error } = await supabase
        .from('weddings')
        .insert({ couple_name: '__debug_test__', theme_key: 'ivory' })
        .select()
        .single();
      if (error) {
        insertTest = `error: ${error.message}`;
      } else {
        await supabase.from('weddings').delete().eq('id', data.id);
        insertTest = 'insert + delete succeeded';
      }
    } else {
      insertTest = 'skipped — missing URL or service key';
    }
  } catch (e) {
    insertTest = `threw: ${e.message}`;
  }

  return NextResponse.json({
    envVars: checks,
    urlShape: urlShape(process.env.NEXT_PUBLIC_SUPABASE_URL),
    dbConnection,
    insertTest,
  });
}
