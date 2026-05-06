import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";
import { readLeagueCodeFromBody, resolveLeagueId, type LeagueCode } from "../_shared/league.ts";

interface CSVRow {
  week: number;
  day: number;
  date: string;
  dayName: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  gameId: string;
  playerId: number;
  playerName: string;
  pts: number; // Fantasy Points
  mp: number;
  ps: number; // Points Scored
  r: number;
  a: number;
  b: number;
  s: number;
}

/** Map any variant of "Final", "Final/OT", "FINAL/OT" → "FINAL". Everything else → "SCHEDULED". */
function normalizeStatus(raw: string): "FINAL" | "SCHEDULED" {
  const s = (raw || "").trim().toUpperCase();
  return s.startsWith("FINAL") ? "FINAL" : "SCHEDULED";
}

/** Accept DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD, or null */
function normalizeDate(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const p = v.split("/");
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  return null;
}

/** Strip seconds, timezone text → HH:MM or null */
function normalizeTime(raw: string): string | null {
  let t = (raw || "").trim();
  if (!t) return null;
  // Remove timezone abbreviations and offsets
  t = t.replace(/\s*(UTC|GMT|Z|[+-]\d{1,2}(:\d{2})?)\s*/gi, "").trim();
  // If HH:MM:SS, keep HH:MM
  const m = t.match(/^(\d{1,2}:\d{2})/);
  if (!m) return null;
  const result = m[1];
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(result)) return result;
  return null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST allowed");
    }

    const body = await req.json();
    const { rows, replace } = body;
    const leagueCode: LeagueCode = readLeagueCodeFromBody(body);
    if (!rows || !Array.isArray(rows)) {
      return errorResponse("INVALID_INPUT", "rows array is required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const leagueId = await resolveLeagueId(sb, leagueCode);

    // Full replace mode: wipe player game tables for THIS LEAGUE only.
    // Cross-league data is never touched.
    if (replace) {
      await sb.from("player_last_game").delete().eq("league_id", leagueId);
      await sb.from("player_game_logs").delete().eq("league_id", leagueId);
    }

    const errors: string[] = [];
    const skippedPlayers: Array<{ id: number; name: string }> = [];

    // Get league-scoped players to validate player_ids.
    // Never import logs for a player that does not belong to the active league.
    const { data: players } = await sb
      .from("players")
      .select("id, team")
      .eq("league_id", leagueId);
    const playerMap = new Map((players || []).map((p: any) => [p.id, p.team]));

    // Group by games for schedule_games upsert
    const gamesMap = new Map<string, any>();
    const playerLogs: any[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx] as CSVRow;
      try {
        const isoDate = normalizeDate(row.date);
        const normTime = normalizeTime(row.time);
        const status = normalizeStatus(row.status);

        // Build game entry
        if (row.gameId && !gamesMap.has(row.gameId)) {
          const tipoff_utc = isoDate && normTime
            ? `${isoDate}T${normTime}:00+00:00`
            : isoDate
              ? `${isoDate}T00:00:00+00:00`
              : null;

          gamesMap.set(row.gameId, {
            game_id: row.gameId,
            gw: row.week,
            day: row.day,
            tipoff_utc,
            home_team: row.homeTeam,
            away_team: row.awayTeam,
            home_pts: row.homeScore,
            away_pts: row.awayScore,
            status,
            nba_game_url: `https://www.nba.com/game/${row.gameId}`,
            league_id: leagueId,
          });
        }

        // Validate player exists
        const playerTeam = playerMap.get(row.playerId);
        if (!playerTeam) {
          errors.push(`Row #${idx + 1}: Player ID ${row.playerId} (${row.playerName}) not found in ${leagueCode.toUpperCase()} players — skipped`);
          skippedPlayers.push({ id: row.playerId, name: row.playerName });
          continue;
        }

        // Calculate home_away and opp
        const home_away = playerTeam === row.homeTeam ? "H" : "A";
        const opp = home_away === "H" ? row.awayTeam : row.homeTeam;

        playerLogs.push({
          player_id: row.playerId,
          game_id: row.gameId,
          game_date: isoDate,
          mp: row.mp,
          pts: row.ps, // Points Scored
          reb: row.r,
          ast: row.a,
          blk: row.b,
          stl: row.s,
          fp: row.pts, // Fantasy Points from CSV
          home_away,
          opp,
          matchup: home_away === "H" ? `vs ${opp}` : `@ ${opp}`,
          nba_game_url: `https://www.nba.com/game/${row.gameId}`,
          league_id: leagueId,
        });
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
        errors.push(`Row #${idx + 1} gameId=${row.gameId}: ${msg}`);
      }
    }

    // Upsert games
    const games = Array.from(gamesMap.values());
    if (games.length > 0) {
      const { error: gamesErr } = await sb
        .from("schedule_games")
        .upsert(games, { onConflict: "game_id" });

      if (gamesErr) {
        return errorResponse("DB_ERROR", `Failed to upsert games: ${gamesErr.message}`);
      }
    }

    // Upsert player logs in batches
    let logsUpserted = 0;
    const BATCH = 100;
    for (let i = 0; i < playerLogs.length; i += BATCH) {
      const batch = playerLogs.slice(i, i + BATCH);
      const { error: logsErr } = await sb
        .from("player_game_logs")
        .upsert(batch, { onConflict: "player_id,game_id" });

      if (logsErr) {
        errors.push(`Player logs batch ${i}: ${logsErr.message}`);
      } else {
        logsUpserted += batch.length;
      }
    }

    // Update player_last_game for each player with their most recent game
    const playerIds = [...new Set(playerLogs.map((l) => l.player_id))];
    let lastGameUpdated = 0;

    for (const pid of playerIds) {
      // Get the most recent game log for this player
      const { data: latestLog, error: latestErr } = await sb
        .from("player_game_logs")
        .select("*")
        .eq("player_id", pid)
        .eq("league_id", leagueId)
        .order("game_date", { ascending: false })
        .limit(1)
        .single();

      if (latestErr || !latestLog) continue;

      // Get game info to determine result
      const { data: gameInfo } = await sb
        .from("schedule_games")
        .select("home_team, away_team, home_pts, away_pts")
        .eq("game_id", latestLog.game_id)
        .eq("league_id", leagueId)
        .single();

      let result: string | null = null;
      let hPts = 0, aPts = 0;
      if (gameInfo) {
        hPts = gameInfo.home_pts;
        aPts = gameInfo.away_pts;
        if (hPts > 0 || aPts > 0) {
          if (latestLog.home_away === "H") {
            result = hPts > aPts ? "W" : "L";
          } else {
            result = aPts > hPts ? "W" : "L";
          }
        }
      }

      const { error: lastGameErr } = await sb
        .from("player_last_game")
        .upsert({
          player_id: pid,
          game_date: latestLog.game_date,
          opp: latestLog.opp,
          home_away: latestLog.home_away,
          result,
          h_pts: hPts,
          a_pts: aPts,
          mp: latestLog.mp,
          pts: latestLog.pts,
          reb: latestLog.reb,
          ast: latestLog.ast,
          stl: latestLog.stl,
          blk: latestLog.blk,
          fp: latestLog.fp,
          nba_game_url: latestLog.nba_game_url,
          league_id: leagueId,
        }, { onConflict: "player_id" });

      if (!lastGameErr) lastGameUpdated++;
    }

    // Aggregate season + last5 fields per player (league-scoped only)
    let aggregatesUpdated = 0;
    for (const pid of playerIds) {
      const { data: logs } = await sb
        .from("player_game_logs")
        .select("mp,pts,reb,ast,stl,blk,fp,game_date")
        .eq("player_id", pid)
        .eq("league_id", leagueId)
        .order("game_date", { ascending: false });
      if (!logs || logs.length === 0) continue;

      const avg = (arr: any[], k: string) =>
        arr.length ? arr.reduce((s, r) => s + Number(r[k] || 0), 0) / arr.length : 0;

      const last5 = logs.slice(0, 5);
      const update: Record<string, number> = {
        gp: logs.length,
        mpg: avg(logs, "mp"),
        pts: avg(logs, "pts"),
        reb: avg(logs, "reb"),
        ast: avg(logs, "ast"),
        stl: avg(logs, "stl"),
        blk: avg(logs, "blk"),
        fp_pg_t: avg(logs, "fp"),
        mpg5: avg(last5, "mp"),
        pts5: avg(last5, "pts"),
        reb5: avg(last5, "reb"),
        ast5: avg(last5, "ast"),
        stl5: avg(last5, "stl"),
        blk5: avg(last5, "blk"),
        fp_pg5: avg(last5, "fp"),
      };
      const { error: aggErr } = await sb
        .from("players")
        .update(update)
        .eq("id", pid)
        .eq("league_id", leagueId);
      if (!aggErr) aggregatesUpdated++;
    }

    return okResponse({
      league_code: leagueCode,
      league_id: leagueId,
      games_imported: games.length,
      player_logs_imported: logsUpserted,
      player_last_game_updated: lastGameUpdated,
      players_aggregated: aggregatesUpdated,
      skipped_players: skippedPlayers.length > 0 ? skippedPlayers : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});
