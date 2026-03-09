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

    // Expect CSV content as POST body
    const csvText = await req.text();
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

    // Batch update schedule_games
    let scheduleUpdated = 0;
    let gamesUpdated = 0;

    // Process in batches of 50
    for (let i = 0; i < mappings.length; i += 50) {
      const batch = mappings.slice(i, i + 50);
      
      for (const m of batch) {
        const { error: e1 } = await supabase
          .from("schedule_games")
          .update({ nba_game_url: m.url })
          .eq("game_id", m.game_id);
        if (!e1) scheduleUpdated++;

        const { error: e2 } = await supabase
          .from("games")
          .update({ nba_game_url: m.url })
          .eq("game_id", m.game_id);
        if (!e2) gamesUpdated++;
      }
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
