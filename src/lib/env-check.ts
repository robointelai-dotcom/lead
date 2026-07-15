/**
 * Environment bootstrap
 * ---------------------
 * If the app is deployed with only `SUPABASE_URL` + `SUPABASE_API_KEY`
 * (which is what the Supabase JS SDK needs) but no `DATABASE_URL`
 * (which is what Prisma needs), we can't magically synthesize the
 * Postgres connection string — Supabase deliberately keeps the DB
 * password separate from the API key.
 *
 * This helper detects that situation and prints a clear, actionable
 * error message at startup so misconfigurations are caught immediately
 * rather than surfacing as a cryptic Prisma error later.
 *
 * Runs on server boot; safe to import from anywhere.
 */

let _validated = false;

export function validateDatabaseEnv(): void {
  if (_validated) return;
  _validated = true;

  const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim();
  const hasSupabase =
    !!process.env.SUPABASE_URL?.trim() &&
    !!(
      process.env.SUPABASE_API_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_ANON_KEY?.trim()
    );

  if (hasDatabaseUrl) {
    console.log("[env] DATABASE_URL detected — Prisma will connect directly.");
    if (hasSupabase) {
      console.log("[env] SUPABASE_URL/API_KEY also detected — supabase-js SDK is available for Storage/Realtime.");
    }
    return;
  }

  if (hasSupabase) {
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════════════╗\n" +
        "║ ⚠  Missing DATABASE_URL                                              ║\n" +
        "╠══════════════════════════════════════════════════════════════════════╣\n" +
        "║ You've set SUPABASE_URL and SUPABASE_API_KEY, but the Prisma layer   ║\n" +
        "║ needs the raw Postgres connection string — not the REST API key.    ║\n" +
        "║                                                                      ║\n" +
        "║ Grab it from Supabase:                                               ║\n" +
        "║   Project Settings → Database → Connection string → URI            ║\n" +
        "║                                                                      ║\n" +
        "║ Then set these two env vars on Hostinger:                            ║\n" +
        "║                                                                      ║\n" +
        "║   DATABASE_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region> ║\n" +
        "║       .pooler.supabase.com:6543/postgres?pgbouncer=true              ║\n" +
        "║       &connection_limit=1                                            ║\n" +
        "║                                                                      ║\n" +
        "║   DIRECT_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>   ║\n" +
        "║       .pooler.supabase.com:5432/postgres                             ║\n" +
        "║                                                                      ║\n" +
        "║ <ref> = jtgmqjgmcaynehrethhl (from your SUPABASE_URL)                ║\n" +
        "║ <PASSWORD> = the DB password you set when creating the project       ║\n" +
        "║              (Settings → Database → Database Password)               ║\n" +
        "╚══════════════════════════════════════════════════════════════════════╝\n"
    );
    return;
  }

  console.error(
    "[env] Neither DATABASE_URL nor SUPABASE_URL/API_KEY is configured. Database access will fail."
  );
}
