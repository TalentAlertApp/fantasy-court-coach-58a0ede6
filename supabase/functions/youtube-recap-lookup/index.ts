import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEAM_FULL_NAME: Record<string, string> = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets", CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers", DAL: "Dallas Mavericks", DEN: "Denver Nuggets",
  DET: "Detroit Pistons", GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
  LAC: "LA Clippers", LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies", MIA: "Miami Heat",
  MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves", NOP: "New Orleans Pelicans", NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder", ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs", TOR: "Toronto Raptors",
  UTA: "Utah Jazz", WAS: "Washington Wizards",
  // WNBA
  ATA: "Atlanta Dream", CHS: "Chicago Sky", CON: "Connecticut Sun", DAW: "Dallas Wings",
  GSV: "Golden State Valkyries", IDF: "Indiana Fever", LVA: "Las Vegas Aces", LAS: "Los Angeles Sparks",
  MIN_W: "Minnesota Lynx", NYL: "New York Liberty", PHO: "Phoenix Mercury", SEA: "Seattle Storm",
  WAS_W: "Washington Mystics",
};

const TEAM_CITY: Record<string, string> = {
  ATL: "atlanta", BOS: "boston", BKN: "brooklyn", CHA: "charlotte", CHI: "chicago",
  CLE: "cleveland", DAL: "dallas", DEN: "denver", DET: "detroit", GSW: "golden state",
  HOU: "houston", IND: "indiana", LAC: "clippers", LAL: "lakers", MEM: "memphis",
  MIA: "miami", MIL: "milwaukee", MIN: "minnesota", NOP: "new orleans", NYK: "new york",
  OKC: "oklahoma", ORL: "orlando", PHI: "philadelphia", PHX: "phoenix", POR: "portland",
  SAC: "sacramento", SAS: "san antonio", TOR: "toronto", UTA: "utah", WAS: "washington",
};

// GAMETIME HIGHLIGHTS — posts "{Away} vs {Home} Full Game Highlights – {Month D, YYYY}" for every NBA game.
const GAMETIME_CHANNEL_ID = "UC0LrZO9wORIqn_aRJtKdgfA";
// Official WNBA channel — posts "{Away} vs {Home} | Highlights" for every WNBA game.
const WNBA_CHANNEL_ID = "UCqYwOSqyi0tEPRRwTPL5MXA";
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const clearAll = url.searchParams.get("clear") === "1";
    const limit = Math.min(parseInt(limitParam || "50"), 100); // max 100 per invocation

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional: invalidate all previously stored recap IDs so weak/wrong matches
    // get re-searched in this run.
    if (clearAll) {
      const { error: clearErr } = await supabase
        .from("schedule_games")
        .update({ youtube_recap_id: null })
        .eq("status", "FINAL")
        .not("youtube_recap_id", "is", null);
      if (clearErr) throw new Error(`clear failed: ${clearErr.message}`);
    }

    // Find FINAL games without youtube_recap_id
    const { data: games, error: fetchErr } = await supabase
      .from("schedule_games")
      .select("game_id, away_team, home_team, tipoff_utc, league_id")
      .eq("status", "FINAL")
      .is("youtube_recap_id", null)
      .limit(limit);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!games || games.length === 0) {
      return new Response(JSON.stringify({
        ok: true, data: { processed: 0, found: 0, remaining: 0, message: "All games already have recaps" },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve league code per league_id (small set, cache).
    const leagueCodeById = new Map<string, string>();
    const uniqueLeagueIds = [...new Set(games.map((g: any) => g.league_id).filter(Boolean))];
    if (uniqueLeagueIds.length > 0) {
      const { data: lgs } = await supabase
        .from("leagues")
        .select("id, code")
        .in("id", uniqueLeagueIds);
      for (const l of lgs ?? []) leagueCodeById.set(l.id as string, (l.code as string)?.toLowerCase());
    }

    let found = 0;
    const errors: string[] = [];

    for (const game of games) {
      try {
        const leagueCode = leagueCodeById.get((game as any).league_id) ?? "nba";
        const isWnba = leagueCode === "wnba";
        const awayFull = TEAM_FULL_NAME[game.away_team] ?? game.away_team;
        const homeFull = TEAM_FULL_NAME[game.home_team] ?? game.home_team;
        const tipoff = game.tipoff_utc ? new Date(game.tipoff_utc) : null;
        const dateStr = tipoff ? tipoff.toISOString().slice(0, 10) : "";
        const longDate = tipoff
          ? `${MONTH_NAMES[tipoff.getUTCMonth()]} ${tipoff.getUTCDate()}, ${tipoff.getUTCFullYear()}`.toLowerCase()
          : "";

        // Time window: tipoff − 6h … tipoff + 72h (recaps post within hours after final).
        const publishedAfter = tipoff
          ? new Date(tipoff.getTime() - 6 * 3600_000).toISOString()
          : undefined;
        const publishedBefore = tipoff
          ? new Date(tipoff.getTime() + 72 * 3600_000).toISOString()
          : undefined;

        const query = isWnba
          ? `${awayFull} vs ${homeFull} Highlights`
          : `${awayFull} vs ${homeFull} Full Game Highlights`;
        const params = new URLSearchParams({
          part: "snippet",
          channelId: isWnba ? WNBA_CHANNEL_ID : GAMETIME_CHANNEL_ID,
          q: query,
          type: "video",
          videoEmbeddable: "true",
          order: "date",
          maxResults: "10",
          key: YOUTUBE_API_KEY,
        });
        if (publishedAfter) params.set("publishedAfter", publishedAfter);
        if (publishedBefore) params.set("publishedBefore", publishedBefore);
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

        let ytRes = await fetch(searchUrl);
        if (!ytRes.ok) {
          const errBody = await ytRes.text();
          if (ytRes.status === 403) {
            errors.push(`YouTube API quota exceeded after ${found} lookups`);
            break;
          }
          errors.push(`YouTube API error for ${game.game_id}: ${ytRes.status}`);
          continue;
        }

        let ytData = await ytRes.json();
        let items: any[] = ytData?.items ?? [];
        const awayCity = TEAM_CITY[game.away_team] ?? game.away_team.toLowerCase();
        const homeCity = TEAM_CITY[game.home_team] ?? game.home_team.toLowerCase();
        const scoreItems = (arr: any[], minScore: number): { id: string | null; score: number } => {
          let best: any = null;
          let bestScore = -1;
          for (const item of arr) {
            const title = (item?.snippet?.title ?? "").toLowerCase();
            let score = 0;
            if (title.includes(awayCity)) score += 2;
            if (title.includes(homeCity)) score += 2;
            if (title.includes("full game")) score += 2;
            if (title.includes("highlights")) score += 1;
            if (longDate && title.includes(longDate)) score += 3;
            else if (dateStr && title.includes(dateStr.slice(5))) score += 1;
            if (score > bestScore) { bestScore = score; best = item; }
          }
          return { id: bestScore >= minScore ? (best?.id?.videoId ?? null) : null, score: bestScore };
        };

        // Primary: channel-scoped — both teams + highlights + date strongly preferred.
        // WNBA titles often omit "Full Game", so accept a slightly lower minScore.
        let { id: videoId } = scoreItems(items, isWnba ? 4 : 5);

        // Fallback: open YouTube search if channel-scoped lookup found no confident match.
        if (!videoId) {
          const fbQuery = isWnba
            ? `${awayFull} vs ${homeFull} ${dateStr} wnba highlights`.trim()
            : `${awayFull} vs ${homeFull} ${dateStr} full game highlights recap`.trim();
          const fbUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(fbQuery)}&type=video&videoEmbeddable=true&order=relevance&maxResults=8&key=${YOUTUBE_API_KEY}`;
          const fbRes = await fetch(fbUrl);
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const fbItems: any[] = fbData?.items ?? [];
            videoId = scoreItems(fbItems, isWnba ? 4 : 5).id;
          } else if (fbRes.status === 403) {
            errors.push(`YouTube API quota exceeded after ${found} lookups`);
            break;
          }
        }

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
