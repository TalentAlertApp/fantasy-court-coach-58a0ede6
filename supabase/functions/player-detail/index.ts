import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const playerId = Number(url.searchParams.get("id"));
    if (!playerId) {
      return errorResponse("MISSING_PARAM", "id query param required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get player core data
    const { data: playerRow, error: playerErr } = await sb
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (playerErr || !playerRow) {
      return errorResponse("NOT_FOUND", `Player ${playerId} not found`, null, 404);
    }

    // Get player's last game
    const { data: lastGameRow } = await sb
      .from("player_last_game")
      .select("*")
      .eq("player_id", playerId)
      .single();

    // Get player history (game logs, most recent first, limit 20)
    const { data: historyRows } = await sb
      .from("player_game_logs")
      .select("*")
      .eq("player_id", playerId)
      .order("game_date", { ascending: false })
      .limit(20);

    // Get upcoming games for player's team
    const { data: upcomingRows } = await sb
      .from("schedule_games")
      .select("*")
      .eq("status", "SCHEDULED")
      .or(`home_team.eq.${playerRow.team},away_team.eq.${playerRow.team}`)
      .order("tipoff_utc", { ascending: true })
      .limit(5);

    // Build player object matching the expected contract
    const player = {
      core: {
        id: playerRow.id,
        name: playerRow.name,
        team: playerRow.team,
        fc_bc: playerRow.fc_bc,
        photo: playerRow.photo,
        salary: playerRow.salary,
        jersey: playerRow.jersey,
        pos: playerRow.pos,
        height: playerRow.height,
        weight: playerRow.weight,
        age: playerRow.age,
        dob: playerRow.dob,
        exp: playerRow.exp,
        college: playerRow.college,
      },
      season: {
        gp: playerRow.gp,
        mpg: playerRow.mpg,
        pts: playerRow.pts,
        reb: playerRow.reb,
        ast: playerRow.ast,
        stl: playerRow.stl,
        blk: playerRow.blk,
        fp: playerRow.fp_pg_t,
      },
      last5: {
        mpg5: playerRow.mpg5,
        pts5: playerRow.pts5,
        reb5: playerRow.reb5,
        ast5: playerRow.ast5,
        stl5: playerRow.stl5,
        blk5: playerRow.blk5,
        fp5: playerRow.fp_pg5,
      },
      lastGame: lastGameRow ? {
        date: lastGameRow.game_date,
        opp: lastGameRow.opp,
        home_away: lastGameRow.home_away,
        result: lastGameRow.result,
        a_pts: lastGameRow.a_pts,
        h_pts: lastGameRow.h_pts,
        mp: lastGameRow.mp,
        pts: lastGameRow.pts,
        reb: lastGameRow.reb,
        ast: lastGameRow.ast,
        stl: lastGameRow.stl,
        blk: lastGameRow.blk,
        fp: lastGameRow.fp,
        nba_game_url: lastGameRow.nba_game_url,
      } : {
        date: null, opp: null, home_away: null, result: null,
        a_pts: 0, h_pts: 0, mp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fp: 0,
        nba_game_url: null,
      },
      computed: {
        value: playerRow.value_t,
        value5: playerRow.value5,
        stocks: playerRow.stocks,
        stocks5: playerRow.stocks5,
        delta_mpg: playerRow.delta_mpg,
        delta_fp: playerRow.delta_fp,
      },
      flags: {
        injury: playerRow.injury,
        note: playerRow.note,
      },
    };

    // Map history rows
    const history = (historyRows || []).map((h) => ({
      date: h.game_date,
      opp: h.opp || "",
      home_away: h.home_away || "H",
      mp: h.mp,
      pts: h.pts,
      reb: h.reb,
      ast: h.ast,
      stl: h.stl,
      blk: h.blk,
      fp: h.fp,
      nba_game_url: h.nba_game_url,
    }));

    // Map upcoming games
    const upcoming = (upcomingRows || []).map((u) => ({
      game_id: u.game_id,
      tipoff_utc: u.tipoff_utc,
      away_team: u.away_team,
      home_team: u.home_team,
      status: u.status,
    }));

    return okResponse({ player, history, upcoming });
  } catch (e) {
    console.error("Player detail error:", e);
    return errorResponse("PLAYER_DETAIL_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
