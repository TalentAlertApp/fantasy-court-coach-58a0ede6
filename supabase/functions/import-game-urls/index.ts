import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mappings } = await req.json() as { mappings: { game_id: string; url: string }[] };
    if (!mappings?.length) throw new Error("No mappings provided");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let updatedSchedule = 0;
    let updatedGames = 0;

    // Process in batches of 50
    for (let i = 0; i < mappings.length; i += 50) {
      const batch = mappings.slice(i, i + 50);
      
      // Update schedule_games
      for (const { game_id, url } of batch) {
        const { error } = await supabase
          .from("schedule_games")
          .update({ nba_game_url: url })
          .eq("game_id", game_id);
        if (!error) updatedSchedule++;
      }

      // Update games table
      for (const { game_id, url } of batch) {
        const { error } = await supabase
          .from("games")
          .update({ nba_game_url: url })
          .eq("game_id", game_id);
        if (!error) updatedGames++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total: mappings.length,
      updatedSchedule,
      updatedGames,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
