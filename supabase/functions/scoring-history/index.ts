import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { resolveTeam } from "../_shared/resolve-team.ts";
import { computeFpFromRules, fetchScoringRules } from "../_shared/scoring.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { team_id } = await resolveTeam(req, sb);

    // Load scoring rules from DB (single source of truth).
    const scoringRules = await fetchScoringRules(sb);

    // 1. Get current roster player IDs
    const { data: rosterRows, error: rErr } = await sb
      .from("roster")
      .select("player_id, slot, is_captain")
      .eq("team_id", team_id);
    if (rErr) throw rErr;
    if (!rosterRows || rosterRows.length === 0) {
      return okResponse({ weeks: [], game_days: [], transactions: [] });
    }

    const playerIds = (rosterRows as any[]).map((r: any) => r.player_id);
    const starterSlots = new Set(
      (rosterRows as any[]).filter((r: any) => String(r.slot).toUpperCase() === "STARTER").map((r: any) => r.player_id)
    );
    const captainId = (rosterRows as any[]).find((r: any) => r.is_captain)?.player_id ?? null;

    // 2. Get player info
    const { data: playersData } = await sb
      .from("players")
      .select("id, name, team, fc_bc, photo, salary, value5, fp_pg5")
      .in("id", playerIds);
    const playerMap: Record<number, any> = {};
    for (const p of (playersData ?? []) as any[]) {
      playerMap[p.id] = p;
    }

    // 3. Fetch all game logs for these players (paginated to avoid 1000-row limit)
    let allLogs: any[] = [];
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: logs, error: lErr } = await sb
        .from("player_game_logs")
        .select("player_id, game_date, opp, home_away, fp, mp, pts, reb, ast, blk, stl, nba_game_url, game_id")
        .in("player_id", playerIds)
        .order("game_date", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (lErr) throw lErr;
      if (!logs || logs.length === 0) break;
      allLogs = allLogs.concat(logs);
      if (logs.length < PAGE_SIZE) break;
    }

    // 4. Map game_date -> gw/day from schedule_games
    // Get all unique game_dates from logs
    const uniqueDates = [...new Set(allLogs.map((l: any) => l.game_date).filter(Boolean))];
    
    // Fetch schedule mappings (paginated)
    let allSchedule: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: sched } = await sb
        .from("schedule_games")
        .select("game_id, gw, day, tipoff_utc, home_team, away_team, home_pts, away_pts, status, nba_game_url")
        .order("gw", { ascending: true })
        .order("day", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (!sched || sched.length === 0) break;
      allSchedule = allSchedule.concat(sched);
      if (sched.length < PAGE_SIZE) break;
    }

    // Build game_id -> schedule info
    const schedMap: Record<string, any> = {};
    for (const s of allSchedule as any[]) {
      schedMap[s.game_id] = s;
    }

    // 5. Build game day data
    // Group logs by game_date
    const logsByDate: Record<string, any[]> = {};
    for (const log of allLogs as any[]) {
      const d = log.game_date;
      if (!d) continue;
      if (!logsByDate[d]) logsByDate[d] = [];
      logsByDate[d].push(log);
    }

    // Determine gw/day for each game_date via schedule
    const gameDays: any[] = [];
    const gwDayFpMap: Record<string, number> = {};

    for (const [dateStr, logs] of Object.entries(logsByDate)) {
      // Find gw/day from any matching game
      let gw = 0, day = 0;
      for (const log of logs) {
        const sched = schedMap[log.game_id];
        if (sched) {
          gw = sched.gw;
          day = sched.day;
          break;
        }
      }
      if (gw === 0) continue; // skip if can't map

      const players = logs.map((log: any) => {
        const p = playerMap[log.player_id] || {};
        const sched = schedMap[log.game_id];
        const isHome = log.home_away === "H";
        let resultWL = "";
        if (sched && sched.status === "FINAL") {
          const won = isHome ? sched.home_pts > sched.away_pts : sched.away_pts > sched.home_pts;
          resultWL = won ? "W" : "L";
        }
        return {
          player_id: log.player_id,
          name: p.name || "Unknown",
          team: p.team || "",
          fc_bc: p.fc_bc || "BC",
          photo: p.photo || null,
          opp: log.opp || "",
          home_away: log.home_away || "",
          result_wl: resultWL,
          fp: Number(log.fp) || 0,
          salary: Number(p.salary) || 0,
          value: Number(p.value5) || 0,
          mp: Number(log.mp) || 0,
          pts: Number(log.pts) || 0,
          ast: Number(log.ast) || 0,
          reb: Number(log.reb) || 0,
          blk: Number(log.blk) || 0,
          stl: Number(log.stl) || 0,
          nba_game_url: log.nba_game_url || sched?.nba_game_url || null,
          is_starter: starterSlots.has(log.player_id),
        };
      });

      const totalFp = players.reduce((s: number, pl: any) => s + pl.fp, 0);
      const key = `${gw}.${day}`;
      gwDayFpMap[key] = (gwDayFpMap[key] || 0) + totalFp;

      gameDays.push({
        gw,
        day,
        game_date: dateStr,
        total_fp: Math.round(totalFp * 10) / 10,
        players,
      });
    }

    // Sort by gw then day
    gameDays.sort((a: any, b: any) => a.gw - b.gw || a.day - b.day);

    // 6. Build weekly aggregates
    const weekMap: Record<number, { total_fp: number; best: any; worst: any }> = {};
    for (const gd of gameDays) {
      if (!weekMap[gd.gw]) weekMap[gd.gw] = { total_fp: 0, best: null, worst: null };
      weekMap[gd.gw].total_fp += gd.total_fp;
      for (const p of gd.players) {
        if (!weekMap[gd.gw].best || p.fp > weekMap[gd.gw].best.fp) {
          weekMap[gd.gw].best = { name: p.name, fp: p.fp, player_id: p.player_id, photo: p.photo ?? null };
        }
        if (!weekMap[gd.gw].worst || p.fp < weekMap[gd.gw].worst.fp) {
          weekMap[gd.gw].worst = { name: p.name, fp: p.fp, player_id: p.player_id, photo: p.photo ?? null };
        }
      }
    }

    const weeks = Object.entries(weekMap)
      .map(([gw, data]) => ({
        gw: Number(gw),
        total_fp: Math.round((data as any).total_fp * 10) / 10,
        best_player: (data as any).best,
        worst_player: (data as any).worst,
        captain_bonus: 0,
      }))
      .sort((a, b) => a.gw - b.gw);

    // 7. Get transactions for this team
    const { data: txns } = await sb
      .from("transactions")
      .select("*")
      .eq("team_id", team_id)
      .order("created_at", { ascending: true });

    return okResponse({
      weeks,
      game_days: gameDays,
      transactions: txns ?? [],
      captain_id: captainId,
    });
  } catch (err: any) {
    return errorResponse("SCORING_ERROR", err.message || "Unknown error", null, 500);
  }
});
