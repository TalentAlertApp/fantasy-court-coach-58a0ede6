import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isLineupLocked, canTransfer } from "../_shared/deadlines.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    if (!teamId) return errorResponse("INVALID_QUERY", "team_id is required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const [lineup, transfer] = await Promise.all([
      isLineupLocked(sb, teamId, now),
      canTransfer(sb, teamId, now),
    ]);

    return okResponse({
      now: now.toISOString(),
      lineup,
      transfer,
      locked: lineup.locked,
      reason: lineup.reason,
      nextDeadline: lineup.nextDeadline,
    });
  } catch (e) {
    console.error("[deadline-status] error:", e);
    return errorResponse("DEADLINE_STATUS_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});