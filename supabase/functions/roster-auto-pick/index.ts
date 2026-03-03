import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { team_id, team_name } = await resolveTeam(req, sb);

    return okResponse({
      roster: {
        gw: 1, day: 1, deadline_utc: null,
        starters: [0,0,0,0,0], bench: [0,0,0,0,0],
        captain_id: 0, bank_remaining: 100, free_transfers_remaining: 2,
        constraints: { salary_cap: 100, starters_count: 5, bench_count: 5, starter_fc_min: 2, starter_bc_min: 2 },
        updated_at: null, team_id, team_name,
      },
      debug: { objective: "placeholder", constraints: { salary_cap: 100, starter_fc_min: 2, starter_bc_min: 2 }, candidates_considered: 0 },
    });
  } catch (e) {
    return errorResponse("AUTO_PICK_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
