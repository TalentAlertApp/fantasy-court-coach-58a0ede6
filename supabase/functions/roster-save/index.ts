import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";
import { isLineupLocked } from "../_shared/deadlines.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { team_id, team_name } = await resolveTeam(req, sb);
    // Server-side deadline enforcement: block roster writes after lock.
    const lock = await isLineupLocked(sb, team_id);
    if (lock.locked) {
      return errorResponse("LINEUP_LOCKED", lock.reason ?? "Lineup is locked.", null, 403);
    }
    const body = await req.json();
    const { gw, day, starters, bench, captain_id } = body;

    // Resolve team's sport league
    const { data: teamRow } = await sb
      .from("teams").select("sport_league_id").eq("id", team_id).maybeSingle();
    const teamLeagueId = teamRow?.sport_league_id;
    if (!teamLeagueId) return errorResponse("TEAM_LEAGUE_MISSING", "Team has no sport league assigned", null, 400);

    // Validate every player belongs to this team's league
    const allPids = [...starters, ...bench].filter((id: number) => id > 0);
    if (allPids.length > 0) {
      const { data: pRows } = await sb.from("players").select("id, league_id").in("id", allPids);
      const wrong = (pRows || []).filter((p: any) => p.league_id !== teamLeagueId);
      if (wrong.length > 0) {
        return errorResponse(
          "CROSS_LEAGUE_PLAYERS",
          `Players from another league cannot be added to this roster`,
          JSON.stringify(wrong.map((w: any) => w.id)),
          400,
        );
      }
    }

    // Preserve acquired_salary for any player already on this roster — only
    // brand-new IN rows get stamped with the current market salary. This
    // matches the rule: cap accounting is locked at acquisition time.
    const playerIds = [...starters, ...bench].filter((id: number) => id > 0);
    const [existingRosterRes, playersRes] = await Promise.all([
      sb.from("roster").select("player_id, acquired_salary").eq("team_id", team_id),
      playerIds.length > 0
        ? sb.from("players").select("id, salary").in("id", playerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const existingAcquired = new Map<number, number>();
    for (const r of (existingRosterRes.data ?? []) as any[]) {
      existingAcquired.set(Number(r.player_id), Number(r.acquired_salary ?? 0));
    }
    const currentSalary = new Map<number, number>();
    for (const p of (playersRes.data ?? []) as any[]) {
      currentSalary.set(Number(p.id), Number(p.salary ?? 0));
    }
    const acquiredFor = (pid: number): number =>
      existingAcquired.has(pid)
        ? Number(existingAcquired.get(pid))
        : Number(currentSalary.get(pid) ?? 0);

    // Delete existing roster for this team and rewrite it.
    await sb.from("roster").delete().eq("team_id", team_id);

    const rows: any[] = [];
    for (const pid of starters) {
      if (pid === 0) continue;
      rows.push({ player_id: pid, slot: "STARTER", is_captain: pid === captain_id, gw, day, team_id, league_id: teamLeagueId, acquired_salary: acquiredFor(pid) });
    }
    for (const pid of bench) {
      if (pid === 0) continue;
      rows.push({ player_id: pid, slot: "BENCH", is_captain: pid === captain_id, gw, day, team_id, league_id: teamLeagueId, acquired_salary: acquiredFor(pid) });
    }

    if (rows.length > 0) {
      const { error } = await sb.from("roster").insert(rows);
      if (error) throw error;
    }

    const lockedTotal = rows.reduce((s, r) => s + Number(r.acquired_salary ?? 0), 0);
    const marketTotal = playerIds.reduce(
      (s, pid) => s + Number(currentSalary.get(pid) ?? 0),
      0,
    );

    const { data: settings } = await sb.from("team_settings").select("*").eq("team_id", team_id).maybeSingle();
    const salaryCap = settings?.salary_cap ?? 100;

    return okResponse({
      roster: {
        gw, day, deadline_utc: null,
        starters, bench,
        captain_id,
        bank_remaining: salaryCap - lockedTotal,
        locked_total: Math.round(lockedTotal * 100) / 100,
        market_total: Math.round(marketTotal * 100) / 100,
        free_transfers_remaining: 2,
        constraints: {
          salary_cap: salaryCap, starters_count: 5, bench_count: 5,
          starter_fc_min: settings?.starter_fc_min ?? 2,
          starter_bc_min: settings?.starter_bc_min ?? 2,
        },
        updated_at: new Date().toISOString(),
        team_id, team_name,
      },
      warnings: [],
    });
  } catch (e) {
    console.error("[roster-save] Error:", e);
    return errorResponse("ROSTER_SAVE_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
