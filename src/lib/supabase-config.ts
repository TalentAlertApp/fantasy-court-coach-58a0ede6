/**
 * Stable, hard-coded Supabase configuration.
 *
 * IMPORTANT: do NOT read import.meta.env here. In some preview runtimes the
 * env object is not populated synchronously during the initial bootstrap,
 * which causes endpoint URLs like `undefined/functions/v1/...` and makes the
 * UI flicker between empty states and loaded data on refresh.
 *
 * These values mirror the constants used in `src/integrations/supabase/client.ts`
 * (publishable anon key — safe to ship in client code).
 */
export const SUPABASE_URL = "https://jtewuekavaujgnynmpaq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU";

export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
