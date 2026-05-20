// Court Show — Ballers.IQ Gamenight Intelligence generator.
// Produces 4 structured "index" cards per (league_id, gw, day) and caches
// them in the `court_show_intelligence` table. Idempotent: if a fresh row
// already exists it returns it as-is.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Bump when the validator/prompt rules change so previously cached rows are
// regenerated on next read (we tag every emitted card with this version).
const VALIDATOR_VERSION = 4;

// Full team name tables (city + nickname + fullName) keyed by tricode. Used
// to detect cross-league pollution in card body/headline copy where the model
// references teams by name instead of tricode (e.g. "Trail Blazers", "Bulls").
const NBA_TEAMS: { tri: string; city: string; nickname: string }[] = [
  { tri: "ATL", city: "Atlanta",      nickname: "Hawks" },
  { tri: "BOS", city: "Boston",       nickname: "Celtics" },
  { tri: "BKN", city: "Brooklyn",     nickname: "Nets" },
  { tri: "CHA", city: "Charlotte",    nickname: "Hornets" },
  { tri: "CHI", city: "Chicago",      nickname: "Bulls" },
  { tri: "CLE", city: "Cleveland",    nickname: "Cavaliers" },
  { tri: "DAL", city: "Dallas",       nickname: "Mavericks" },
  { tri: "DEN", city: "Denver",       nickname: "Nuggets" },
  { tri: "DET", city: "Detroit",      nickname: "Pistons" },
  { tri: "GSW", city: "Golden State", nickname: "Warriors" },
  { tri: "HOU", city: "Houston",      nickname: "Rockets" },
  { tri: "IND", city: "Indiana",      nickname: "Pacers" },
  { tri: "LAC", city: "LA",           nickname: "Clippers" },
  { tri: "LAL", city: "Los Angeles",  nickname: "Lakers" },
  { tri: "MEM", city: "Memphis",      nickname: "Grizzlies" },
  { tri: "MIA", city: "Miami",        nickname: "Heat" },
  { tri: "MIL", city: "Milwaukee",    nickname: "Bucks" },
  { tri: "MIN", city: "Minnesota",    nickname: "Timberwolves" },
  { tri: "NOP", city: "New Orleans",  nickname: "Pelicans" },
  { tri: "NYK", city: "New York",     nickname: "Knicks" },
  { tri: "OKC", city: "Oklahoma City",nickname: "Thunder" },
  { tri: "ORL", city: "Orlando",      nickname: "Magic" },
  { tri: "PHI", city: "Philadelphia", nickname: "76ers" },
  { tri: "PHX", city: "Phoenix",      nickname: "Suns" },
  { tri: "POR", city: "Portland",     nickname: "Trail Blazers" },
  { tri: "SAC", city: "Sacramento",   nickname: "Kings" },
  { tri: "SAS", city: "San Antonio",  nickname: "Spurs" },
  { tri: "TOR", city: "Toronto",      nickname: "Raptors" },
  { tri: "UTA", city: "Utah",         nickname: "Jazz" },
  { tri: "WAS", city: "Washington",   nickname: "Wizards" },
];
const WNBA_TEAMS: { tri: string; city: string; nickname: string }[] = [
  { tri: "ATL", city: "Atlanta",      nickname: "Dream" },
  { tri: "CHI", city: "Chicago",      nickname: "Sky" },
  { tri: "CON", city: "Connecticut",  nickname: "Sun" },
  { tri: "DAL", city: "Dallas",       nickname: "Wings" },
  { tri: "IND", city: "Indiana",      nickname: "Fever" },
  { tri: "LVA", city: "Las Vegas",    nickname: "Aces" },
  { tri: "LAS", city: "Los Angeles",  nickname: "Sparks" },
  { tri: "MIN", city: "Minnesota",    nickname: "Lynx" },
  { tri: "NYL", city: "New York",     nickname: "Liberty" },
  { tri: "PHX", city: "Phoenix",      nickname: "Mercury" },
  { tri: "SEA", city: "Seattle",      nickname: "Storm" },
  { tri: "WAS", city: "Washington",   nickname: "Mystics" },
  { tri: "GSV", city: "Golden State", nickname: "Valkyries" },
  { tri: "TOR", city: "Toronto",      nickname: "Tempo" },
];

type AIIndexKind =
  | "form_index"
  | "matchup_index"
  | "schedule_index"
  | "market_index"
  | "role_stability";

interface AICard {
  kind: AIIndexKind;
  score?: number;
  headline: string;
  body: string;
  player_id?: number | null;
  player_name?: string | null;
  player_photo?: string | null;
  team?: string | null;
  away_team?: string | null;
  home_team?: string | null;
  game_id?: string | null;
  league?: "NBA" | "WNBA";
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { league_id, gw, day, force } = await req.json();
    if (!league_id || typeof gw !== "number" || typeof day !== "number") {
      return jsonResp({ error: "league_id, gw, day required" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve league code (nba/wnba) so the AI never mixes leagues.
    const { data: leagueRow } = await sb
      .from("leagues")
      .select("code, name")
      .eq("id", league_id)
      .maybeSingle();
    const leagueCode = (leagueRow?.code ?? "nba").toLowerCase();
    const leagueLabel = leagueCode === "wnba" ? "WNBA" : "NBA";

    // ── helpers used by validators (defined early so cache check can use them) ──
    // Tokens that look like tricodes but aren't team tricodes. We must exclude
    // them from the body/headline tricode scan to avoid false positives.
    const TRICODE_NOISE = new Set([
      "FP","GW","MP","PTS","REB","AST","STL","BLK","TOV","FG","FGA","FGM",
      "FT","FTA","FTM","TP","TPA","TPM","USG","TS","PER","NBA","WNBA","ESPN",
      "TV","ABC","CBS","NBC","FOX","TNT","ET","PT","CT","MT","AM","PM","UTC",
      "WAS","NOW","DEL","VAL","ON","OFF","OK","NO","YES","HOME","AWAY",
      "B2B","V5","L5","L10","L3",
    ]);
    const extractTricodes = (text: string): string[] => {
      const out: string[] = [];
      const re = /\b[A-Z]{2,4}\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const t = m[0];
        if (TRICODE_NOISE.has(t)) continue;
        out.push(t);
      }
      return out;
    };
    const extractCandidateNames = (text: string): string[] => {
      // Two consecutive Capitalized tokens, optionally with apostrophes/hyphens.
      // Captures "Tyrese Haliburton", "A'ja Wilson", "Jewell Loyd".
      const out: string[] = [];
      const re = /\b([A-Z][a-zA-Z'’\-]{1,})\s+([A-Z][a-zA-Z'’\-]{1,})\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) out.push(`${m[1]} ${m[2]}`);
      return out;
    };

    // Build a list of foreign-league team terms (city + nickname) that should
    // never appear in this league's slate copy. Excludes any term that is also
    // a valid term in the current league (e.g. "Atlanta", "Washington").
    const currentTable = leagueCode === "wnba" ? WNBA_TEAMS : NBA_TEAMS;
    // The blocklist is computed AFTER we resolve tonight's slate tricodes
    // (see `buildForeignTermChecker` below) so we can also flag current-league
    // teams that aren't actually playing tonight (off-slate leaks).
    let containsForeignTeamTerm: (text: string) => boolean = () => false;
    const buildForeignTermChecker = (allowedTris: Set<string>) => {
      // Any team term (from either league) whose tricode is NOT on tonight's
      // slate is considered foreign. This catches both cross-league leaks
      // (NBA "Trail Blazers" on a WNBA night) and off-slate leaks (a WNBA
      // team that exists but isn't playing tonight).
      const terms: string[] = [];
      const allTeams = [...NBA_TEAMS, ...WNBA_TEAMS];
      for (const t of allTeams) {
        if (allowedTris.has(t.tri.toUpperCase())) continue;
        for (const term of [t.city, t.nickname, `${t.city} ${t.nickname}`]) {
          if (term && term.length >= 3) terms.push(term);
        }
      }
      // De-dupe and drop terms that are ALSO names of teams actually on the
      // slate (e.g. "Atlanta" appears in both leagues; if WNBA ATL is playing
      // tonight we shouldn't block "Atlanta").
      const onSlateTerms = new Set<string>();
      for (const t of allTeams) {
        if (!allowedTris.has(t.tri.toUpperCase())) continue;
        onSlateTerms.add(t.city.toLowerCase());
        onSlateTerms.add(t.nickname.toLowerCase());
        onSlateTerms.add(`${t.city} ${t.nickname}`.toLowerCase());
      }
      const filtered = Array.from(new Set(terms)).filter(
        (term) => !onSlateTerms.has(term.toLowerCase()),
      );
      return (text: string): boolean => {
        if (!text) return false;
        const hay = text.toLowerCase();
        return filtered.some((term) => {
          const t = term.toLowerCase();
          const re = new RegExp(
            `(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
            "i",
          );
          return re.test(hay);
        });
      };
    };

    // Compute live slate mode FIRST so we can detect cache staleness below.
    const { data: gamesPre } = await sb
      .from("schedule_games")
      .select("status")
      .eq("league_id", league_id).eq("gw", gw).eq("day", day);
    const liveFinals = (gamesPre ?? []).filter((g) => (g.status ?? "").toUpperCase().includes("FINAL"));
    const liveUpcoming = (gamesPre ?? []).filter((g) => !(g.status ?? "").toUpperCase().includes("FINAL"));
    const liveMode: "recap" | "matchup" | "mixed" =
      liveFinals.length && liveUpcoming.length ? "mixed" : liveFinals.length ? "recap" : "matchup";

    // Pre-compute slate tricodes for the cache-pollution check below.
    const { data: cachePreGames } = await sb
      .from("schedule_games")
      .select("home_team, away_team, tipoff_utc")
      .eq("league_id", league_id).eq("gw", gw).eq("day", day);
    const cacheSlateTris = new Set(
      (cachePreGames ?? []).flatMap((g: any) => [g.home_team, g.away_team])
        .filter(Boolean)
        .map((t: string) => String(t).toUpperCase())
    );
    // Wire up the foreign-term checker now that we know tonight's tricodes.
    containsForeignTeamTerm = buildForeignTermChecker(cacheSlateTris);

    // Resolve the human-readable slate date/weekday in Europe/Lisbon so the
    // AI never invents a weekday (e.g. "Sunday" on a Friday). We anchor on
    // the earliest tipoff to honour gameweeks that cross midnight.
    const tipoffs = (cachePreGames ?? [])
      .map((g: any) => g.tipoff_utc)
      .filter(Boolean)
      .map((s: string) => new Date(s).getTime())
      .filter((n: number) => Number.isFinite(n));
    const earliestTipoff = tipoffs.length ? new Date(Math.min(...tipoffs)) : null;
    const lisbonFmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Lisbon", ...opts }).format(d);
    const slateWeekday = earliestTipoff ? lisbonFmt(earliestTipoff, { weekday: "long" }) : null;
    const slateDate = earliestTipoff
      ? lisbonFmt(earliestTipoff, { weekday: "long", month: "long", day: "numeric" })
      : null;

    if (!force) {
      const { data: existing } = await sb
        .from("court_show_intelligence")
        .select("cards, headline, mode, generated_at")
        .eq("league_id", league_id).eq("gw", gw).eq("day", day)
        .maybeSingle();
      if (existing && (existing.cards as any[])?.length) {
        // Detect cross-league pollution (e.g. WNBA row referencing NBA tricodes).
        const cardsArr = (existing.cards as any[]) ?? [];
        const fieldTricodes = cardsArr.flatMap((c) =>
          [c.team, c.home_team, c.away_team].filter(Boolean).map((t: string) => String(t).toUpperCase())
        );
        const textTricodes = cardsArr.flatMap((c) =>
          extractTricodes(`${c.headline ?? ""} ${c.body ?? ""}`)
        );
        const allTricodes = [...fieldTricodes, ...textTricodes];
        const NBA_ONLY = new Set(["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]);
        const WNBA_ONLY = new Set(["ATL","CHI","CON","DAL","IND","LVA","LAS","MIN","NYL","PHX","SEA","WAS","GSV","TOR"]);
        const polluted =
          (leagueCode === "wnba" && allTricodes.some((t) => NBA_ONLY.has(t) && !WNBA_ONLY.has(t))) ||
          (leagueCode === "nba"  && allTricodes.some((t) => WNBA_ONLY.has(t) && !NBA_ONLY.has(t)));
        // Slate-level pollution: any tricode referenced that isn't playing tonight.
        const offSlate = cacheSlateTris.size > 0 && allTricodes.some((t) => !cacheSlateTris.has(t));
        // Wrong-league tag: any card explicitly tagged with a different league.
        const wrongLeague = cardsArr.some((c: any) => c.league && c.league !== leagueLabel);
        // Cached row predates this validator version → regenerate.
        const versionStale = cardsArr.some((c: any) => (c._v ?? 0) < VALIDATOR_VERSION);
        // Cards missing league tag entirely → predate the league-tagging fix.
        const missingLeagueTag = cardsArr.some((c: any) => !c.league);
        // Foreign team name leaked into body/headline copy.
        const foreignTeamLeak = cardsArr.some((c: any) =>
          containsForeignTeamTerm(`${c.headline ?? ""} ${c.body ?? ""}`)
        );
        // Player-level pollution: any player_name OR body-name not in the league.
        let unknownPlayer = false;
        const namesInCache = Array.from(new Set([
          ...cardsArr.map((c: any) => c.player_name).filter(Boolean),
          ...cardsArr.flatMap((c: any) => extractCandidateNames(`${c.body ?? ""}`)),
        ])) as string[];
        if (namesInCache.length) {
          const { data: ps } = await sb
            .from("players")
            .select("name")
            .eq("league_id", league_id)
            .in("name", namesInCache);
          const known = new Set((ps ?? []).map((p: any) => String(p.name).toLowerCase()));
          // Cross-league check: any candidate name that DOES exist in the
          // OTHER league but not in this one is hard evidence of pollution.
          const { data: foreign } = await sb
            .from("players")
            .select("name, league_id")
            .neq("league_id", league_id)
            .in("name", namesInCache);
          const foreignSet = new Set((foreign ?? []).map((p: any) => String(p.name).toLowerCase()));
          unknownPlayer = namesInCache.some(
            (n) => !known.has(n.toLowerCase()) && foreignSet.has(n.toLowerCase())
          );
        }
        // Regenerate if the slate mode changed since cache (e.g. games went FINAL
        // and we now need recap angles instead of preview angles).
        const modeStale = existing.mode && existing.mode !== liveMode;
        if (!polluted && !modeStale && !offSlate && !unknownPlayer && !wrongLeague && !versionStale && !missingLeagueTag && !foreignTeamLeak) {
          return jsonResp({ cached: true, ...existing });
        }
        // Cached row is bad — hard-delete it so a partial regeneration failure
        // can never leave the stale leaked content visible to clients.
        await sb
          .from("court_show_intelligence")
          .delete()
          .eq("league_id", league_id).eq("gw", gw).eq("day", day);
      }
    }

    // Pull the slate context (games + per-team aggregates) so the model has
    // grounded inputs. Keep it cheap — just enough for storytelling.
    const { data: games } = await sb
      .from("schedule_games")
      .select("game_id, home_team, away_team, status, home_pts, away_pts, tipoff_utc")
      .eq("league_id", league_id).eq("gw", gw).eq("day", day);

    const finalGames = (games ?? []).filter((g) => (g.status ?? "").toUpperCase().includes("FINAL"));
    const upcoming   = (games ?? []).filter((g) => !(g.status ?? "").toUpperCase().includes("FINAL"));
    const mode: "recap" | "matchup" | "mixed" =
      finalGames.length && upcoming.length ? "mixed" : finalGames.length ? "recap" : "matchup";

    // Per-team roster shortlist (top ~6 by salary) so the model can never
    // freelance players from training data — especially critical for WNBA
    // scheduled days where there are no `topPerformers` to anchor it.
    const slateTricodes = Array.from(new Set(
      (games ?? []).flatMap((g) => [g.home_team, g.away_team]).filter(Boolean) as string[]
    ));
    const rosters: { team: string; players: { id: number; name: string }[] }[] = [];
    const allowedNames = new Set<string>();
    const allowedTris = new Set(slateTricodes.map((t) => String(t).toUpperCase()));
    const teamLookup = new Map(currentTable.map((t) => [t.tri, t]));
    const slateTeams: { tri: string; city: string; nickname: string; fullName: string }[] = [];
    if (slateTricodes.length) {
      for (const t of slateTricodes) {
        const meta = teamLookup.get(String(t).toUpperCase());
        slateTeams.push({
          tri: t,
          city: meta?.city ?? t,
          nickname: meta?.nickname ?? "",
          fullName: meta ? `${meta.city} ${meta.nickname}` : t,
        });
      }
    }
    if (slateTricodes.length) {
      const { data: rosterPlayers } = await sb
        .from("players")
        .select("id, name, team, salary")
        .eq("league_id", league_id)
        .in("team", slateTricodes);
      const byTeam = new Map<string, { id: number; name: string; salary: number | null }[]>();
      for (const p of rosterPlayers ?? []) {
        const t = String(p.team ?? "").toUpperCase();
        if (!t) continue;
        if (!byTeam.has(t)) byTeam.set(t, []);
        byTeam.get(t)!.push({ id: p.id as number, name: p.name as string, salary: (p as any).salary ?? null });
      }
      for (const t of slateTricodes) {
        const list = (byTeam.get(t.toUpperCase()) ?? [])
          .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
          .slice(0, 6)
          .map((p) => ({ id: p.id, name: p.name }));
        rosters.push({ team: t, players: list });
        for (const p of list) allowedNames.add(p.name.toLowerCase());
      }
    }

    // Top performers from played games (if any)
    let topPerformers: any[] = [];
    if (finalGames.length) {
      const ids = finalGames.map((g) => g.game_id);
      const { data: logs } = await sb
        .from("player_game_logs")
        .select("player_id, game_id, mp, pts, reb, ast, stl, blk, fp")
        .in("game_id", ids);
      topPerformers = (logs ?? [])
        .map((l: any) => ({
          ...l,
          fp: l.fp ?? (l.pts + l.reb + 2 * l.ast + 3 * l.stl + 3 * l.blk),
        }))
        .sort((a: any, b: any) => b.fp - a.fp)
        .slice(0, 8);
      const pids = topPerformers.map((t) => t.player_id);
      if (pids.length) {
        const { data: ps } = await sb.from("players").select("id, name, team, photo").in("id", pids);
        const map = new Map((ps ?? []).map((p: any) => [p.id, p]));
        topPerformers = topPerformers.map((t) => ({ ...t, player: map.get(t.player_id) }));
      }
    }

    let cards: AICard[] = [];
    let headline = "GAMENIGHT INTELLIGENCE";

    if (LOVABLE_API_KEY) {
      const sysPrompt = `You are Ballers.IQ — a fantasy basketball editorial AI for the ${leagueLabel}.
Generate exactly 4 short, punchy "index" cards for tonight's ${leagueLabel} slate.
Pick 4 different "kind" values from: form_index, matchup_index, schedule_index, market_index, role_stability.
Rules:
- Headlines under 9 words, all caps OK, NO emojis.
- Bodies under 28 words, concrete, no L5/FP5 jargon.
- Reference players by name + team tricode (e.g. "LeBron · LAL").
- HARD RULE: Every player you name MUST appear in the user payload's "rosters" array, with the exact same name and assigned to the exact same team tricode. Never name a player who is not in "rosters".
- Never recall players from training data. If you cannot ground a card in "rosters"/"games", write generic copy without naming any player.
- This is the ${leagueLabel}. Do NOT reference players or teams from any other league. Tag every card you emit with "league": "${leagueLabel}".
- HARD RULE: You may ONLY reference team tricodes present in user payload's "slateTeams". Do NOT mention any other team tricode anywhere in the headline or body.
- HARD RULE: You may ONLY reference teams by city, nickname, or full name that appear in user payload's "slateTeams" (city/nickname/fullName fields). Never reference any other team's city or nickname — e.g. on a WNBA slate, never write "Trail Blazers", "Bulls", "Timberwolves", "Portland", "Toronto", or any NBA team name.
- HARD RULE: When you need to reference what day this slate is, use exactly user payload's "slateWeekday" (e.g. "${slateWeekday ?? "Friday"} slate"). Do NOT infer or invent a different weekday.
- If the slate has no games or no top performers, write generic ${leagueLabel} preview copy without naming specific players.
- For played games, lean into recap angles; for scheduled games, lean into preview angles; for mixed, blend both.
- Also produce a single short HEADLINE (under 8 words) summarizing the night.`;

      const userPayload = {
        league: leagueLabel,
        gw, day, mode,
        slateDate,
        slateWeekday,
        slateTeams,
        games: (games ?? []).map((g: any) => ({
          game_id: g.game_id, away: g.away_team, home: g.home_team,
          status: g.status, away_pts: g.away_pts, home_pts: g.home_pts, tipoff_utc: g.tipoff_utc,
        })),
        rosters,
        topPerformers: topPerformers.map((t: any) => ({
          player_id: t.player_id,
          name: t.player?.name, team: t.player?.team,
          fp: t.fp, pts: t.pts, reb: t.reb, ast: t.ast, stl: t.stl, blk: t.blk, mp: t.mp,
        })),
      };

      const tools = [{
        type: "function",
        function: {
          name: "emit_intelligence",
          description: "Return the headline and 4 index cards.",
          parameters: {
            type: "object",
            properties: {
              headline: { type: "string" },
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: { type: "string", enum: ["form_index","matchup_index","schedule_index","market_index","role_stability"] },
                    score: { type: "number" },
                    headline: { type: "string" },
                    body: { type: "string" },
                    player_id: { type: ["integer","null"] },
                    player_name: { type: ["string","null"] },
                    team: { type: ["string","null"] },
                    away_team: { type: ["string","null"] },
                    home_team: { type: ["string","null"] },
                    game_id: { type: ["string","null"] },
                    league: { type: "string", enum: ["NBA","WNBA"] },
                  },
                  required: ["kind","headline","body"],
                  additionalProperties: false,
                },
              },
            },
            required: ["headline","cards"],
            additionalProperties: false,
          },
        },
      }];

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: JSON.stringify(userPayload) },
            ],
            tools,
            tool_choice: { type: "function", function: { name: "emit_intelligence" } },
          }),
        });
        if (aiResp.ok) {
          const j = await aiResp.json();
          const call = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (call) {
            const parsed = JSON.parse(call);
            headline = String(parsed.headline ?? headline);
            cards = (parsed.cards ?? []).slice(0, 4);
            // Sanitize: only accept clean 2-4 letter UPPERCASE tricodes; otherwise
            // drop the field so the UI doesn't render garbage like "MIN},{body:".
            const cleanTri = (v: unknown): string | null => {
              if (typeof v !== "string") return null;
              const t = v.trim().toUpperCase();
              return /^[A-Z]{2,4}$/.test(t) ? t : null;
            };
            cards = cards.map((c) => ({
              ...c,
              team: cleanTri(c.team),
              away_team: cleanTri(c.away_team),
              home_team: cleanTri(c.home_team),
              headline: typeof c.headline === "string" ? c.headline.replace(/[{}]/g, "").slice(0, 120) : "",
              body: typeof c.body === "string" ? c.body.replace(/[{}]/g, "").slice(0, 280) : "",
            }));
            // Build the set of foreign player names referenced anywhere in
            // the cards. We use this to drop cards that smuggle in a name
            // from another league via the body text.
            const allCandidateNames = Array.from(new Set(
              cards.flatMap((c) => [
                ...(c.player_name ? [c.player_name as string] : []),
                ...extractCandidateNames(`${c.body ?? ""}`),
              ])
            ));
            let foreignNameSet = new Set<string>();
            let localNameSet = new Set<string>();
            if (allCandidateNames.length) {
              const [{ data: localPs }, { data: foreignPs }] = await Promise.all([
                sb.from("players").select("name").eq("league_id", league_id).in("name", allCandidateNames),
                sb.from("players").select("name").neq("league_id", league_id).in("name", allCandidateNames),
              ]);
              localNameSet = new Set((localPs ?? []).map((p: any) => String(p.name).toLowerCase()));
              foreignNameSet = new Set((foreignPs ?? []).map((p: any) => String(p.name).toLowerCase()));
            }
            // Strict league validator: drop cards that mix in the wrong league.
            cards = cards.filter((c) => {
              if (c.team && !allowedTris.has(c.team)) return false;
              if (c.away_team && !allowedTris.has(c.away_team)) return false;
              if (c.home_team && !allowedTris.has(c.home_team)) return false;
              if (c.player_name && allowedNames.size && !allowedNames.has(String(c.player_name).toLowerCase())) {
                return false;
              }
              const text = `${c.headline ?? ""} ${c.body ?? ""}`;
              // Body/headline-level tricode leak: any 2-4 letter code not on tonight's slate.
              const tris = extractTricodes(text);
              if (tris.some((t) => !allowedTris.has(t))) return false;
              // Body/headline-level foreign team name leak (city or nickname).
              if (containsForeignTeamTerm(text)) return false;
              // Body-level name leak: any candidate name that belongs to the
              // OTHER league (and is therefore foreign).
              const candidates = extractCandidateNames(String(c.body ?? ""));
              if (candidates.some((n) => foreignNameSet.has(n.toLowerCase()) && !localNameSet.has(n.toLowerCase()))) {
                return false;
              }
              return true;
            });
            // Force-tag every surviving card with the active league so the
            // cache pollution check has an explicit signal next time, and
            // stamp the current validator version so future runs can detect
            // outdated cached rows.
            cards = cards.map((c) => ({ ...c, league: leagueLabel as "NBA" | "WNBA", _v: VALIDATOR_VERSION } as any));
            // Hydrate player photos when player_id is present
            const pids = cards.map((c) => c.player_id).filter(Boolean) as number[];
            if (pids.length) {
              const { data: ps } = await sb.from("players").select("id, name, team, photo").in("id", pids);
              const m = new Map((ps ?? []).map((p: any) => [p.id, p]));
              cards = cards.map((c) => {
                const p = c.player_id ? m.get(c.player_id) : null;
                return p ? { ...c, player_name: c.player_name ?? p.name, team: c.team ?? p.team, player_photo: p.photo } : c;
              });
            }
          }
        } else {
          console.warn("AI gateway non-OK", aiResp.status, await aiResp.text());
        }
      } catch (e) {
        console.error("AI call failed", e);
      }
    }

    // Fallback deterministic cards if AI failed/disabled
    if (cards.length === 0) {
      const tp = topPerformers[0];
      cards = [
        {
          kind: "form_index",
          headline: tp?.player ? `${tp.player.name} HEATS UP` : "FORM WATCH",
          body: tp?.player ? `${tp.player.name} (${tp.player.team}) led the slate with ${tp.fp.toFixed(1)} FP — momentum building.` : "Track top producers heading into tonight.",
          player_id: tp?.player_id ?? null,
          player_name: tp?.player?.name ?? null,
          team: tp?.player?.team ?? null,
        },
        {
          kind: "matchup_index",
          headline: upcoming[0] ? `${upcoming[0].away_team} @ ${upcoming[0].home_team}` : "MATCHUP RADAR",
          body: upcoming[0] ? "Highest-leverage tilt of the night for fantasy lineups." : "No upcoming games to preview.",
          away_team: upcoming[0]?.away_team ?? null,
          home_team: upcoming[0]?.home_team ?? null,
          game_id: upcoming[0]?.game_id ?? null,
        },
        {
          kind: "schedule_index",
          headline: `${(games ?? []).length} GAMES ON SLATE`,
          body: "Stack rest-advantage teams and watch for back-to-back fades.",
        },
        {
          kind: "market_index",
          headline: "VALUE WATCH",
          body: "Salary-efficient producers carry tonight's edge.",
        },
      ];
      cards = cards.map((c) => ({ ...c, league: leagueLabel as "NBA" | "WNBA", _v: VALIDATOR_VERSION } as any));
    }

    const { error: upErr } = await sb
      .from("court_show_intelligence")
      .upsert({ league_id, gw, day, mode, headline, cards, generated_at: new Date().toISOString() }, { onConflict: "league_id,gw,day" });
    if (upErr) console.error("upsert error", upErr);

    return jsonResp({ cached: false, mode, headline, cards });
  } catch (e) {
    console.error(e);
    return jsonResp({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});