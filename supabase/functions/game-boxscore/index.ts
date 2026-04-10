import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("game_id");
    if (!gameId) return errorResponse("MISSING_PARAM", "game_id is required");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all player game logs for this game_id
    const { data: logs, error: logsErr } = await sb
      .from("player_game_logs")
      .select("player_id, mp, pts, reb, ast, blk, stl, fp, home_away")
      .eq("game_id", gameId)
      .order("fp", { ascending: false });

    if (logsErr) return errorResponse("DB_ERROR", logsErr.message);
    if (!logs || logs.length === 0) {
      return okResponse({ game_id: gameId, players: [] });
    }

    // Get player info for all player_ids
    const playerIds = logs.map((l: any) => l.player_id);
    const { data: players, error: pErr } = await sb
      .from("players")
      .select("id, name, fc_bc, photo, team")
      .in("id", playerIds);

    if (pErr) return errorResponse("DB_ERROR", pErr.message);

    const playerMap = new Map((players || []).map((p: any) => [p.id, p]));

    const result = logs.map((l: any) => {
      const p = playerMap.get(l.player_id) || { name: "Unknown", fc_bc: "FC", photo: null, team: "???" };
      return {
        player_id: l.player_id,
        name: p.name,
        team: p.team,
        fc_bc: p.fc_bc,
        photo: p.photo,
        mp: l.mp,
        ps: l.pts,  // points scored
        fp: Number(l.fp), // fantasy points (PTS in our system)
        reb: l.reb,
        ast: l.ast,
        blk: l.blk,
        stl: l.stl,
        home_away: l.home_away,
      };
    });

    return okResponse({ game_id: gameId, players: result });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});
