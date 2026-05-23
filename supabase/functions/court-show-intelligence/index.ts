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
const VALIDATOR_VERSION = 7;

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
  subtext?: string | null;
  stats?: { label: string; value: string }[];
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

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
    const leagueLabel =
      leagueCode === "wnba" ? "WNBA"
      : leagueCode === "euroleague" ? "EuroLeague"
      : "NBA";

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

    const currentTable = leagueCode === "wnba" ? WNBA_TEAMS : NBA_TEAMS;
    const foreignTable = leagueCode === "wnba" ? NBA_TEAMS : WNBA_TEAMS;
    // The blocklist is computed AFTER we resolve tonight's slate tricodes
    // (see `buildForeignTermChecker` below) so we can also flag current-league
    // teams that aren't actually playing tonight (off-slate leaks).
    let containsForeignTeamTerm: (text: string) => boolean = () => false;
    const teamTerms = (t: { city: string; nickname: string }) => {
      const terms = [t.city, t.nickname, `${t.city} ${t.nickname}`];
      const nicknameParts = t.nickname.split(/\s+/).filter(Boolean);
      if (nicknameParts.length > 1) terms.push(nicknameParts[nicknameParts.length - 1]);
      return terms;
    };
    const buildForeignTermChecker = (allowedTris: Set<string>) => {
      const terms: string[] = [];
      // Current-league teams are only legal if their tricode is on tonight's
      // slate. This blocks off-slate WNBA teams without blocking slate teams.
      for (const t of currentTable) {
        if (allowedTris.has(t.tri.toUpperCase())) continue;
        for (const term of teamTerms(t)) {
          if (term && term.length >= 3) terms.push(term);
        }
      }
      const onSlateTerms = new Set<string>();
      for (const t of currentTable) {
        if (!allowedTris.has(t.tri.toUpperCase())) continue;
        onSlateTerms.add(t.city.toLowerCase());
        onSlateTerms.add(t.nickname.toLowerCase());
        if (t.nickname.includes(" ")) onSlateTerms.add(t.nickname.split(/\s+/).pop()!.toLowerCase());
        onSlateTerms.add(`${t.city} ${t.nickname}`.toLowerCase());
      }
      // Foreign-league nicknames/full names are always illegal, even when the
      // tricode overlaps with a current-league team (WNBA POR ≠ NBA POR).
      // Foreign cities are illegal unless the current slate has the same city.
      for (const t of foreignTable) {
        const city = t.city.toLowerCase();
        if (!onSlateTerms.has(city)) terms.push(t.city);
        for (const term of teamTerms(t).filter((term) => term !== t.city)) terms.push(term);
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
        // Ballers.IQ slides are defined as 4 cards; partial rows usually mean
        // prior validation dropped polluted model output and must be rebuilt.
        const incompleteCards = cardsArr.length < 4;
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
        if (!polluted && !modeStale && !offSlate && !unknownPlayer && !wrongLeague && !versionStale && !missingLeagueTag && !foreignTeamLeak && !incompleteCards) {
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
    type SlatePlayer = { id: number; name: string; team: string; salary: number; fp5: number; mpg5: number };
    const rosters: { team: string; players: { id: number; name: string }[] }[] = [];
    const slatePlayers: SlatePlayer[] = [];
    const topByTeam = new Map<string, SlatePlayer>();
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
        .select("id, name, team, salary, fp_pg5, mpg5")
        .eq("league_id", league_id)
        .in("team", slateTricodes);
      const byTeam = new Map<string, { id: number; name: string; salary: number; fp5: number; mpg5: number }[]>();
      for (const p of rosterPlayers ?? []) {
        const t = String(p.team ?? "").toUpperCase();
        if (!t) continue;
        if (!byTeam.has(t)) byTeam.set(t, []);
        byTeam.get(t)!.push({
          id: p.id as number,
          name: p.name as string,
          salary: Number((p as any).salary ?? 0),
          fp5: Number((p as any).fp_pg5 ?? 0),
          mpg5: Number((p as any).mpg5 ?? 0),
        });
      }
      for (const t of slateTricodes) {
        const tri = t.toUpperCase();
        const teamPlayers = byTeam.get(tri) ?? [];
        const list = teamPlayers.slice()
          .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
          .slice(0, 6)
          .map((p) => ({ id: p.id, name: p.name }));
        rosters.push({ team: t, players: list });
        for (const p of list) allowedNames.add(p.name.toLowerCase());
        for (const p of teamPlayers) {
          slatePlayers.push({ id: p.id, name: p.name, team: tri, salary: p.salary, fp5: p.fp5, mpg5: p.mpg5 });
        }
        const topFp = teamPlayers.slice().sort((a, b) => b.fp5 - a.fp5)[0];
        if (topFp) topByTeam.set(tri, { id: topFp.id, name: topFp.name, team: tri, salary: topFp.salary, fp5: topFp.fp5, mpg5: topFp.mpg5 });
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

    // ── Slate-level metrics for card stat strips (league-scoped) ──
    const earliestTipLisbon = earliestTipoff
      ? lisbonFmt(earliestTipoff, { hour: "2-digit", minute: "2-digit", hour12: false })
      : null;
    // Back-to-back teams: teams playing tonight that also played yesterday.
    let b2bTeams = 0;
    try {
      const { data: prevGames } = await sb
        .from("schedule_games")
        .select("home_team, away_team")
        .eq("league_id", league_id).eq("gw", gw).eq("day", day - 1);
      const prevTris = new Set((prevGames ?? []).flatMap((g: any) => [g.home_team, g.away_team]).filter(Boolean).map((t: string) => String(t).toUpperCase()));
      b2bTeams = Array.from(allowedTris).filter((t) => prevTris.has(t)).length;
    } catch (_) { /* ignore */ }
    // Salary 7d delta map (slate-scoped).
    const salaryDelta = new Map<number, number>();
    try {
      const { data: movers } = await sb.rpc("get_salary_movers", { _days: 7, _league_id: league_id });
      for (const m of (movers ?? []) as any[]) salaryDelta.set(Number(m.player_id), Number(m.total_delta ?? 0));
    } catch (_) { /* ignore */ }
    // Top value (best $/FP) on slate.
    const valuePicks = slatePlayers
      .filter((p) => p.fp5 > 0 && p.salary > 0 && p.mpg5 >= 10)
      .map((p) => ({ ...p, dpf: p.salary / p.fp5 }))
      .sort((a, b) => a.dpf - b.dpf);
    const topValue = valuePicks[0] ?? null;
    // Top FP5 on slate (anchor for form_index).
    const topForm = slatePlayers.slice().sort((a, b) => b.fp5 - a.fp5)[0] ?? null;

    const fmtMoney = (n: number) => {
      const a = Math.abs(n);
      if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (a >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
      if (a >= 10) return `$${n.toFixed(0)}`;
      if (a >= 1) return `$${n.toFixed(1)}`;
      return `$${n.toFixed(2)}`;
    };
    const fmtDelta = (n: number) => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n)).replace("$", "$")}`;

    const buildStatsForKind = (kind: AIIndexKind, c: AICard): { label: string; value: string }[] => {
      const stats: { label: string; value: string }[] = [];
      if (kind === "matchup_index") {
        const away = c.away_team ?? null;
        const home = c.home_team ?? null;
        const ta = away ? topByTeam.get(away) : null;
        const th = home ? topByTeam.get(home) : null;
        if (earliestTipLisbon) stats.push({ label: "Tip · Lisbon", value: earliestTipLisbon });
        if (ta) stats.push({ label: `Top ${away}`, value: `${ta.fp5.toFixed(1)} FP5` });
        if (th) stats.push({ label: `Top ${home}`, value: `${th.fp5.toFixed(1)} FP5` });
        if (stats.length < 3) stats.push({ label: "Games", value: String((games ?? []).length) });
      } else if (kind === "form_index") {
        const anchorId = c.player_id ?? topForm?.id ?? null;
        const anchor = slatePlayers.find((p) => p.id === anchorId) ?? topForm;
        if (anchor) {
          stats.push({ label: "FP5", value: anchor.fp5.toFixed(1) });
          stats.push({ label: "MPG5", value: anchor.mpg5.toFixed(0) });
          stats.push({ label: "Salary", value: fmtMoney(anchor.salary) });
          if (anchor.fp5 > 0) stats.push({ label: "$/FP", value: fmtMoney(anchor.salary / anchor.fp5) });
        }
      } else if (kind === "schedule_index") {
        stats.push({ label: "Games", value: String((games ?? []).length) });
        stats.push({ label: "B2B teams", value: String(b2bTeams) });
        stats.push({ label: "Teams", value: String(allowedTris.size) });
        if (earliestTipLisbon) stats.push({ label: "First tip", value: earliestTipLisbon });
      } else if (kind === "market_index") {
        const anchorId = c.player_id ?? topValue?.id ?? null;
        const anchor = slatePlayers.find((p) => p.id === anchorId) ?? topValue;
        if (anchor) {
          stats.push({ label: "Salary", value: fmtMoney(anchor.salary) });
          stats.push({ label: "FP5", value: anchor.fp5.toFixed(1) });
          if (anchor.fp5 > 0) stats.push({ label: "$/FP", value: fmtMoney(anchor.salary / anchor.fp5) });
          const d = salaryDelta.get(anchor.id) ?? 0;
          if (d !== 0) stats.push({ label: "Δ 7d", value: fmtDelta(d) });
        }
      } else if (kind === "role_stability") {
        stats.push({ label: "Teams", value: String(allowedTris.size) });
        stats.push({ label: "B2B", value: String(b2bTeams) });
        if (earliestTipLisbon) stats.push({ label: "First tip", value: earliestTipLisbon });
      }
      return stats.slice(0, 4);
    };

    const attachStats = (card: AICard): AICard => {
      const stats = buildStatsForKind(card.kind, card);
      // Strip any stat value that would smuggle in a foreign team term.
      const safe = stats.filter((s) => !containsForeignTeamTerm(`${s.label} ${s.value}`));
      return { ...card, stats: safe.length ? safe : undefined };
    };

    let cards: AICard[] = [];
    let headline = "GAMENIGHT INTELLIGENCE";

    if (LOVABLE_API_KEY) {
      const sysPrompt = `You are Ballers.IQ — a fantasy basketball editorial AI for the ${leagueLabel}.
Generate exactly 4 "index" cards for tonight's ${leagueLabel} slate. Pick 4 DIFFERENT "kind" values from: form_index, matchup_index, schedule_index, market_index, role_stability.
Voice: confident editorial analyst, like a fantasy column intro. NO stat dashboards, NO stat bullets.
TENSE RULES — CRITICAL:
- mode = "recap" → ALL games on this slate are FINAL. Write in PAST TENSE: "tipped at", "led", "posted", "delivered", "finished as", "closed the night". NEVER write "tips at", "tonight's", "projects as", "should", "will", "lock in", "fade", "free cap room". This is a recap of a slate that is already over.
- mode = "matchup" → all games are upcoming. Write in PRESENT/FUTURE tense (preview voice).
- mode = "mixed" → some games are FINAL, some upcoming. Past tense for anything tied to a FINAL game/player; present/future for upcoming. Check "playedGames" vs "upcomingGames" in the payload.
- The payload's "mode" field is authoritative — read it first and pick the voice before drafting any sentence.
Rules:
- Headlines: under 9 words, all caps OK, NO emojis.
- Bodies: 2 to 3 full sentences (45–70 words total) of natural prose. Weave numbers INTO the sentences (e.g. "Caitlin Clark is averaging 52.3 FP over her last five, fueled by 31 minutes a night and a slate-best $0.13 per fantasy point"). Do NOT use bullet points, em-dash lists, slashes between stats, or strings like "FP5 / MPG5 / Salary". Numbers should read as if a human wrote them.
- Each of the 4 cards MUST cover a DISTINCT angle. Do not repeat the same fact, player, or storyline across cards:
   • matchup_index → tonight's headline game: stakes, pace, tipoff, why fantasy managers should care.
   • form_index → the slate's hottest individual anchor and what's driving the heater.
   • schedule_index → slate shape: game count, back-to-back teams, density, weekday, tipoff windows.
   • market_index → salary efficiency or salary movement: the best $/FP or biggest 7-day mover.
   • role_stability → minutes/role certainty if you use it instead of one above.
- Reference players by name plus team tricode in the prose (e.g. "Caitlin Clark (IND)").
- HARD RULE: Every player you name MUST appear in the user payload's "rosters" array, with the exact same name and assigned to the exact same team tricode. Never name a player who is not in "rosters".
- Never recall players from training data. If you cannot ground a card in "rosters"/"games", write generic copy without naming any player.
- This is the ${leagueLabel}. Do NOT reference players or teams from any other league. Tag every card you emit with "league": "${leagueLabel}".
- HARD RULE: You may ONLY reference team tricodes present in user payload's "slateTeams". Do NOT mention any other team tricode anywhere in the headline or body.
- HARD RULE: You may ONLY reference teams by city, nickname, or full name that appear in user payload's "slateTeams" (city/nickname/fullName fields). Never reference any other team's city or nickname — e.g. on a WNBA slate, never write "Trail Blazers", "Bulls", "Timberwolves", "Portland", "Toronto", or any NBA team name.
- HARD RULE: When you need to reference what day this slate is, use exactly user payload's "slateWeekday" (e.g. "${slateWeekday ?? "Friday"} slate"). Do NOT infer or invent a different weekday.
- If the slate has no games or no top performers, write generic ${leagueLabel} preview copy without naming specific players.
- For played games, lean into recap angles (who won the night, who outperformed salary, who closed as the form leader); for scheduled games, lean into preview angles (who to captain, which game has the highest leverage, who's the best value).
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
        playedGames: finalGames.map((g: any) => ({
          game_id: g.game_id, away: g.away_team, home: g.home_team,
          away_pts: g.away_pts, home_pts: g.home_pts,
        })),
        upcomingGames: upcoming.map((g: any) => ({
          game_id: g.game_id, away: g.away_team, home: g.home_team, tipoff_utc: g.tipoff_utc,
        })),
        rosters,
        topPerformers: topPerformers.map((t: any) => ({
          player_id: t.player_id,
          name: t.player?.name, team: t.player?.team,
          fp: t.fp, pts: t.pts, reb: t.reb, ast: t.ast, stl: t.stl, blk: t.blk, mp: t.mp,
        })),
        // Grounding numbers — the model MUST weave these into the prose.
        slateMetrics: {
          gamesCount: (games ?? []).length,
          teamsCount: allowedTris.size,
          b2bTeams,
          earliestTipLisbon,
          topForm: topForm ? { name: topForm.name, team: topForm.team, fp5: round1(topForm.fp5), mpg5: Math.round(topForm.mpg5), salary: topForm.salary } : null,
          topValue: topValue ? { name: topValue.name, team: topValue.team, fp5: round1(topValue.fp5), salary: topValue.salary, dollarsPerFp: round2(topValue.salary / topValue.fp5) } : null,
          topByTeam: Array.from(topByTeam.entries()).slice(0, 6).map(([tri, p]) => ({ tri, name: p.name, fp5: round1(p.fp5) })),
          topSalaryMover: (() => {
            let best: { id: number; delta: number } | null = null;
            for (const [id, d] of salaryDelta) {
              if (!best || Math.abs(d) > Math.abs(best.delta)) best = { id, delta: d };
            }
            if (!best) return null;
            const p = slatePlayers.find((sp) => sp.id === best!.id);
            return p ? { name: p.name, team: p.team, delta7d: Math.round(best.delta) } : null;
          })(),
        },
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
              body: typeof c.body === "string" ? c.body.replace(/[{}]/g, "").slice(0, 520) : "",
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
              // Same-league but off-roster/off-slate name leak: if the model
              // mentions a real current-league player in copy, that player must
              // be one of the allowed roster names for tonight's slate.
              if (allowedNames.size && candidates.some((n) =>
                localNameSet.has(n.toLowerCase()) && !allowedNames.has(n.toLowerCase())
              )) {
                return false;
              }
              return true;
            });
            // Force-tag every surviving card with the active league so the
            // cache pollution check has an explicit signal next time, and
            // stamp the current validator version so future runs can detect
            // outdated cached rows.
            cards = cards.map((c) => ({ ...c, league: leagueLabel as "NBA" | "WNBA", _v: VALIDATOR_VERSION } as any));
            const seenKinds = new Set<string>();
            cards = cards.filter((c) => {
              if (seenKinds.has(c.kind)) return false;
              seenKinds.add(c.kind);
              return true;
            });
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
            // Editorial mode: cards are prose-only, no stat strip.
            cards = cards.map((c) => ({ ...c, stats: undefined, subtext: undefined }));
          }
        } else {
          console.warn("AI gateway non-OK", aiResp.status, await aiResp.text());
        }
      } catch (e) {
        console.error("AI call failed", e);
      }
    }

    // Backfill deterministic, slate-safe cards if AI failed or if strict
    // validation removed polluted cards. This keeps the slide complete without
    // ever reusing unsafe model output.
    if (cards.length < 4) {
      const usedKinds = new Set(cards.map((c) => c.kind));
      const addCard = (card: AICard) => {
        if (cards.length >= 4 || usedKinds.has(card.kind)) return;
        usedKinds.add(card.kind);
        cards.push({ ...card, league: leagueLabel as "NBA" | "WNBA", _v: VALIDATOR_VERSION } as any);
      };
      const slateLabel = slateTeams.slice(0, 2).map((t) => t.tri).join(" @ ") || leagueLabel;
      const isRecap = mode === "recap";
      const headlineGame = isRecap ? (finalGames[0] ?? upcoming[0] ?? null) : (upcoming[0] ?? finalGames[0] ?? null);
      const awayTop = headlineGame ? topByTeam.get(String(headlineGame.away_team).toUpperCase()) : null;
      const homeTop = headlineGame ? topByTeam.get(String(headlineGame.home_team).toUpperCase()) : null;
      const tipStr = earliestTipLisbon
        ? (isRecap ? `tipped at ${earliestTipLisbon} Lisbon` : `tips at ${earliestTipLisbon} Lisbon`)
        : (isRecap ? "wrapped up last night" : "tips tonight");
      const scoreStr = isRecap && headlineGame && (headlineGame.away_pts != null || headlineGame.home_pts != null)
        ? ` and finished ${headlineGame.away_pts ?? "?"}–${headlineGame.home_pts ?? "?"}`
        : "";
      const matchupBody = headlineGame
        ? (isRecap
          ? `${headlineGame.away_team} at ${headlineGame.home_team} ${tipStr}${scoreStr} as the highest-leverage spot of the ${slateWeekday ?? "night"} board for ${leagueLabel} managers.${
              awayTop && homeTop
                ? ` ${awayTop.name} (${awayTop.team}) and ${homeTop.name} (${homeTop.team}) led the two-way star power, with rolling FP5s of ${round1(awayTop.fp5)} and ${round1(homeTop.fp5)}.`
                : awayTop
                  ? ` ${awayTop.name} (${awayTop.team}) anchored the visitors at ${round1(awayTop.fp5)} FP5 heading in.`
                  : homeTop
                    ? ` ${homeTop.name} (${homeTop.team}) carried the hosts at ${round1(homeTop.fp5)} FP5 heading in.`
                    : ""
            }`
          : `${headlineGame.away_team} at ${headlineGame.home_team} ${tipStr} and projects as the highest-leverage spot for ${leagueLabel} managers.${
              awayTop && homeTop
                ? ` ${awayTop.name} (${awayTop.team}, ${round1(awayTop.fp5)} FP5) and ${homeTop.name} (${homeTop.team}, ${round1(homeTop.fp5)} FP5) headline the two-way star power.`
                : awayTop
                  ? ` ${awayTop.name} (${awayTop.team}) anchors the visitors at ${round1(awayTop.fp5)} FP5 heading in.`
                  : homeTop
                    ? ` ${homeTop.name} (${homeTop.team}) carries the hosts at ${round1(homeTop.fp5)} FP5 heading in.`
                    : ""
            }`)
        : (isRecap
          ? `No ${leagueLabel} games on the ${slateWeekday ?? "night"} board to recap.`
          : `Nothing on the ${leagueLabel} board tonight — circle back when the next slate locks in.`);
      addCard({
        kind: "matchup_index",
        headline: headlineGame ? `${headlineGame.away_team} @ ${headlineGame.home_team}` : "MATCHUP RADAR",
        body: matchupBody,
        away_team: headlineGame?.away_team ?? null,
        home_team: headlineGame?.home_team ?? null,
        game_id: headlineGame?.game_id ?? null,
      });
      const anchor = topPerformers[0]?.player
        ? { name: topPerformers[0].player.name, team: topPerformers[0].player.team, id: topPerformers[0].player_id, fp5: topPerformers[0].fp, mpg5: 0, salary: 0 }
        : topForm;
      const formBody = anchor
        ? (isRecap
          ? `${anchor.name} (${anchor.team}) closed the ${slateWeekday ?? ""} ${leagueLabel} slate as the form leader, posting ${round1(anchor.fp5)} FP across the last five played games.${
              anchor.mpg5 ? ` Minutes settled around ${Math.round(anchor.mpg5)} a night, keeping the workload trend firmly in their favor.` : ""
            }`
          : `${anchor.name} (${anchor.team}) headlines tonight's ${leagueLabel} form board, posting ${round1(anchor.fp5)} FP across the last five.${
              anchor.mpg5 ? ` Minutes are holding around ${Math.round(anchor.mpg5)} a night, so the runway for another anchor line is wide open.` : ""
            }`)
        : (isRecap
          ? `No standout form story emerged from the ${slateLabel} slate — production stayed evenly spread.`
          : `No clear hot hand yet on tonight's ${slateLabel} slate — let opening rotations dictate where the points concentrate.`);
      addCard({
        kind: "form_index",
        headline: anchor ? `${anchor.name} LEADS FORM` : "FORM WATCH",
        body: formBody,
        player_id: topPerformers[0]?.player_id ?? topForm?.id ?? null,
        player_name: anchor?.name ?? null,
        team: anchor?.team ?? null,
      });
      const scheduleBody = isRecap
        ? `${(games ?? []).length} ${leagueLabel} games played on ${slateWeekday ?? "this"} night, spanning ${allowedTris.size} teams${
            earliestTipLisbon ? ` with first tip at ${earliestTipLisbon} Lisbon` : ""
          }. ${b2bTeams > 0 ? `${b2bTeams} team${b2bTeams === 1 ? "" : "s"} were on a back-to-back, and the fatigue showed in the rotations.` : "No back-to-backs in the mix — minutes ran clean across the board."}`
        : `${(games ?? []).length} ${leagueLabel} games tip on tonight's ${slateWeekday ?? "slate"}, spanning ${allowedTris.size} teams${
            earliestTipLisbon ? ` with first tip at ${earliestTipLisbon} Lisbon` : ""
          }. ${b2bTeams > 0 ? `${b2bTeams} team${b2bTeams === 1 ? "" : "s"} are on a back-to-back, so factor in fatigue before locking captains.` : "No back-to-backs to fade — minutes should run clean across the board."}`;
      addCard({
        kind: "schedule_index",
        headline: `${(games ?? []).length} GAMES ON SLATE`,
        body: scheduleBody,
      });
      const marketBody = topValue
        ? (isRecap
          ? `${topValue.name} (${topValue.team}) finished as the slate's best ${leagueLabel} value at ${round2(topValue.salary / topValue.fp5)} dollars per fantasy point, anchored by a ${round1(topValue.fp5)} FP5 on a very manageable salary. Managers who rolled with that anchor freed up real cap room at the top.`
          : `${topValue.name} (${topValue.team}) is the slate's best ${leagueLabel} value at ${round2(topValue.salary / topValue.fp5)} dollars per fantasy point, sitting at ${round1(topValue.fp5)} FP5 on a manageable salary. That combination makes him the easiest way to free cap room for a true captain.`)
        : (isRecap
          ? `Salary-efficient ${leagueLabel} producers carried the night's edge — mid-tier anchors out-earned the top of the board.`
          : `Salary-efficient ${leagueLabel} producers carry tonight's edge — lean on mid-tier anchors before paying up at the top of the board.`);
      addCard({
        kind: "market_index",
        headline: topValue ? `${topValue.name} BEST $/FP` : "VALUE WATCH",
        body: marketBody,
        player_id: topValue?.id ?? null,
        player_name: topValue?.name ?? null,
        team: topValue?.team ?? null,
      });
      addCard({
        kind: "role_stability",
        headline: "ROTATION CHECK",
        body: isRecap
          ? `Confirmed starters outperformed their salary on the ${slateWeekday ?? "night"} ${leagueLabel} slate — the rotations that held minutes paid off cleanly.`
          : `Prioritize secure ${leagueLabel} minutes and wait on late inactives — confirmed starters tend to outperform their salary on ${slateWeekday ?? "this"}-night slates.`,
      });
      // Hydrate photos + stats for backfilled cards.
      const bfPids = cards.map((c) => c.player_id).filter(Boolean) as number[];
      if (bfPids.length) {
        const { data: ps } = await sb.from("players").select("id, photo").in("id", bfPids);
        const m = new Map((ps ?? []).map((p: any) => [p.id, p.photo]));
        cards = cards.map((c) => c.player_id ? { ...c, player_photo: c.player_photo ?? m.get(c.player_id) ?? null } : c);
      }
      cards = cards.map((c) => ({ ...c, stats: undefined, subtext: undefined }));
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
      cards = cards.map((c) => ({ ...c, stats: undefined, subtext: undefined }));
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