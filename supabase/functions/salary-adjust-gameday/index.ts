// Automated post-gameday salary adjustment (NBA + WNBA).
//
// For each player who has FINAL game log(s) on the target gameday (default:
// yesterday Europe/Lisbon), compute a daily delta based on the player's day FP
// relative to expected FP. Adjustment rules:
//
//   - Max ±1% of current salary per gameday.
//   - Bounds per league:
//        NBA  → floor $4.0M, cap $30.0M
//        WNBA → floor $4.5M, cap $25.0M
//   - Rounded to nearest $0.1M.
//   - Skipped when league.dynamic_salaries is false.
//   - One row per (player_id, date, 'GAMEDAY_AUTO') — re-runs are idempotent.
//
// Writes go to player_salary_changes + players (salary, last_salary_delta,
// last_salary_change_at). Records a sync_runs row of type 'SALARY_AUTO'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
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

function yesterdayLisbon(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return fmt.format(d); // YYYY-MM-DD
}

const MAX_PCT = 0.01; // ±1% per gameday
const BOUNDS: Record<string, { floor: number; cap: number }> = {
  nba:  { floor: 4.0, cap: 30.0 },
  wnba: { floor: 4.5, cap: 25.0 },
};

function roundTenth(n: number) { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = authorize(req); if (authFail) return authFail;

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const targetDate: string = body.date ?? url.searchParams.get("date") ?? yesterdayLisbon();
  const dryRun = body.dry_run === true || url.searchParams.get("dry_run") === "1";
  const leagueArg: string = (body.league ?? url.searchParams.get("league") ?? "nba").toLowerCase();
  const leagueCodes = leagueArg === "all" ? ["nba", "wnba"] : [leagueArg];

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: run } = await sb.from("sync_runs").insert({
    type: "SALARY_AUTO", status: "RUNNING", started_at: new Date().toISOString(),
    details: { target_date: targetDate, dry_run: dryRun, leagues: leagueCodes },
  }).select("id").single();
  const runId = run?.id ?? null;

  const perLeague: Record<string, unknown> = {};
  let totalChanged = 0;

  try {
    for (const code of leagueCodes) {
      const bounds = BOUNDS[code];
      if (!bounds) { perLeague[code] = { skipped: "unknown league" }; continue; }

      const { data: league } = await sb.from("leagues")
        .select("id, dynamic_salaries")
        .eq("code", code).eq("kind", "sport").maybeSingle();
      if (!league) { perLeague[code] = { skipped: "league not found" }; continue; }
      if (league.dynamic_salaries === false) {
        perLeague[code] = { skipped: "dynamic_salaries=false" };
        continue;
      }

      const { data: logs, error: logErr } = await sb
        .from("player_game_logs")
        .select("player_id, mp, fp")
        .eq("league_id", league.id)
        .eq("game_date", targetDate)
        .gt("mp", 0);
      if (logErr) throw logErr;
      if (!logs || logs.length === 0) {
        perLeague[code] = { players_changed: 0, note: "no logs" };
        continue;
      }

      const agg = new Map<number, { fp: number; mp: number }>();
      for (const l of logs) {
        const cur = agg.get(l.player_id) ?? { fp: 0, mp: 0 };
        cur.fp += Number(l.fp) || 0;
        cur.mp += Number(l.mp) || 0;
        agg.set(l.player_id, cur);
      }

      const ids = [...agg.keys()];
      const { data: players, error: pErr } = await sb.from("players")
        .select("id, salary, fp_pg_t")
        .in("id", ids)
        .eq("league_id", league.id);
      if (pErr) throw pErr;

      const changes: Array<{
        player_id: number; old_salary: number; new_salary: number; fp_window: number;
      }> = [];

      for (const p of (players ?? [])) {
        const day = agg.get(p.id)!;
        const oldSalary = Number(p.salary) || 0;
        if (oldSalary <= 0) continue;
        const expectedFp = Math.max(8, Number(p.fp_pg_t) || 0);
        const perf = clamp((day.fp - expectedFp) / expectedFp, -0.6, 0.6);
        const pct = (perf / 0.6) * MAX_PCT;
        const rawNew = oldSalary * (1 + pct);
        const bounded = clamp(rawNew, bounds.floor, bounds.cap);
        const newSalary = roundTenth(bounded);
        if (newSalary === oldSalary) continue;
        changes.push({ player_id: p.id, old_salary: oldSalary, new_salary: newSalary, fp_window: day.fp });
      }

      if (dryRun) {
        perLeague[code] = { dry_run: true, would_change: changes.length, sample: changes.slice(0, 10) };
        continue;
      }

      if (changes.length) {
        const histRows = changes.map((c) => ({
          player_id: c.player_id, league_id: league.id,
          change_date: targetDate, old_salary: c.old_salary, new_salary: c.new_salary,
          reason: "GAMEDAY_AUTO", fp_window: c.fp_window,
        }));
        const { error: insErr } = await sb.from("player_salary_changes")
          .upsert(histRows, { onConflict: "player_id,change_date,reason" });
        if (insErr) throw insErr;

        const nowIso = new Date().toISOString();
        for (const c of changes) {
          const delta = roundTenth(c.new_salary - c.old_salary);
          await sb.from("players").update({
            salary: c.new_salary,
            last_salary_delta: delta,
            last_salary_change_at: nowIso,
            updated_at: nowIso,
          }).eq("id", c.player_id);
        }
      }

      perLeague[code] = { players_changed: changes.length };
      totalChanged += changes.length;
    }

    await sb.from("sync_runs").update({
      status: "SUCCESS", finished_at: new Date().toISOString(),
      details: { target_date: targetDate, per_league: perLeague, total_changed: totalChanged },
    }).eq("id", runId);

    return ok({ target_date: targetDate, per_league: perLeague, total_changed: totalChanged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await sb.from("sync_runs").update({
      status: "FAILED", finished_at: new Date().toISOString(),
      details: { target_date: targetDate, error: msg, per_league: perLeague },
    }).eq("id", runId);
    return err("SALARY_ADJUST_ERROR", msg, 500);
  }
});