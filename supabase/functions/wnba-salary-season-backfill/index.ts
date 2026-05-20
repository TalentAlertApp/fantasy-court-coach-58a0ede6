// One-shot rebase: adjusts every WNBA player's current salary based on
// season-to-date performance vs the league average FP/G.
//
//   perf  = clamp((player_fp_pg - league_avg_fp_pg) / league_avg_fp_pg, -0.6, +0.6)
//   pct   = perf / 0.6 * 0.20                          // ±20% ceiling
//   newSalary = round1(clamp(currentSalary * (1+pct), 4.5, 25.0))
//
// Players with GP=0 are skipped (salary unchanged). One row per player is
// written to player_salary_changes with reason='SEASON_BACKFILL', idempotent
// via the existing (player_id, change_date, reason) UNIQUE constraint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};
function ok(d: unknown) {
  return new Response(JSON.stringify({ ok: true, data: d }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, data: null, error: { code, message } }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function authorize(req: Request): Response | null {
  const adminSecret = Deno.env.get("ADMIN_API_SECRET");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const got = req.headers.get("x-admin-secret") ?? "";
  if (adminSecret && got === adminSecret) return null;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (serviceRole && bearer === serviceRole) return null;
  return err("UNAUTHORIZED", "Missing or invalid credentials", 401);
}
function todayLisbon(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

const FLOOR = 4.5;
const CAP = 25.0;
const MAX_PCT = 0.20;        // ±20% deviation from current EXP-based baseline
const MIN_LEAGUE_GP = 3;     // ignore tiny-sample players when computing league avg
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = authorize(req); if (authFail) return authFail;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const changeDate = todayLisbon();
  const { data: run } = await sb.from("sync_runs").insert({
    type: "SALARY_SEASON_BACKFILL", status: "RUNNING",
    started_at: new Date().toISOString(),
    details: { change_date: changeDate, league: "wnba" },
  }).select("id").single();
  const runId = run?.id ?? null;

  try {
    const { data: league } = await sb.from("leagues")
      .select("id").eq("code", "wnba").eq("kind", "sport").maybeSingle();
    if (!league) throw new Error("WNBA sport league not found");

    const { data: players, error: pErr } = await sb.from("players")
      .select("id, salary, gp, fp_pg_t")
      .eq("league_id", league.id);
    if (pErr) throw pErr;

    // League average across players with enough sample.
    const sample = (players ?? []).filter((p) =>
      (Number(p.gp) || 0) >= MIN_LEAGUE_GP && (Number(p.fp_pg_t) || 0) > 0
    );
    if (sample.length === 0) {
      throw new Error(`No WNBA players with GP >= ${MIN_LEAGUE_GP}`);
    }
    const leagueAvg = sample.reduce((s, p) => s + (Number(p.fp_pg_t) || 0), 0) / sample.length;

    const changes: Array<{ id: number; old_salary: number; new_salary: number; fp_pg: number }> = [];
    for (const p of (players ?? [])) {
      const gp = Number(p.gp) || 0;
      const oldSalary = Number(p.salary) || 0;
      if (gp === 0 || oldSalary <= 0) continue;
      const fpPg = Number(p.fp_pg_t) || 0;
      const perf = clamp((fpPg - leagueAvg) / leagueAvg, -0.6, 0.6);
      const pct = (perf / 0.6) * MAX_PCT;
      const rawNew = oldSalary * (1 + pct);
      const newSalary = round1(clamp(rawNew, FLOOR, CAP));
      if (newSalary === oldSalary) continue;
      changes.push({ id: p.id, old_salary: oldSalary, new_salary: newSalary, fp_pg: fpPg });
    }

    if (changes.length) {
      const histRows = changes.map((c) => ({
        player_id: c.id, league_id: league.id,
        change_date: changeDate,
        old_salary: c.old_salary, new_salary: c.new_salary,
        reason: "SEASON_BACKFILL", fp_window: c.fp_pg,
      }));
      const { error: insErr } = await sb.from("player_salary_changes")
        .upsert(histRows, { onConflict: "player_id,change_date,reason" });
      if (insErr) throw insErr;

      const nowIso = new Date().toISOString();
      for (const c of changes) {
        await sb.from("players").update({
          salary: c.new_salary,
          last_salary_delta: round1(c.new_salary - c.old_salary),
          last_salary_change_at: nowIso,
          updated_at: nowIso,
        }).eq("id", c.id);
      }
    }

    await sb.from("sync_runs").update({
      status: "SUCCESS", finished_at: new Date().toISOString(),
      details: {
        change_date: changeDate, league: "wnba",
        league_avg_fp_pg: round1(leagueAvg),
        players_total: players?.length ?? 0,
        players_changed: changes.length,
      },
    }).eq("id", runId);

    return ok({
      change_date: changeDate,
      league_avg_fp_pg: round1(leagueAvg),
      players_total: players?.length ?? 0,
      players_changed: changes.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await sb.from("sync_runs").update({
      status: "FAILED", finished_at: new Date().toISOString(),
      details: { change_date: changeDate, error: msg },
    }).eq("id", runId);
    return err("SEASON_BACKFILL_ERROR", msg, 500);
  }
});