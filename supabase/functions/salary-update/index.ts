import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

function round2(n: number): number { return Math.round(n * 100) / 100; }

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", null, 405);

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const updates: Array<{ player_id: number; salary: number | null }> = body.updates ?? [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse("INVALID_INPUT", "updates array required", null, 400);
    }

    const playerIds = updates.map(u => u.player_id);

    // Get current fp values for recalc
    const { data: players } = await sb
      .from("players")
      .select("id, fp_pg_t, fp_pg5")
      .in("id", playerIds);

    const fpMap = new Map((players ?? []).map(p => [p.id, { fp: p.fp_pg_t, fp5: p.fp_pg5 }]));

    let updated = 0, recalculated = 0, skipped = 0;
    const notes: string[] = [];

    for (const u of updates) {
      const salary = (u.salary != null && u.salary > 0) ? u.salary : null;
      const fp = fpMap.get(u.player_id);
      if (!fp) { skipped++; notes.push(`Player ${u.player_id} not found`); continue; }

      const value_t = salary ? round2(fp.fp / salary) : 0;
      const value5 = salary ? round2(fp.fp5 / salary) : 0;

      const { error } = await sb.from("players").update({
        salary: salary ?? 0,
        value_t,
        value5,
        updated_at: new Date().toISOString(),
      }).eq("id", u.player_id);

      if (error) { skipped++; notes.push(`Update ${u.player_id}: ${error.message}`); }
      else { updated++; recalculated++; }
    }

    // Log sync_run
    await sb.from("sync_runs").insert({
      type: "SALARY_RECALC",
      status: "SUCCESS",
      finished_at: new Date().toISOString(),
      details: { updated, recalculated, skipped, notes },
    }).then(null, () => {});

    console.log(`[salary-update] Updated ${updated}, recalculated ${recalculated}, skipped ${skipped}`);
    return okResponse({ updated, recalculated, skipped, notes });
  } catch (e) {
    console.error("[salary-update] Error:", e);
    return errorResponse("SALARY_UPDATE_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
