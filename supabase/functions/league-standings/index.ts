// Computes league-wide standings across all teams in a league.
// Uses table-driven scoring rules (scoring_systems + scoring_rules).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { computeFpFromRules, fetchScoringRules, fetchLeagueScoringSystemId, fetchLeagueCaptainMultiplier, type ScoringRule } from "../_shared/scoring.ts";

const DEFAULT_LEAGUE_ID = "00000000-0000-0000-0000-000000000010";
const MAIN_LEAGUE_NBA_ID = "00000000-0000-0000-0000-000000000010";
const MAIN_LEAGUE_WNBA_ID = "00000000-0000-0000-0000-000000000020";
const MAIN_LEAGUE_IDS = new Set([MAIN_LEAGUE_NBA_ID, MAIN_LEAGUE_WNBA_ID]);
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
    let sportLeagueId = url.searchParams.get("sport_league_id");

    // Server-side resolution: if no sport_league_id was passed, derive it from
    // the fantasy league's `sport` column → look up the matching kind='sport' row.
    if (!sportLeagueId) {
      const { data: flRow } = await sb
        .from("leagues")
        .select("sport")
        .eq("id", leagueId)
        .maybeSingle();
      const sportCode = (flRow as any)?.sport;
      if (sportCode) {
        const { data: sportRow } = await sb
          .from("leagues")
          .select("id")
          .eq("kind", "sport")
          .eq("code", sportCode)
          .maybeSingle();
        if (sportRow?.id) sportLeagueId = sportRow.id as string;
      }
    }

    // 1. League + scoring rules
    const systemId = await fetchLeagueScoringSystemId(sb, leagueId);
    const rules = await fetchScoringRules(sb, systemId);

    // 2. Teams in the league (via SECURITY DEFINER fn so we get owner_label)
    let teams: Array<{ id: string; name: string; owner_id: string; owner_label: string; created_at: string }> = [];
    if (MAIN_LEAGUE_IDS.has(leagueId) && sportLeagueId) {
      // Main Leagues: select all teams attached to the matching sport, regardless
      // of which Main League pseudo-id is stored on teams.league_id.
      const { data: tRows, error: tErr } = await sb
        .from("teams")
        .select("id, name, owner_id, created_at")
        .eq("sport_league_id", sportLeagueId);
      if (tErr) throw tErr;
      const ownerIds = Array.from(new Set((tRows ?? []).map((r: any) => r.owner_id).filter(Boolean)));
      const labels = new Map<string, string>();
      if (ownerIds.length > 0) {
        const { data: users } = await (sb as any).auth.admin.listUsers({ perPage: 1000 });
        for (const u of (users?.users ?? [])) {
          if (ownerIds.includes(u.id)) {
            const email = (u.email ?? "user") as string;
            labels.set(u.id, email.split("@")[0] || "user");
          }
        }
      }
      teams = (tRows ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        owner_id: r.owner_id,
        owner_label: labels.get(r.owner_id) ?? "user",
        created_at: r.created_at,
      }));
    } else {
      const { data: teamsRaw, error: tErr } = await sb.rpc("get_league_teams", { _league_id: leagueId });
      if (tErr) throw tErr;
      teams = (teamsRaw ?? []) as typeof teams;
      // If a sport_league_id is provided, restrict standings to teams attached
      // to that sport (NBA vs WNBA) — the fantasy league_id is shared across
      // sports so we filter via the teams.sport_league_id column.
      if (sportLeagueId) {
        const teamIds = teams.map((t) => t.id);
        if (teamIds.length > 0) {
          const { data: tRows } = await sb
            .from("teams")
            .select("id, sport_league_id")
            .in("id", teamIds);
          const allowed = new Set(
            (tRows ?? [])
              .filter((r: any) => r.sport_league_id === sportLeagueId)
              .map((r: any) => r.id),
          );
          teams = teams.filter((t) => allowed.has(t.id));
        }
      }
    }
    if (teams.length === 0) {
      return okResponse({ league_id: leagueId, teams: [], summary: { total_teams: 0 } });
    }

    // 3. Pull schedule_games map (gw,day per game_id) — paginated
    let allSched: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let q = sb
        .from("schedule_games")
        .select("game_id, gw, day, status")
        .range(offset, offset + PAGE_SIZE - 1);
      if (sportLeagueId) q = q.eq("league_id", sportLeagueId);
      const { data, error } = await q;
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
      .select("team_id, gw, day, player_id, is_captain")
      .in("team_id", teamIds);
    if (rErr) throw rErr;

    // Build team -> Map<"gw.day", {playerIds, captainId}> + per-team union of player ids
    type DayEntry = { playerIds: Set<number>; captainId: number | null };
    const rosterByTeamDay: Record<string, Map<string, DayEntry>> = {};
    const playerIdsByTeam: Record<string, Set<number>> = {};
    const allPlayerIds = new Set<number>();
    for (const r of (rosters ?? []) as any[]) {
      const map = (rosterByTeamDay[r.team_id] ??= new Map());
      const key = `${r.gw}.${r.day}`;
      let entry = map.get(key);
      if (!entry) { entry = { playerIds: new Set(), captainId: null }; map.set(key, entry); }
      entry.playerIds.add(r.player_id);
      if (r.is_captain) entry.captainId = r.player_id;
      (playerIdsByTeam[r.team_id] ??= new Set()).add(r.player_id);
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
      let q = sb
        .from("player_game_logs")
        .select("player_id, game_id, pts, reb, ast, stl, blk, updated_at")
        .in("player_id", playerIdArr)
        .range(offset, offset + PAGE_SIZE - 1);
      if (sportLeagueId) q = q.eq("league_id", sportLeagueId);
      const { data, error } = await q;
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

    // 5b. Snapshot fast-path: load any pre-computed totals
    const { data: snapRows } = await sb
      .from("scoring_daily_team_totals")
      .select("team_id, gw, day, total_fp, calculated_at")
      .in("team_id", teamIds)
      .eq("fantasy_league_id", leagueId);
    const snapByTeam = new Map<string, Array<{ gw: number; day: number; total_fp: number; calculated_at: string }>>();
    for (const s of (snapRows ?? []) as any[]) {
      const arr = snapByTeam.get(s.team_id) ?? [];
      arr.push({ gw: s.gw, day: s.day, total_fp: Number(s.total_fp), calculated_at: s.calculated_at });
      snapByTeam.set(s.team_id, arr);
    }
    const capMult = await fetchLeagueCaptainMultiplier(sb, leagueId, rules);

    // 6. Compute per-team aggregates
    const teamRows = teams.map(team => {
      // Snapshot fast-path
      const snaps = snapByTeam.get(team.id);
      if (snaps && snaps.length) {
        const fpByGw: Record<number, number> = {};
        const fpByGwDay: Record<string, number> = {};
        let totalFp = 0;
        let latestUpdated = team.created_at;
        for (const s of snaps) {
          totalFp += s.total_fp;
          fpByGw[s.gw] = (fpByGw[s.gw] ?? 0) + s.total_fp;
          const key = `${s.gw}.${String(s.day).padStart(2, "0")}`;
          fpByGwDay[key] = (fpByGwDay[key] ?? 0) + s.total_fp;
          if (s.calculated_at && s.calculated_at > latestUpdated) latestUpdated = s.calculated_at;
        }
        const weekValues = Object.values(fpByGw);
        const bestWeek = weekValues.length ? Math.max(...weekValues) : 0;
        const worstWeek = weekValues.length ? Math.min(...weekValues) : 0;
        const avgWeek = weekValues.length ? totalFp / weekValues.length : 0;
        return {
          team_id: team.id,
          team_name: team.name,
          owner_id: team.owner_id,
          owner_label: team.owner_label,
          created_at: team.created_at,
          total_fp: Math.round(totalFp * 10) / 10,
          current_week_fp: Math.round((fpByGw[currentGw] ?? 0) * 10) / 10,
          latest_day_fp: Math.round((fpByGwDay[latestKey] ?? 0) * 10) / 10,
          avg_fp_per_gw: Math.round(avgWeek * 10) / 10,
          best_week_fp: Math.round(bestWeek * 10) / 10,
          worst_week_fp: Math.round(worstWeek * 10) / 10,
          updated_at: latestUpdated,
        };
      }

      // Live path with per-(gw, day) captain
      const dayMap = rosterByTeamDay[team.id] ?? new Map<string, DayEntry>();
      const playerSet = playerIdsByTeam[team.id] ?? new Set<number>();

      const fpByGwDay: Record<string, number> = {};
      const fpByGw: Record<number, number> = {};
      let totalFp = 0;
      let latestUpdated = team.created_at;

      for (const playerId of playerSet) {
        const logs = logsByPlayer[playerId] ?? [];
        for (const log of logs) {
          const sched = schedMap[log.game_id];
          if (!sched) continue;
          const dayKey = `${sched.gw}.${sched.day}`;
          const dayEntry = dayMap.get(dayKey);
          if (!dayEntry || !dayEntry.playerIds.has(playerId)) continue;
          const baseFp = computeFpFromRules(log, rules);
          const fp = dayEntry.captainId === playerId ? baseFp * capMult : baseFp;
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
