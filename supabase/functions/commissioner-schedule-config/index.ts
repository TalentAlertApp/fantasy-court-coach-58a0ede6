import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

const VALID_KEYS = new Set(["sync3", "all"]);
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data, error } = await sb
        .from("commissioner_sync_schedules")
        .select("*")
        .order("job_key");
      if (error) throw error;
      return okResponse({ schedules: data ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { job_key, enabled, run_time_lisbon, include_recaps } = body ?? {};
      if (!VALID_KEYS.has(job_key)) {
        return errorResponse("INVALID_INPUT", "job_key must be 'sync3' or 'all'");
      }
      if (typeof run_time_lisbon !== "string" || !TIME_RE.test(run_time_lisbon)) {
        return errorResponse("INVALID_INPUT", "run_time_lisbon must be HH:MM (24h)");
      }
      const { data, error } = await sb
        .from("commissioner_sync_schedules")
        .update({
          enabled: !!enabled,
          run_time_lisbon,
          include_recaps: !!include_recaps,
          updated_at: new Date().toISOString(),
        })
        .eq("job_key", job_key)
        .select()
        .maybeSingle();
      if (error) throw error;
      return okResponse({ schedule: data });
    }

    return errorResponse("METHOD_NOT_ALLOWED", "Only GET or POST allowed", null, 405);
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});