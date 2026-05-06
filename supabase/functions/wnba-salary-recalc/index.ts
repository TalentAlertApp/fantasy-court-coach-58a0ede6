import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveLeagueId } from "../_shared/league.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SAL_MIN = 4.5;
const SAL_MAX = 25;

function parseExp(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim().toUpperCase();
  if (s === "" || s === "R" || s === "ROOKIE") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Recalculates every WNBA player's salary deterministically from `exp`:
 *   rookie (exp=0) → SAL_MIN ($4.5M)
 *   max-exp player → SAL_MAX ($25M)
 *   linear interpolation in between, rounded to 0.1.
 * Salary becomes the sole source of truth for WNBA player value.
 */
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const wnbaId = await resolveLeagueId(sb, "wnba");

    const { data: rows, error } = await sb
      .from("players")
      .select("id, name, exp")
      .eq("league_id", wnbaId);
    if (error) return errorResponse("DB_ERROR", error.message, null, 500);
    const players = rows ?? [];
    if (players.length === 0) {
      return okResponse({ updated: 0, min: SAL_MIN, max: SAL_MAX, max_exp: 0, distribution: {} });
    }

    const expByPlayer = new Map<number, number>();
    let maxExp = 0;
    for (const p of players) {
      const e = parseExp((p as any).exp);
      expByPlayer.set(Number((p as any).id), e);
      if (e > maxExp) maxExp = e;
    }

    const distribution: Record<string, number> = {};
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Update sequentially in small batches to keep memory low and writes ordered.
    const ids = Array.from(expByPlayer.keys());
    for (const id of ids) {
      const e = expByPlayer.get(id)!;
      const salary = maxExp <= 0
        ? SAL_MIN
        : round1(SAL_MIN + (e / maxExp) * (SAL_MAX - SAL_MIN));
      const key = salary.toFixed(1);
      distribution[key] = (distribution[key] ?? 0) + 1;

      const { error: upErr } = await sb
        .from("players")
        .update({
          salary,
          // Reset value metrics — pre-season has no FP yet.
          value_t: 0,
          value5: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("league_id", wnbaId);
      if (upErr) { failed++; errors.push(`#${id}: ${upErr.message}`); }
      else updated++;
    }

    return okResponse({
      updated,
      failed,
      min: SAL_MIN,
      max: SAL_MAX,
      max_exp: maxExp,
      distribution,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return errorResponse("RECALC_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
