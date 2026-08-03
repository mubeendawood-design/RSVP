import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function info(v: string | undefined) {
  if (!v) return { present: false, length: 0 };
  return { present: true, length: v.length, trimmedLength: v.trim().length };
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
  } catch (e: any) {
    dbConnection = `threw: ${e.message}`;
  }

  return NextResponse.json({ envVars: checks, dbConnection });
}
