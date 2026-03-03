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
    await resolveTeam(req, sb); // validates team exists

    return okResponse({
      is_valid: true, errors: [], warnings: [],
      before: { salary_used: 0, bank_remaining: 100, proj_fp5: 0, proj_stocks5: 0 },
      after: { salary_used: 0, bank_remaining: 100, proj_fp5: 0, proj_stocks5: 0 },
      delta: { proj_fp5: 0, proj_stocks5: 0, proj_ast5: 0 },
    });
  } catch (e) {
    return errorResponse("SIM_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
