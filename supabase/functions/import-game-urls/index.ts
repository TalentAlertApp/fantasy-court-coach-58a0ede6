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

    // Process all updates in parallel
    const results = await Promise.allSettled(
      mappings.flatMap(({ game_id, url }) => [
        supabase.from("schedule_games").update({ nba_game_url: url }).eq("game_id", game_id),
        supabase.from("games").update({ nba_game_url: url }).eq("game_id", game_id),
      ])
    );

    const ok = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return new Response(JSON.stringify({
      ok: true,
      total: mappings.length,
      updatedOps: ok,
      failedOps: failed,
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
