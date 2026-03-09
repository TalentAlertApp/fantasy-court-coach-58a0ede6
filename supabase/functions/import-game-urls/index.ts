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

    // Fetch CSV from the preview URL
    const csvUrl = "https://id-preview--ba61aa54-c833-4760-9f99-8588f60e9a36.lovable.app/data/NBA_fantasy_API_-_GameURL.csv";
    const resp = await fetch(csvUrl);
    if (!resp.ok) throw new Error(`Failed to fetch CSV: ${resp.status}`);
    const csvText = await resp.text();
    
    const lines = csvText.trim().split("\n");
    
    // Parse CSV: game_id,url
    const mappings: { game_id: string; url: string }[] = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const game_id = parts[0].trim();
      const url = parts.slice(1).join(",").trim();
      if (!game_id || !url || game_id === "Game ID") continue;
      mappings.push({ game_id, url });
    }

    console.log(`Parsed ${mappings.length} game URL mappings`);

    // Batch update schedule_games and games
    let scheduleUpdated = 0;
    let gamesUpdated = 0;

    for (const m of mappings) {
      const { data: d1 } = await supabase
        .from("schedule_games")
        .update({ nba_game_url: m.url })
        .eq("game_id", m.game_id)
        .select("game_id");
      if (d1 && d1.length > 0) scheduleUpdated++;

      const { data: d2 } = await supabase
        .from("games")
        .update({ nba_game_url: m.url })
        .eq("game_id", m.game_id)
        .select("game_id");
      if (d2 && d2.length > 0) gamesUpdated++;
    }

    return new Response(JSON.stringify({
      ok: true,
      total_parsed: mappings.length,
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
