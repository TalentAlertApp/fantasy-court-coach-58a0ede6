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
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "50"), 100); // max 100 per invocation

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find FINAL games without youtube_recap_id
    const { data: games, error: fetchErr } = await supabase
      .from("schedule_games")
      .select("game_id, away_team, home_team")
      .eq("status", "FINAL")
      .is("youtube_recap_id", null)
      .limit(limit);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!games || games.length === 0) {
      return new Response(JSON.stringify({
        ok: true, data: { processed: 0, found: 0, remaining: 0, message: "All games already have recaps" },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let found = 0;
    const errors: string[] = [];

    for (const game of games) {
      try {
        const query = `Motion Station ${game.away_team} vs ${game.home_team} recap`;
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;

        const ytRes = await fetch(searchUrl);
        if (!ytRes.ok) {
          const errBody = await ytRes.text();
          // If quota exceeded, stop processing
          if (ytRes.status === 403) {
            errors.push(`YouTube API quota exceeded after ${found} lookups`);
            break;
          }
          errors.push(`YouTube API error for ${game.game_id}: ${ytRes.status}`);
          continue;
        }

        const ytData = await ytRes.json();
        const videoId = ytData?.items?.[0]?.id?.videoId;

        if (videoId) {
          const { error: updateErr } = await supabase
            .from("schedule_games")
            .update({ youtube_recap_id: videoId })
            .eq("game_id", game.game_id);

          if (updateErr) {
            errors.push(`DB update failed for ${game.game_id}: ${updateErr.message}`);
          } else {
            found++;
          }
        }

        // Small delay to avoid hammering the API
        await new Promise((r) => setTimeout(r, 200));
      } catch (e: any) {
        errors.push(`Error for ${game.game_id}: ${e.message}`);
      }
    }

    // Count remaining
    const { count } = await supabase
      .from("schedule_games")
      .select("game_id", { count: "exact", head: true })
      .eq("status", "FINAL")
      .is("youtube_recap_id", null);

    return new Response(JSON.stringify({
      ok: true,
      data: { processed: games.length, found, remaining: count ?? 0, errors: errors.length ? errors : undefined },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("youtube-recap-lookup error:", e);
    return new Response(JSON.stringify({
      ok: false, data: null,
      error: { code: "YOUTUBE_LOOKUP_ERROR", message: e.message, details: null },
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
