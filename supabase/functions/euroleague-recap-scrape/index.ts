import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

const EUROLEAGUE_LEAGUE_ID = "00000000-0000-0000-0000-000000000003";

/**
 * Scrape YouTube recap IDs directly from the official Euroleague.net
 * highlights page stored on `schedule_games.game_recap_url`.
 *
 * The official page embeds the same YouTube clip that we want to surface in
 * the GameDetailModal, so we just GET the URL and extract the 11-char video
 * id from any iframe / link / JSON-LD `embedUrl` in the markup.
 *
 * Scope: EuroLeague only, only games with a recap URL and no youtube_recap_id.
 */

const YT_PATTERNS: RegExp[] = [
  /youtube\.com\/watch\?[^"'\s<>]*v=([A-Za-z0-9_-]{11})/g,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/g,
  /youtu\.be\/([A-Za-z0-9_-]{11})/g,
  /youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/g,
  /"embedUrl"\s*:\s*"[^"]*\/embed\/([A-Za-z0-9_-]{11})/g,
];

function extractYouTubeId(html: string): string | null {
  for (const re of YT_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(html);
    if (m && m[1]) return m[1];
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; HoopsFantasyBot/1.0; +https://hoopsfantasy.app)",
        "accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const url = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "200")));
    const targetGameId = url.searchParams.get("game_id");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let q = supabase
      .from("schedule_games")
      .select("game_id, game_recap_url, youtube_recap_id, away_team, home_team")
      .eq("league_id", EUROLEAGUE_LEAGUE_ID)
      .not("game_recap_url", "is", null)
      .is("youtube_recap_id", null)
      .limit(limit);
    if (targetGameId) q = supabase
      .from("schedule_games")
      .select("game_id, game_recap_url, youtube_recap_id, away_team, home_team")
      .eq("league_id", EUROLEAGUE_LEAGUE_ID)
      .eq("game_id", targetGameId);

    const { data: games, error } = await q;
    if (error) return errorResponse("DB_ERROR", error.message, null, 500);

    let processed = 0;
    let found = 0;
    const errors: string[] = [];
    const matches: Array<{ game_id: string; youtube_id: string }> = [];

    for (const g of games ?? []) {
      processed++;
      const recapUrl = (g as any).game_recap_url as string | null;
      if (!recapUrl) continue;
      const html = await fetchHtml(recapUrl);
      if (!html) {
        errors.push(`fetch failed: ${g.game_id}`);
        continue;
      }
      const ytId = extractYouTubeId(html);
      if (!ytId) continue;

      const { error: upErr } = await supabase
        .from("schedule_games")
        .update({ youtube_recap_id: ytId })
        .eq("game_id", g.game_id)
        .eq("league_id", EUROLEAGUE_LEAGUE_ID);
      if (upErr) {
        errors.push(`update failed ${g.game_id}: ${upErr.message}`);
        continue;
      }
      found++;
      matches.push({ game_id: g.game_id, youtube_id: ytId });
    }

    const { count: remaining } = await supabase
      .from("schedule_games")
      .select("game_id", { count: "exact", head: true })
      .eq("league_id", EUROLEAGUE_LEAGUE_ID)
      .not("game_recap_url", "is", null)
      .is("youtube_recap_id", null);

    return okResponse({
      processed,
      found,
      remaining: remaining ?? null,
      errors,
      matches: matches.slice(0, 25),
    });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});