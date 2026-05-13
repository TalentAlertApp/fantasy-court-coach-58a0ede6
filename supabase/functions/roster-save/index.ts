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

    // Delete existing roster for this team (already team-scoped; team is league-scoped)
    await sb.from("roster").delete().eq("team_id", team_id);

    // Insert new rows
    const rows: any[] = [];
    for (const pid of starters) {
      if (pid === 0) continue;
      rows.push({ player_id: pid, slot: "STARTER", is_captain: pid === captain_id, gw, day, team_id, league_id: teamLeagueId });
    }
    for (const pid of bench) {
      if (pid === 0) continue;
      rows.push({ player_id: pid, slot: "BENCH", is_captain: pid === captain_id, gw, day, team_id, league_id: teamLeagueId });
    }

    if (rows.length > 0) {
      const { error } = await sb.from("roster").insert(rows);
      if (error) throw error;
    }

    // Compute bank
    const playerIds = [...starters, ...bench].filter((id: number) => id > 0);
    let salaryUsed = 0;
    if (playerIds.length > 0) {
      const { data: players } = await sb.from("players").select("id, salary").in("id", playerIds);
      if (players) salaryUsed = players.reduce((s: number, p: any) => s + (p.salary || 0), 0);
    }

    const { data: settings } = await sb.from("team_settings").select("*").eq("team_id", team_id).maybeSingle();
    const salaryCap = settings?.salary_cap ?? 100;

    return okResponse({
      roster: {
        gw, day, deadline_utc: null,
        starters, bench,
        captain_id,
        bank_remaining: salaryCap - salaryUsed,
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
