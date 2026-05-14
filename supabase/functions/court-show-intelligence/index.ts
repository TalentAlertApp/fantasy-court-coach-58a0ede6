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

    // Compute live slate mode FIRST so we can detect cache staleness below.
    const { data: gamesPre } = await sb
      .from("schedule_games")
      .select("status")
      .eq("league_id", league_id).eq("gw", gw).eq("day", day);
    const liveFinals = (gamesPre ?? []).filter((g) => (g.status ?? "").toUpperCase().includes("FINAL"));
    const liveUpcoming = (gamesPre ?? []).filter((g) => !(g.status ?? "").toUpperCase().includes("FINAL"));
    const liveMode: "recap" | "matchup" | "mixed" =
      liveFinals.length && liveUpcoming.length ? "mixed" : liveFinals.length ? "recap" : "matchup";

    if (!force) {
      const { data: existing } = await sb
        .from("court_show_intelligence")
        .select("cards, headline, mode, generated_at")
        .eq("league_id", league_id).eq("gw", gw).eq("day", day)
        .maybeSingle();
      if (existing && (existing.cards as any[])?.length) {
        // Detect cross-league pollution (e.g. WNBA row referencing NBA tricodes).
        const cardsArr = (existing.cards as any[]) ?? [];
        const allTricodes = cardsArr.flatMap((c) =>
          [c.team, c.home_team, c.away_team].filter(Boolean).map((t: string) => String(t).toUpperCase())
        );
        const NBA_ONLY = new Set(["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]);
        const WNBA_ONLY = new Set(["ATL","CHI","CON","DAL","IND","LVA","LAS","MIN","NYL","PHX","SEA","WAS","GSV","TOR"]);
        const polluted =
          (leagueCode === "wnba" && allTricodes.some((t) => NBA_ONLY.has(t) && !WNBA_ONLY.has(t))) ||
          (leagueCode === "nba"  && allTricodes.some((t) => WNBA_ONLY.has(t) && !NBA_ONLY.has(t)));
        // Regenerate if the slate mode changed since cache (e.g. games went FINAL
        // and we now need recap angles instead of preview angles).
        const modeStale = existing.mode && existing.mode !== liveMode;
        if (!polluted && !modeStale) {
          return jsonResp({ cached: true, ...existing });
        }
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
- Use ONLY the players, teams and games listed in the user payload — never invent names, tricodes or stats.
- This is the ${leagueLabel}. Do NOT reference players or teams from any other league.
- If the slate has no games or no top performers, write generic ${leagueLabel} preview copy without naming specific players.
- For played games, lean into recap angles; for scheduled games, lean into preview angles; for mixed, blend both.
- Also produce a single short HEADLINE (under 8 words) summarizing the night.`;

      const userPayload = {
        league: leagueLabel,
        gw, day, mode,
        games: (games ?? []).map((g: any) => ({
          game_id: g.game_id, away: g.away_team, home: g.home_team,
          status: g.status, away_pts: g.away_pts, home_pts: g.home_pts, tipoff_utc: g.tipoff_utc,
        })),
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