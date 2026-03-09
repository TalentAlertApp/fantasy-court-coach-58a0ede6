import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const gwParam = url.searchParams.get("gw");
    const dayParam = url.searchParams.get("day");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase.from("schedule_games").select("*").order("tipoff_utc", { ascending: true, nullsFirst: false });
    
    if (gwParam) query = query.eq("gw", parseInt(gwParam));
    if (dayParam) query = query.eq("day", parseInt(dayParam));

    const { data: games, error } = await query.limit(500);
    if (error) throw new Error(error.message);

    const gw = gwParam ? parseInt(gwParam) : (games?.[0]?.gw ?? 1);
    const day = dayParam ? parseInt(dayParam) : (games?.[0]?.day ?? 1);

    return new Response(JSON.stringify({
      ok: true,
      data: {
        gw,
        day,
        deadline_utc: null,
        games: (games || []).map((g: any) => ({
          game_id: g.game_id,
          gw: g.gw,
          day: g.day,
          tipoff_utc: g.tipoff_utc || null,
          away_team: g.away_team,
          home_team: g.home_team,
          away_pts: g.away_pts || 0,
          home_pts: g.home_pts || 0,
          status: g.status || "SCHEDULED",
          nba_game_url: g.nba_game_url || null,
        })),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Schedule error:", e);
    return new Response(JSON.stringify({
      ok: false, data: null,
      error: { code: "SCHEDULE_ERROR", message: e instanceof Error ? e.message : "Unknown", details: null },
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
