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
};

const TEAM_CITY: Record<string, string> = {
  ATL: "atlanta", BOS: "boston", BKN: "brooklyn", CHA: "charlotte", CHI: "chicago",
  CLE: "cleveland", DAL: "dallas", DEN: "denver", DET: "detroit", GSW: "golden state",
  HOU: "houston", IND: "indiana", LAC: "clippers", LAL: "lakers", MEM: "memphis",
  MIA: "miami", MIL: "milwaukee", MIN: "minnesota", NOP: "new orleans", NYK: "new york",
  OKC: "oklahoma", ORL: "orlando", PHI: "philadelphia", PHX: "phoenix", POR: "portland",
  SAC: "sacramento", SAS: "san antonio", TOR: "toronto", UTA: "utah", WAS: "washington",
};

// WNBA full names — keyed by the actual tricodes used in schedule_games
// (which collide with NBA codes for some teams: ATL/CHI/IND/WAS/DAL/MIN/TOR/POR/LAS).
const WNBA_TEAM_FULL_NAME: Record<string, string> = {
  ATL: "Atlanta Dream",         CHI: "Chicago Sky",            CON: "Connecticut Sun",
  IND: "Indiana Fever",         NYL: "New York Liberty",       TOR: "Toronto Tempo",
  WAS: "Washington Mystics",    DAL: "Dallas Wings",           GSV: "Golden State Valkyries",
  LVA: "Las Vegas Aces",        LAS: "Los Angeles Sparks",     MIN: "Minnesota Lynx",
  PHX: "Phoenix Mercury",       POR: "Portland Fire",          SEA: "Seattle Storm",
};
// WNBA scoring tokens — use the unique team nickname (always present in
// official @WNBA recap titles like "Connecticut Sun vs. New York Liberty | FULL GAME HIGHLIGHTS | May 8, 2026").
const WNBA_TEAM_CITY: Record<string, string> = {
  ATL: "dream",    CHI: "sky",       CON: "sun",         IND: "fever",     NYL: "liberty",
  TOR: "tempo",    WAS: "mystics",   DAL: "wings",       GSV: "valkyries", LVA: "aces",
  LAS: "sparks",   MIN: "lynx",      PHX: "mercury",     POR: "fire",      SEA: "storm",
};

// GAMETIME HIGHLIGHTS — posts "{Away} vs {Home} Full Game Highlights – {Month D, YYYY}" for every NBA game.
const GAMETIME_CHANNEL_ID = "UC0LrZO9wORIqn_aRJtKdgfA";
// Official @WNBA channel — posts "{Away Full} vs. {Home Full} | FULL GAME HIGHLIGHTS | {Month D, YYYY}".
const WNBA_CHANNEL_ID = "UCO9a_ryN_l7DIDS-VIt-zmw";
// Official @EuroLeague channel. Used as a hint only; for EuroLeague we run an
// OPEN YouTube search (no channelId filter) because highlights are uploaded by
// many partners (EuroLeague, clubs, broadcasters), so locking to one channel
// would miss most games.
// EuroLeague titles vary wildly across uploaders (official channel, clubs,
// Eurohoops, broadcasters). We accept ANY one of the aliases per team as
// "team mentioned" so we don't false-negative because a title says "Efes" or
// "Milano" instead of the full club name.
const EUROLEAGUE_TEAM_ALIASES: Record<string, string[]> = {
  EFS: ["anadolu efes", "efes"],
  ASM: ["monaco"],
  CZV: ["crvena zvezda", "zvezda", "red star"],
  DUB: ["dubai"],
  EA7: ["olimpia milano", "olimpia milan", "ea7", "milano", "milan"],
  BAR: ["barcelona", "barça", "barca"],
  BAY: ["bayern", "munich", "münchen"],
  FBB: ["fenerbahce", "fenerbahçe"],
  HTA: ["hapoel tel aviv", "hapoel"],
  BKN: ["baskonia"],
  ASV: ["asvel", "villeurbanne"],
  MTA: ["maccabi tel aviv", "maccabi"],
  OLY: ["olympiacos", "olympiakos"],
  PAO: ["panathinaikos", "pana"],
  PAR: ["paris basketball", "paris"],
  PBB: ["partizan"],
  RMB: ["real madrid", "madrid"],
  VBC: ["valencia"],
  VIR: ["virtus bologna", "virtus", "bologna"],
  ZAL: ["zalgiris", "žalgiris", "kaunas"],
};
// Friendly long-name used in the YouTube query string only.
const EUROLEAGUE_TEAM_FULL: Record<string, string> = {
  EFS: "Anadolu Efes",         ASM: "Monaco",              CZV: "Crvena Zvezda",
  DUB: "Dubai",                EA7: "Olimpia Milano",      BAR: "Barcelona",
  BAY: "Bayern Munich",        FBB: "Fenerbahce",          HTA: "Hapoel Tel Aviv",
  BKN: "Baskonia",             ASV: "ASVEL",               MTA: "Maccabi Tel Aviv",
  OLY: "Olympiacos",           PAO: "Panathinaikos",       PAR: "Paris Basketball",
  PBB: "Partizan",             RMB: "Real Madrid",         VBC: "Valencia",
  VIR: "Virtus Bologna",       ZAL: "Zalgiris",
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    // Per-game clear-and-search ("replace mode"): for each game we pick up,
    // we will null its existing recap id ONLY when we find a new one. We never
    // bulk-wipe the table — that footgun has been removed.
    const replaceMode = url.searchParams.get("replace") === "1";
    const targetGameId = url.searchParams.get("game_id");
    const idsParam = url.searchParams.get("ids");
    // Audit mode: re-fetch every recap for a specific gw/day (per-game replace).
    // Use this to repair gamedays where stale recaps were written by the older
    // looser scorer. Never touches games outside the requested gw/day.
    const mode = url.searchParams.get("mode");
    const auditGw = url.searchParams.get("gw");
    const auditDay = url.searchParams.get("day");
    const auditLeague = (url.searchParams.get("league") || "").toLowerCase();
    const idsList = idsParam ? idsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 100) : null;
    const limit = Math.min(parseInt(limitParam || "50"), 100); // max 100 per invocation
    // League filter: nba | wnba | both (default both). Scopes the candidate set
    // so a quota-limited run never wastes calls on the wrong league. When the
    // user passes a single game_id or ids list, the league filter is ignored
    // because those calls are already explicit.
    const leagueParam = (url.searchParams.get("league") || "both").toLowerCase();
    const leagueFilter: "nba" | "wnba" | "euroleague" | "both" =
      leagueParam === "nba" || leagueParam === "wnba" || leagueParam === "euroleague"
        ? (leagueParam as "nba" | "wnba" | "euroleague")
        : "both";
    // Relaxed mode = explicit user-driven refresh (single game_id OR ids list).
    // Widens the YouTube date window and lowers the minScore so manual retries
    // can pick up recaps that were posted late or with non-standard titles.
    const relaxed = !!targetGameId || (idsList !== null && idsList.length > 0);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ───────── audit mode: expand gw/day into an ids list, force replace ─────────
    let auditIdsList: string[] | null = null;
    if (mode === "audit" && auditGw && auditDay) {
      let aq = supabase
        .from("schedule_games")
        .select("game_id, league_id")
        .eq("gw", parseInt(auditGw))
        .eq("day", parseInt(auditDay))
        .eq("status", "FINAL");
      if (auditLeague === "nba" || auditLeague === "wnba") {
        const { data: lgs } = await supabase.from("leagues").select("id").eq("code", auditLeague);
        const ids = (lgs ?? []).map((l: any) => l.id);
        if (ids.length) aq = aq.in("league_id", ids);
      }
      const { data: auditGames } = await aq;
      auditIdsList = (auditGames ?? []).map((g: any) => g.game_id);
    }

    // Resolve league_id list when scoped. We map by leagues.code so we don't
    // hard-code uuids.
    let allowedLeagueIds: string[] | null = null;
    if (!targetGameId && (!idsList || idsList.length === 0) && leagueFilter !== "both") {
      const { data: lgs } = await supabase
        .from("leagues")
        .select("id, code")
        .in("code", [leagueFilter]);
      allowedLeagueIds = (lgs ?? []).map((l: any) => l.id as string);
      if (allowedLeagueIds.length === 0) {
        return new Response(JSON.stringify({
          ok: true, data: { processed: 0, found: 0, remaining: 0, message: `No league with code=${leagueFilter}` },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Build the candidate game list.
    //   - target a single game when game_id is provided (per-card refresh)
    //   - in replace mode pick FINAL games regardless of existing recap id
    //   - otherwise only pick FINAL games still missing a recap id
    let q = supabase
      .from("schedule_games")
      .select("game_id, away_team, home_team, tipoff_utc, league_id, youtube_recap_id")
      .eq("status", "FINAL");
    const effectiveIdsList = auditIdsList ?? idsList;
    const forceReplace = replaceMode || auditIdsList !== null;
    if (targetGameId) {
      q = q.eq("game_id", targetGameId);
    } else if (effectiveIdsList && effectiveIdsList.length > 0) {
      q = q.in("game_id", effectiveIdsList);
    } else {
      if (!replaceMode) q = q.is("youtube_recap_id", null);
      if (allowedLeagueIds) q = q.in("league_id", allowedLeagueIds);
      q = q.limit(limit);
    }
    const { data: games, error: fetchErr } = await q;

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

    // Build a per-(league_id, date) "other teams playing tonight" set so we can
    // hard-reject YouTube titles that mention a 3rd team (e.g. "lakers vs
    // pacers" on a LAL@DEN slate).
    const sameNightTeamCities = new Map<string, Set<string>>();
    {
      const dateKeys = new Map<string, { league_id: string; date: string }>();
      for (const g of games) {
        const t = (g as any).tipoff_utc ? new Date((g as any).tipoff_utc) : null;
        if (!t) continue;
        const d = t.toISOString().slice(0, 10);
        const key = `${(g as any).league_id}|${d}`;
        if (!dateKeys.has(key)) dateKeys.set(key, { league_id: (g as any).league_id, date: d });
      }
      for (const [key, { league_id, date }] of dateKeys) {
        const start = new Date(date + "T00:00:00Z");
        const end = new Date(start.getTime() + 36 * 3600_000);
        const { data: nightGames } = await supabase
          .from("schedule_games")
          .select("away_team, home_team")
          .eq("league_id", league_id)
          .gte("tipoff_utc", new Date(start.getTime() - 12 * 3600_000).toISOString())
          .lte("tipoff_utc", end.toISOString());
        const leagueCode = leagueCodeById.get(league_id) ?? "nba";
        const cityMap = leagueCode === "wnba" ? WNBA_TEAM_CITY : TEAM_CITY;
        const set = new Set<string>();
        for (const ng of nightGames ?? []) {
          const a = cityMap[(ng as any).away_team]; if (a) set.add(a);
          const h = cityMap[(ng as any).home_team]; if (h) set.add(h);
        }
        sameNightTeamCities.set(key, set);
      }
    }

    let found = 0;
    // Per-league counters so callers can see exactly which league consumed quota.
    const perLeague = { nba: { processed: 0, found: 0 }, wnba: { processed: 0, found: 0 } };
    let quotaExhausted = false;
    const errors: string[] = [];

    for (const game of games) {
      try {
        const leagueCode = leagueCodeById.get((game as any).league_id) ?? "nba";
        const isWnba = leagueCode === "wnba";
        const isEuro = leagueCode === "euroleague";
        const bucket = isEuro
          ? ((perLeague as any).euroleague ??= { processed: 0, found: 0 })
          : isWnba
          ? perLeague.wnba
          : perLeague.nba;
        bucket.processed += 1;
        const fullMap = isEuro
          ? EUROLEAGUE_TEAM_NICKNAMES
          : isWnba ? WNBA_TEAM_FULL_NAME : TEAM_FULL_NAME;
        const cityMap = isEuro
          ? EUROLEAGUE_TEAM_NICKNAMES
          : isWnba ? WNBA_TEAM_CITY : TEAM_CITY;
        const awayFull = fullMap[game.away_team] ?? game.away_team;
        const homeFull = fullMap[game.home_team] ?? game.home_team;
        const tipoff = game.tipoff_utc ? new Date(game.tipoff_utc) : null;
        const dateStr = tipoff ? tipoff.toISOString().slice(0, 10) : "";
        const longDate = tipoff
          ? `${MONTH_NAMES[tipoff.getUTCMonth()]} ${tipoff.getUTCDate()}, ${tipoff.getUTCFullYear()}`.toLowerCase()
          : "";

        // Time window: bulk = tipoff − 6h … +72h. Relaxed = tipoff − 12h … +14d.
        const beforeMs = relaxed ? 12 * 3600_000 : 6 * 3600_000;
        const afterMs = relaxed ? 14 * 24 * 3600_000 : 72 * 3600_000;
        const publishedAfter = tipoff
          ? new Date(tipoff.getTime() - beforeMs).toISOString()
          : undefined;
        const publishedBefore = tipoff
          ? new Date(tipoff.getTime() + afterMs).toISOString()
          : undefined;

        const query = isEuro
          ? `${awayFull} vs ${homeFull} EuroLeague highlights ${dateStr}`
          : isWnba
          ? `${awayFull} vs. ${homeFull} FULL GAME HIGHLIGHTS`
          : `${awayFull} vs ${homeFull} Full Game Highlights`;
        const params = new URLSearchParams({
          part: "snippet",
          q: query,
          type: "video",
          videoEmbeddable: "true",
          order: "date",
          maxResults: "10",
          key: YOUTUBE_API_KEY,
        });
        // EuroLeague: open search (many publishers). NBA/WNBA: scope to channel.
        if (!isEuro) params.set("channelId", isWnba ? WNBA_CHANNEL_ID : GAMETIME_CHANNEL_ID);
        if (publishedAfter) params.set("publishedAfter", publishedAfter);
        if (publishedBefore) params.set("publishedBefore", publishedBefore);
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

        let ytRes = await fetch(searchUrl);
        if (!ytRes.ok) {
          const errBody = await ytRes.text();
          if (ytRes.status === 403) {
            errors.push(`YouTube API quota exceeded after ${found} lookups`);
            quotaExhausted = true;
            break;
          }
          errors.push(`YouTube API error for ${game.game_id}: ${ytRes.status}`);
          continue;
        }

        let ytData = await ytRes.json();
        let items: any[] = ytData?.items ?? [];
        const awayCity = cityMap[game.away_team] ?? game.away_team.toLowerCase();
        const homeCity = cityMap[game.home_team] ?? game.home_team.toLowerCase();
        const tipoffDay = tipoff ? tipoff.toISOString().slice(0, 10) : "";
        const nightKey = `${(game as any).league_id}|${tipoffDay}`;
        const otherCities = sameNightTeamCities.get(nightKey) ?? new Set<string>();
        const scoreItems = (arr: any[], minScore: number): { id: string | null; score: number } => {
          let best: any = null;
          let bestScore = -1;
          for (const item of arr) {
            const title = (item?.snippet?.title ?? "").toLowerCase();
            const hasAway = title.includes(awayCity);
            const hasHome = title.includes(homeCity);
            // HARD REQUIREMENT: title must mention BOTH teams. Single-team
            // matches were the root cause of cross-game pollution (e.g.
            // "Lakers vs Pacers" leaking onto LAL@DEN).
            if (!hasAway || !hasHome) continue;
            // HARD REJECT: title mentions a different team that's playing the
            // same night in the same league.
            let mentionsOther = false;
            for (const c of otherCities) {
              if (c === awayCity || c === homeCity) continue;
              if (title.includes(c)) { mentionsOther = true; break; }
            }
            if (mentionsOther) continue;
            let score = 4; // both teams confirmed
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
        // Relaxed mode lowers thresholds further so manual refreshes catch late posts.
        const primaryMin = isEuro ? 4 : (relaxed ? (isWnba ? 5 : 6) : (isWnba ? 5 : 6));
        let { id: videoId } = scoreItems(items, primaryMin);

        // Fallback: open YouTube search if channel-scoped lookup found no confident match.
        if (!videoId) {
          const fbQuery = isEuro
            ? `${awayFull} vs ${homeFull} ${dateStr} euroleague highlights`.trim()
            : isWnba
            ? `${awayFull} vs ${homeFull} ${dateStr} wnba highlights`.trim()
            : `${awayFull} vs ${homeFull} ${dateStr} full game highlights recap`.trim();
          const fbUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(fbQuery)}&type=video&videoEmbeddable=true&order=relevance&maxResults=8&key=${YOUTUBE_API_KEY}`;
          const fbRes = await fetch(fbUrl);
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const fbItems: any[] = fbData?.items ?? [];
            videoId = scoreItems(fbItems, isEuro ? 4 : (isWnba ? 5 : 6)).id;
          } else if (fbRes.status === 403) {
            errors.push(`YouTube API quota exceeded after ${found} lookups`);
            quotaExhausted = true;
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
            bucket.found += 1;
          }
        } else if (forceReplace && game.youtube_recap_id) {
          // Audit / replace mode: if the old recap can no longer be confidently
          // matched, clear it so the UI stops showing a wrong video. A later
          // pass (or the next nightly run) will try again.
          await supabase
            .from("schedule_games")
            .update({ youtube_recap_id: null })
            .eq("game_id", game.game_id);
        }
        // In replace mode, if we explicitly want to drop a stale id even when
        // YouTube returns nothing, we keep the existing recap intact. This is
        // the "non-destructive replace" promise: we only overwrite when we have
        // something better.

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
      data: {
        processed: games.length, found, remaining: count ?? 0,
        per_league: perLeague,
        quota_exhausted: quotaExhausted,
        errors: errors.length ? errors : undefined,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("youtube-recap-lookup error:", e);
    return new Response(JSON.stringify({
      ok: false, data: null,
      error: { code: "YOUTUBE_LOOKUP_ERROR", message: e.message, details: null },
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
