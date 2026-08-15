import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client.
 *
 * This key bypasses row level security, so it must only ever be constructed on
 * the server. The `server-only` import above turns an accidental client-side
 * import into a build error rather than a leaked credential.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
    );
  }

  // Held across requests: it carries no per-user state, and a request that
  // writes telemetry and recomputes a profile would otherwise build two.
  return (client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

/** The adaptive layer is optional; without it the pathway pipeline still runs. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
