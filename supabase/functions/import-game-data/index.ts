import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST allowed");
    }

    const { rows } = await req.json();
    if (!rows || !Array.isArray(rows)) {
      return errorResponse("INVALID_INPUT", "rows array is required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const errors: string[] = [];
    
    // Get all players to validate player_ids
    const { data: players } = await sb.from("players").select("id, team");
    const playerMap = new Map((players || []).map((p: any) => [p.id, p.team]));

    // Group by games for schedule_games upsert
    const gamesMap = new Map<string, any>();
    const playerLogs: any[] = [];

    for (const row of rows as CSVRow[]) {
      // Build game entry
      if (!gamesMap.has(row.gameId)) {
        // Parse date: handle DD/MM/YYYY or YYYY-MM-DD
        const dateParts = row.date.includes("/") ? row.date.split("/") : null;
        const isoDate = dateParts
          ? `${dateParts[2]}-${dateParts[1].padStart(2,"0")}-${dateParts[0].padStart(2,"0")}`
          : row.date;

        gamesMap.set(row.gameId, {
          game_id: row.gameId,
          gw: row.week,
          day: row.day,
          tipoff_utc: `${isoDate}T${row.time || "00:00"}:00+00:00`,
          home_team: row.homeTeam,
          away_team: row.awayTeam,
          home_pts: row.homeScore,
          away_pts: row.awayScore,
          status: row.status.toUpperCase() === "FINAL" ? "FINAL" : row.status.toUpperCase(),
          nba_game_url: `https://www.nba.com/game/${row.gameId}`,
        });
      }

      // Validate player exists
      const playerTeam = playerMap.get(row.playerId);
      if (!playerTeam) {
        errors.push(`Player ID ${row.playerId} (${row.playerName}) not found in database`);
        continue;
      }

      // Calculate home_away and opp
      const home_away = playerTeam === row.homeTeam ? "H" : "A";
      const opp = home_away === "H" ? row.awayTeam : row.homeTeam;

      // Build player log entry
      playerLogs.push({
        player_id: row.playerId,
        game_id: row.gameId,
        game_date: row.date,
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
      });
    }

    // Upsert games
    const games = Array.from(gamesMap.values());
    const { error: gamesErr } = await sb
      .from("schedule_games")
      .upsert(games, { onConflict: "game_id" });

    if (gamesErr) {
      return errorResponse("DB_ERROR", `Failed to upsert games: ${gamesErr.message}`);
    }

    // Upsert player logs
    const { error: logsErr } = await sb
      .from("player_game_logs")
      .upsert(playerLogs, { onConflict: "player_id,game_id" });

    if (logsErr) {
      return errorResponse("DB_ERROR", `Failed to upsert player logs: ${logsErr.message}`);
    }

    return okResponse({
      games_imported: games.length,
      player_logs_imported: playerLogs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return errorResponse("INTERNAL", e.message, null, 500);
  }
});
