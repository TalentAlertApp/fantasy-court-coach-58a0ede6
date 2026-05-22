import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveLeagueId } from "../_shared/league.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SAL_MIN = 4.5;
const SAL_MAX = 25;

/**
 * Deterministic salary computation for EuroLeague players.
 *
 * EuroLeague has no `exp` (years-of-service) field, so we derive a composite
 * "production score" per player from existing signals:
 *   score = 0.60 * fp_per_game
 *         + 0.25 * minutes_per_game
 *         + 0.15 * age_factor
 * where age_factor peaks at 26 (1.0) and decays away from it
 * (rookies / aging vets sit lower).
 *
 * Players with at least one signal (fp_pg_t > 0, mpg > 0, or known age) get
 * salary_source = "computed". Players with no signal at all are pinned to
 * SAL_MIN with salary_source = "placeholder".
 *
 * Final salaries are linearly normalized across the league to [SAL_MIN, SAL_MAX]
 * and rounded to 0.1.
 */

function ageFactor(age: number): number {
  if (!age || age <= 0) return 0;
  // Peak at 26, gentle bell curve. Clamp to [0, 1].
  const d = Math.abs(age - 26);
  return Math.max(0, 1 - d / 12);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const leagueId = await resolveLeagueId(sb, "euroleague");

    const { data: rows, error } = await sb
      .from("players")
      .select("id, name, age, mpg, fp_pg_t, gp")
      .eq("league_id", leagueId);
    if (error) return errorResponse("DB_ERROR", error.message, null, 500);
    const players = rows ?? [];
    if (players.length === 0) {
      return okResponse({ updated: 0, min: SAL_MIN, max: SAL_MAX, distribution: {}, source_breakdown: { computed: 0, placeholder: 0 } });
    }

    type Score = { id: number; raw: number; hasSignal: boolean };
    const scores: Score[] = players.map((p) => {
      const fp = Number((p as any).fp_pg_t ?? 0);
      const mp = Number((p as any).mpg ?? 0);
      const age = Number((p as any).age ?? 0);
      const hasSignal = fp > 0 || mp > 0 || age > 0;
      const raw = 0.60 * fp + 0.25 * mp + 0.15 * (ageFactor(age) * 20);
      return { id: Number((p as any).id), raw, hasSignal };
    });

    const signalScores = scores.filter((s) => s.hasSignal).map((s) => s.raw);
    const lo = signalScores.length ? Math.min(...signalScores) : 0;
    const hi = signalScores.length ? Math.max(...signalScores) : 1;
    const span = hi - lo || 1;

    const distribution: Record<string, number> = {};
    const source_breakdown = { computed: 0, placeholder: 0 };
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const s of scores) {
      let salary: number;
      let salary_source: string;
      if (!s.hasSignal) {
        salary = SAL_MIN;
        salary_source = "placeholder";
        source_breakdown.placeholder++;
      } else {
        const norm = (s.raw - lo) / span;
        salary = round1(SAL_MIN + norm * (SAL_MAX - SAL_MIN));
        salary_source = "computed";
        source_breakdown.computed++;
      }
      const key = salary.toFixed(1);
      distribution[key] = (distribution[key] ?? 0) + 1;

      const { error: upErr } = await sb
        .from("players")
        .update({
          salary,
          // Reset value metrics — recalculated downstream from FP/last5.
          value_t: 0,
          value5: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id)
        .eq("league_id", leagueId);
      if (upErr) { failed++; errors.push(`#${s.id}: ${upErr.message}`); }
      else updated++;
    }

    return okResponse({
      updated,
      failed,
      min: SAL_MIN,
      max: SAL_MAX,
      distribution,
      source_breakdown,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return errorResponse("RECALC_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});