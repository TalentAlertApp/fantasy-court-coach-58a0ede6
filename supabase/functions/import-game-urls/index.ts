import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate URLs from existing schedule_games data
    const { data: schedGames, error: e1 } = await supabase
      .from("schedule_games")
      .select("game_id, away_team, home_team")
      .is("nba_game_url", null);
    if (e1) throw e1;

    console.log(`Found ${schedGames?.length ?? 0} schedule_games without URL`);

    let scheduleUpdated = 0;
    for (const g of schedGames ?? []) {
      const url = `https://www.nba.com/game/${g.away_team.toLowerCase()}-vs-${g.home_team.toLowerCase()}-00${g.game_id}`;
      const { error } = await supabase
        .from("schedule_games")
        .update({ nba_game_url: url })
        .eq("game_id", g.game_id);
      if (!error) scheduleUpdated++;
    }

    // Same for games table
    const { data: gameRows, error: e2 } = await supabase
      .from("games")
      .select("game_id, away_team, home_team")
      .is("nba_game_url", null);
    if (e2) throw e2;

    console.log(`Found ${gameRows?.length ?? 0} games without URL`);

    let gamesUpdated = 0;
    for (const g of gameRows ?? []) {
      if (!g.away_team || !g.home_team) continue;
      const url = `https://www.nba.com/game/${g.away_team.toLowerCase()}-vs-${g.home_team.toLowerCase()}-00${g.game_id}`;
      const { error } = await supabase
        .from("games")
        .update({ nba_game_url: url })
        .eq("game_id", g.game_id);
      if (!error) gamesUpdated++;
    }

    return new Response(JSON.stringify({
      ok: true,
      schedule_updated: scheduleUpdated,
      games_updated: gamesUpdated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Import error:", e);
    return new Response(JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
