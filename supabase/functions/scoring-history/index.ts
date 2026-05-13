import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { resolveTeam } from "../_shared/resolve-team.ts";
import {
  computeFpFromRules,
  fetchScoringRules,
  fetchLeagueScoringSystemId,
  fetchLeagueCaptainMultiplier,
} from "../_shared/scoring.ts";

const DEFAULT_LEAGUE_ID = "00000000-0000-0000-0000-000000000010";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { team_id } = await resolveTeam(req, sb);

    // Allow callers to override the fantasy league via query param. This is
    // used by the league selector on /scoring so that history is scored using
    // the selected fantasy league's scoring system.
    const url = new URL(req.url);
    const fantasyLeagueOverride = url.searchParams.get("fantasy_league_id");

    // Resolve fantasy league + scoring system for this team
    const { data: teamRow } = await sb
      .from("teams")
      .select("league_id")
      .eq("id", team_id)
      .maybeSingle();
    const fantasyLeagueId = fantasyLeagueOverride ?? (teamRow as any)?.league_id ?? DEFAULT_LEAGUE_ID;
    const systemId = await fetchLeagueScoringSystemId(sb, fantasyLeagueId);
    const scoringRules = await fetchScoringRules(sb, systemId);
    const capMult = await fetchLeagueCaptainMultiplier(sb, fantasyLeagueId, scoringRules);

    // Load chip activations for this team so All-Star bonuses can be applied.
    const { data: chipRows } = await sb
      .from("team_chips")
      .select("chip, gw, metadata")
      .eq("team_id", team_id);
    const allStarByGw = new Map<number, { player_id: number; multiplier: number }>();
    for (const c of (chipRows ?? []) as any[]) {
      if (c.chip === "all_star") {
        const meta = c.metadata ?? {};
        if (meta?.player_id) {
          allStarByGw.set(Number(c.gw), {
            player_id: Number(meta.player_id),
            multiplier: Number(meta.multiplier ?? 2),
          });
        }
      }
    }

    // 1. Pull FULL per-(gw, day) roster history for this team
    const { data: rosterRows, error: rErr } = await sb
      .from("roster")
      .select("gw, day, player_id, slot, is_captain")
      .eq("team_id", team_id);
    if (rErr) throw rErr;
    if (!rosterRows || rosterRows.length === 0) {
      return okResponse({ weeks: [], game_days: [], transactions: [] });
    }

    type DayRoster = { playerIds: Set<number>; starters: Set<number>; captainId: number | null };
    const rosterByDay = new Map<string, DayRoster>();
    const allPlayerIdSet = new Set<number>();
    for (const r of rosterRows as any[]) {
      const key = `${r.gw}.${r.day}`;
      let entry = rosterByDay.get(key);
      if (!entry) {
        entry = { playerIds: new Set(), starters: new Set(), captainId: null };
        rosterByDay.set(key, entry);
      }
      entry.playerIds.add(r.player_id);
      if (String(r.slot).toUpperCase() === "STARTER") entry.starters.add(r.player_id);
      if (r.is_captain) entry.captainId = r.player_id;
      allPlayerIdSet.add(r.player_id);
    }
    const playerIds = Array.from(allPlayerIdSet);
    // Sorted (gw, day) keys for nearest-snapshot fallback below.
    const sortedRosterKeys = Array.from(rosterByDay.keys()).sort((a, b) => {
      const [ga, da] = a.split(".").map(Number);
      const [gb, db] = b.split(".").map(Number);
      return ga - gb || da - db;
    });
    const latestKey = sortedRosterKeys[sortedRosterKeys.length - 1];
    const captainId = latestKey ? rosterByDay.get(latestKey)!.captainId : null;
    /**
     * Resolve a roster snapshot for any (gw, day) by falling back to the
     * most recent snapshot at or before that point. This lets the history
     * timeline cover the whole season even when a team only has a single
     * roster row (current gameweek) in the DB.
     */
    function resolveDayRoster(gw: number, day: number): DayRoster | undefined {
      const exact = rosterByDay.get(`${gw}.${day}`);
      if (exact) return exact;
      let best: DayRoster | undefined;
      for (const k of sortedRosterKeys) {
        const [g, d] = k.split(".").map(Number);
        if (g < gw || (g === gw && d <= day)) best = rosterByDay.get(k);
        else break;
      }
      // If the date is earlier than any known snapshot, use the earliest one.
      return best ?? (sortedRosterKeys.length ? rosterByDay.get(sortedRosterKeys[0]) : undefined);
    }

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

    // 4. Map game_date -> gw/day from schedule_games (paginated).
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
    // Build (Lisbon yyyy-mm-dd) -> { gw, day } so we can resolve dates that
    // have no matching schedule_games row (older WNBA history etc.).
    const dateToGwDay = new Map<string, { gw: number; day: number }>();
    for (const s of allSchedule as any[]) {
      if (!s.tipoff_utc) continue;
      const d = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(s.tipoff_utc));
      const cur = dateToGwDay.get(d);
      if (!cur || s.gw < cur.gw || (s.gw === cur.gw && s.day < cur.day)) {
        dateToGwDay.set(d, { gw: s.gw, day: s.day });
      }
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
      // Find gw/day from any matching game; fall back to date->gw/day map.
      let gw = 0, day = 0;
      for (const log of logs) {
        const sched = schedMap[log.game_id];
        if (sched) { gw = sched.gw; day = sched.day; break; }
      }
      if (gw === 0) {
        const fallback = dateToGwDay.get(dateStr);
        if (fallback) { gw = fallback.gw; day = fallback.day; }
      }
      if (gw === 0) continue; // truly unmappable

      const dayRoster = resolveDayRoster(gw, day);
      // Only include logs for players actually rostered on this (gw, day)
      const eligibleLogs = dayRoster
        ? logs.filter((l: any) => dayRoster.playerIds.has(l.player_id))
        : [];
      if (eligibleLogs.length === 0) continue;

      let dayCaptainBonus = 0;
      const allStar = allStarByGw.get(Number(gw));
      const players = eligibleLogs.map((log: any) => {
        const p = playerMap[log.player_id] || {};
        const sched = schedMap[log.game_id];
        const isHome = log.home_away === "H";
        let resultWL = "";
        if (sched && sched.status === "FINAL") {
          const won = isHome ? sched.home_pts > sched.away_pts : sched.away_pts > sched.home_pts;
          resultWL = won ? "W" : "L";
        }
        // Recompute FP from rules — DB-driven, ignores stale `fp` column writes.
        const baseFp = computeFpFromRules(
          { pts: Number(log.pts) || 0, reb: Number(log.reb) || 0, ast: Number(log.ast) || 0, stl: Number(log.stl) || 0, blk: Number(log.blk) || 0 },
          scoringRules
        );
        const isCap = dayRoster?.captainId === log.player_id;
        const captainBonus = isCap ? baseFp * (capMult - 1) : 0;
        const isAllStar = !!allStar && allStar.player_id === Number(log.player_id);
        const allStarBonus = isAllStar ? baseFp * (allStar!.multiplier - 1) : 0;
        const computedFp = baseFp + captainBonus + allStarBonus;
        if (isCap) dayCaptainBonus += captainBonus;
        return {
          player_id: log.player_id,
          name: p.name || "Unknown",
          team: p.team || "",
          fc_bc: p.fc_bc || "BC",
          photo: p.photo || null,
          opp: log.opp || "",
          home_away: log.home_away || "",
          result_wl: resultWL,
          fp: Math.round(computedFp * 10) / 10,
          salary: Number(p.salary) || 0,
          value: Number(p.value5) || 0,
          mp: Number(log.mp) || 0,
          pts: Number(log.pts) || 0,
          ast: Number(log.ast) || 0,
          reb: Number(log.reb) || 0,
          blk: Number(log.blk) || 0,
          stl: Number(log.stl) || 0,
          nba_game_url: log.nba_game_url || sched?.nba_game_url || null,
          is_starter: dayRoster?.starters.has(log.player_id) ?? false,
          is_captain: !!isCap,
          captain_bonus: Math.round(captainBonus * 10) / 10,
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
        captain_bonus: Math.round(dayCaptainBonus * 10) / 10,
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
      .map(([gw, data]) => {
        const gwNum = Number(gw);
        const capBonus = gameDays
          .filter((gd: any) => gd.gw === gwNum)
          .reduce((s: number, gd: any) => s + (gd.captain_bonus || 0), 0);
        return {
          gw: gwNum,
          total_fp: Math.round((data as any).total_fp * 10) / 10,
          best_player: (data as any).best,
          worst_player: (data as any).worst,
          captain_bonus: Math.round(capBonus * 10) / 10,
        };
      })
      .sort((a, b) => a.gw - b.gw);

    // 7. Get transactions for this team
    const { data: txns } = await sb
      .from("transactions")
      .select("*")
      .eq("team_id", team_id)
      .order("created_at", { ascending: true });

    // 8. Snapshot per-game-day totals (best-effort; never fail the response).
    try {
      const snapRows = gameDays.map((gd: any) => ({
        fantasy_league_id: fantasyLeagueId,
        team_id,
        gw: gd.gw,
        day: gd.day,
        game_date: gd.game_date,
        total_fp: gd.total_fp,
        captain_bonus: gd.captain_bonus ?? 0,
        chip_bonus: 0,
        player_breakdown: gd.players.map((p: any) => ({
          player_id: p.player_id,
          name: p.name,
          fp: p.fp,
          is_captain: p.is_captain,
          captain_bonus: p.captain_bonus ?? 0,
          slot: p.is_starter ? "STARTER" : "BENCH",
          pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, mp: p.mp,
        })),
        scoring_system_id: systemId,
      }));
      if (snapRows.length) {
        const { error: upErr } = await sb
          .from("scoring_daily_team_totals")
          .upsert(snapRows, { onConflict: "team_id,gw,day" });
        if (upErr) console.error("[scoring-history snapshot upsert]", upErr);
      }
    } catch (e) {
      console.error("[scoring-history snapshot]", e);
    }

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
