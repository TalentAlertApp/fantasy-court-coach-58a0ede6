// Computes league-wide standings across all teams in a league.
// Uses table-driven scoring rules (scoring_systems + scoring_rules).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { computeFpFromRules, fetchScoringRules, fetchLeagueScoringSystemId, type ScoringRule } from "../_shared/scoring.ts";

const DEFAULT_LEAGUE_ID = "00000000-0000-0000-0000-000000000010";
const PAGE_SIZE = 1000;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const leagueId = url.searchParams.get("league_id") ?? DEFAULT_LEAGUE_ID;

    // 1. League + scoring rules
    const systemId = await fetchLeagueScoringSystemId(sb, leagueId);
    const rules = await fetchScoringRules(sb, systemId);

    // 2. Teams in the league (via SECURITY DEFINER fn so we get owner_label)
    const { data: teamsRaw, error: tErr } = await sb.rpc("get_league_teams", { _league_id: leagueId });
    if (tErr) throw tErr;
    const teams = (teamsRaw ?? []) as Array<{ id: string; name: string; owner_id: string; owner_label: string; created_at: string }>;
    if (teams.length === 0) {
      return okResponse({ league_id: leagueId, teams: [], summary: { total_teams: 0 } });
    }

    // 3. Pull schedule_games map (gw,day per game_id) — paginated
    let allSched: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await sb
        .from("schedule_games")
        .select("game_id, gw, day, status")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allSched = allSched.concat(data);
      if (data.length < PAGE_SIZE) break;
    }
    const schedMap: Record<string, { gw: number; day: number; status: string }> = {};
    for (const s of allSched) schedMap[s.game_id] = { gw: s.gw, day: s.day, status: s.status };

    // Latest gw / day across FINAL games
    let currentGw = 0;
    let latestKey = ""; // "gw.day"
    for (const s of allSched) {
      if (String(s.status).toUpperCase() !== "FINAL") continue;
      if (s.gw > currentGw) currentGw = s.gw;
      const k = `${s.gw}.${String(s.day).padStart(2, "0")}`;
      if (k > latestKey) latestKey = k;
    }

    // 4. All rosters for these teams (need player_id, team_id, is_captain)
    const teamIds = teams.map(t => t.id);
    const { data: rosters, error: rErr } = await sb
      .from("roster")
      .select("team_id, player_id, is_captain")
      .in("team_id", teamIds);
    if (rErr) throw rErr;

    // Build team -> [{player_id, is_captain}]
    const rosterByTeam: Record<string, Array<{ player_id: number; is_captain: boolean }>> = {};
    const allPlayerIds = new Set<number>();
    for (const r of (rosters ?? []) as any[]) {
      if (!rosterByTeam[r.team_id]) rosterByTeam[r.team_id] = [];
      rosterByTeam[r.team_id].push({ player_id: r.player_id, is_captain: !!r.is_captain });
      allPlayerIds.add(r.player_id);
    }

    if (allPlayerIds.size === 0) {
      return okResponse({
        league_id: leagueId,
        teams: teams.map((t, i) => ({
          rank: i + 1, team_id: t.id, team_name: t.name, owner_id: t.owner_id, owner_label: t.owner_label,
          total_fp: 0, current_week_fp: 0, latest_day_fp: 0, avg_fp_per_gw: 0, best_week_fp: 0, worst_week_fp: 0,
          updated_at: t.created_at,
        })),
        summary: { total_teams: teams.length },
      });
    }

    // 5. All game logs for these players — paginated
    const playerIdArr = Array.from(allPlayerIds);
    let allLogs: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await sb
        .from("player_game_logs")
        .select("player_id, game_id, pts, reb, ast, stl, blk, updated_at")
        .in("player_id", playerIdArr)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allLogs = allLogs.concat(data);
      if (data.length < PAGE_SIZE) break;
    }

    // Build player -> log[] indexed by game_id
    const logsByPlayer: Record<number, any[]> = {};
    for (const l of allLogs) {
      if (!logsByPlayer[l.player_id]) logsByPlayer[l.player_id] = [];
      logsByPlayer[l.player_id].push(l);
    }

    // 6. Compute per-team aggregates
    const teamRows = teams.map(team => {
      const ros = rosterByTeam[team.id] ?? [];
      const captainSet = new Set(ros.filter(r => r.is_captain).map(r => r.player_id));

      // Aggregate FP per (gw,day) for THIS team
      const fpByGwDay: Record<string, number> = {};
      const fpByGw: Record<number, number> = {};
      let totalFp = 0;
      let latestUpdated = team.created_at;

      for (const r of ros) {
        const logs = logsByPlayer[r.player_id] ?? [];
        for (const log of logs) {
          const sched = schedMap[log.game_id];
          if (!sched) continue;
          const baseFp = computeFpFromRules(log, rules);
          const fp = captainSet.has(log.player_id) ? baseFp * 2 : baseFp;
          totalFp += fp;
          const key = `${sched.gw}.${String(sched.day).padStart(2, "0")}`;
          fpByGwDay[key] = (fpByGwDay[key] ?? 0) + fp;
          fpByGw[sched.gw] = (fpByGw[sched.gw] ?? 0) + fp;
          if (log.updated_at && log.updated_at > latestUpdated) latestUpdated = log.updated_at;
        }
      }

      const weekValues = Object.values(fpByGw);
      const bestWeek = weekValues.length ? Math.max(...weekValues) : 0;
      const worstWeek = weekValues.length ? Math.min(...weekValues) : 0;
      const avgWeek = weekValues.length ? totalFp / weekValues.length : 0;
      const currentWeekFp = fpByGw[currentGw] ?? 0;
      const latestDayFp = fpByGwDay[latestKey] ?? 0;

      return {
        team_id: team.id,
        team_name: team.name,
        owner_id: team.owner_id,
        owner_label: team.owner_label,
        created_at: team.created_at,
        total_fp: Math.round(totalFp * 10) / 10,
        current_week_fp: Math.round(currentWeekFp * 10) / 10,
        latest_day_fp: Math.round(latestDayFp * 10) / 10,
        avg_fp_per_gw: Math.round(avgWeek * 10) / 10,
        best_week_fp: Math.round(bestWeek * 10) / 10,
        worst_week_fp: Math.round(worstWeek * 10) / 10,
        updated_at: latestUpdated,
      };
    });

    // 7. Sort + rank
    teamRows.sort((a, b) =>
      (b.total_fp - a.total_fp) ||
      (b.current_week_fp - a.current_week_fp) ||
      (b.latest_day_fp - a.latest_day_fp) ||
      (a.created_at < b.created_at ? -1 : 1)
    );
    const ranked = teamRows.map((r, i) => ({ rank: i + 1, ...r }));

    // 8. Summary
    const leader = ranked[0] ?? null;
    const bestThisWeek = [...ranked].sort((a, b) => b.current_week_fp - a.current_week_fp)[0] ?? null;
    const highestSingleWeek = [...ranked].sort((a, b) => b.best_week_fp - a.best_week_fp)[0] ?? null;

    return okResponse({
      league_id: leagueId,
      current_gw: currentGw,
      teams: ranked,
      summary: {
        total_teams: ranked.length,
        league_leader: leader ? { team_name: leader.team_name, owner_label: leader.owner_label, total_fp: leader.total_fp } : null,
        best_this_week: bestThisWeek ? { team_name: bestThisWeek.team_name, owner_label: bestThisWeek.owner_label, current_week_fp: bestThisWeek.current_week_fp } : null,
        highest_single_week: highestSingleWeek ? { team_name: highestSingleWeek.team_name, owner_label: highestSingleWeek.owner_label, best_week_fp: highestSingleWeek.best_week_fp } : null,
      },
    });
  } catch (err: any) {
    console.error("[league-standings]", err);
    return errorResponse("LEAGUE_STANDINGS_ERROR", err.message || "Unknown error", null, 500);
  }
});
