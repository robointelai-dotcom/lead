/**
 * Supabase JavaScript SDK client (auxiliary — NOT the primary DB layer).
 *
 * Prisma is the source of truth for all business data (it connects
 * directly to the underlying Postgres via DATABASE_URL/DIRECT_URL).
 *
 * This module exposes a supabase-js client for features that require
 * the Supabase REST/JS API instead of direct SQL:
 *   • Storage (uploading files, signed URLs)
 *   • Realtime subscriptions
 *   • Row-level security policies applied through the API surface
 *
 * The client is created lazily so builds without `SUPABASE_URL`/
 * `SUPABASE_API_KEY` don't crash during `next build`.
 *
 *   import { getSupabase } from "@/lib/supabase";
 *   const sb = getSupabase();
 *   if (sb) { await sb.storage.from("avatars").upload(...); }
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient | null;
};

/**
 * Return the shared Supabase client, or `null` if credentials are absent.
 * Never throws — callers must null-check.
 */
export function getSupabase(): SupabaseClient | null {
  if (globalForSupabase.supabase !== undefined) return globalForSupabase.supabase;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    globalForSupabase.supabase = null;
    return null;
  }

  try {
    globalForSupabase.supabase = createClient(url, key, {
      auth: {
        // We use our own JWT-cookie session auth (see src/lib/auth.ts);
        // Supabase Auth is not the source of truth here.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log("[supabase] client initialized:", url);
    return globalForSupabase.supabase;
  } catch (err) {
    console.error("[supabase] failed to initialize client:", err);
    globalForSupabase.supabase = null;
    return null;
  }
}

/**
 * Convenience: throws if Supabase isn't configured — for routes that
 * *require* it (e.g. Storage endpoints).
 */
export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase client not configured. Set SUPABASE_URL and SUPABASE_API_KEY."
    );
  }
  return sb;
}
