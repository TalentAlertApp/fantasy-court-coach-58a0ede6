import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";
import { fetchScoringRules, formulaString } from "../_shared/scoring.ts";
import { buildPlayerPack, buildRosterPack, buildMarketPack } from "../_shared/biq.ts";
import { readLeagueCodeFromBody, resolveLeagueId, type LeagueCode } from "../_shared/league.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_NBA")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Scoring formula is injected at request time from the DB rules so this prompt
// does NOT hardcode any per-stat weights. {{SCORING_FORMULA}} is replaced before send.
const SYSTEM_PROMPT_TEMPLATE = `# {{LEAGUE_NAME}} Fantasy Manager AI Coach (OpenAI)

## ROLE
You are coaching a Fantasy {{LEAGUE_NAME}} team using the same scoring rules as Fantasy NBA.
You are the {{LEAGUE_NAME}} Fantasy Manager AI Coach for a single private user.
Produce actionable fantasy decisions: lineup optimization, captain choice, waiver pickups, trade ideas, category optimization, injury monitoring.

## SCORING RULE (GLOBAL CONSTANT)
{{SCORING_FORMULA}}
Assists are 2x. Steals + blocks are 3x each ("stocks" are huge).

## ADVANCED STATS (SEASON-TO-DATE ACCUMULATED TOTALS)
Player records may include shooting splits (fg_pct, tp_pct, ft_pct), offensive rebounding (oreb), ball security (tov), and on-court impact (plus_minus). These are accumulated totals up to the most recent imported game day of the current Regular Season — NOT end-of-season finals. Always normalize counting stats (oreb, tov, plus_minus) to per-game using gp before comparing players, since gp can differ. Use these for waiver/trade reasoning when deciding between similarly-valued players. Higher fg_pct, higher oreb/G, lower tov/G, and positive plus_minus all indicate higher-quality role players.

## POSITIONS
Players only have FC (Front Court) or BC (Back Court). Do not invent other positions.

## HARD CONSTRAINTS (NEVER VIOLATE)
These rules are immutable. Any move suggestion that violates ANY of them MUST be discarded.
- Roster size = 10 (5 starters + 5 bench).
- Roster composition: exactly 5 FC + 5 BC at all times. Every ADD must share the same fc_bc as its DROP.
- Starting 5 must contain >=2 FC and >=2 BC.
- Salary cap (in $M) = team_settings.salary_cap (default 100). After ANY proposed swap:
  total_salary_after = roster_salary_total - drop_salary + add_salary
  total_salary_after MUST be <= salary_cap.
- Maximum 2 players from the same {{LEAGUE_NAME}} team across the full 10-man roster. After each swap:
  team_distribution[add.team] (after applying the corresponding drop) MUST be <= 2.
- 1 captain per gameweek = 2x FP.
The internal payload includes: salary_cap, roster_salary_total, bank_remaining, team_distribution. USE them.

## DATA TRUTH HIERARCHY
1) Internal app data (provided in developer message)
2) Web search tool (real-time {{LEAGUE_NAME}} news)
3) If unavailable, say so and use best-effort reasoning.
NEVER present a number unless from internal payload or web search.

## OUTPUT FORMAT
Return JSON ONLY (no markdown, no prose outside JSON).
JSON must conform to the endpoint's schema exactly.

## CONSTRAINTS
- Roster: 5 starters, 5 bench
- Respect salary_cap, bank_remaining, starter_fc_min, starter_bc_min
- Default constraints if not provided: starters=5, bench=5, fc_min=2, bc_min=2

## RECOMMENDATION PRIORITIES
1) FP5 baseline (short-term form)
2) Stocks impact (STL+BLK weighted 3x)
3) Minutes trend (MPG5 vs MPG)
4) Value5 (FP5 per salary)
5) Role certainty (starter vs bench, injury)
6) Matchup/schedule (from web search)

## RISK FLAGS
Use short tags: injury_questionable, minutes_volatility_high, role_uncertain, schedule_back_to_back, small_sample

## STYLE
Keep content short, direct, decision-focused. No vague adjectives without data.

## SAFETY
Do not fabricate stats, injuries, or schedules. If unsure, say so via notes or risk_flags.

## LEAGUE STATE
Active league: {{LEAGUE_NAME}}.
{{PRESEASON_NOTE}}`;

// Ballers.IQ index guidance — appended to every system prompt so OpenAI
// reasons over the precomputed indexes instead of inventing generic advice.
const BIQ_GUIDANCE = `

## BALLERS.IQ INDEX GUIDANCE
The internal payload includes a "biq" object with precomputed indexes:
- biq.starters[] / biq.bench[]: each player has biq_rating (0-100, label Elite/Strong/Playable/Watch/Risk),
  captain_edge (0-100, label Safe/Upside/Viable/Avoid Captain), schedule (score+label+games),
  salary_eff (score+label Underpriced/Fair/Overpriced/Salary Trap, ratio), form (Form Spike/Minutes Spike/etc.),
  risk (level LOW/MED/HIGH + flags), adj_fp (difficulty-adjusted FP5).
- biq.roster_summary: projected_fp, captain_candidates (sorted), risk_players, value_players, schedule_boost_players, construction_notes.
- biq.market (when present): underpriced/formSpikes/scheduleBoosts/avoid candidates league-wide.
REASONING RULES:
- ALWAYS reference these indexes by label in your bullets (e.g., "Form Spike", "BIQ 82 Strong", "Salary Trap", "Schedule Boost").
- For pick-captain: prefer the highest captain_edge with risk LOW/MED.
- For suggest-transfers: pull adds from biq.market.underpriced or formSpikes; drops from risk_players or salary traps.
- For explain-player: include verdict (START/BENCH/HOLD/WATCH/DROP), echo biq_rating, form_signal, salary_efficiency, risk_level.
- For analyze-roster: ground every strength/weakness in a specific index value.
- For explain-trade: cite fp_delta, biq_delta, salary_delta from biq.deltas.
- Never invent numbers not present in the payload. Keep bullets <=14 words, fantasy-native.`;


const SCHEMA_DESCRIPTIONS: Record<string, string> = {
  "suggest-transfers": `Return JSON: { "moves": [{ "add": number, "drop": number, "cap_after": number, "reason_bullets": string[], "expected_delta": { "proj_fp5": number, "proj_stocks5": number, "proj_ast5": number }, "risk_flags": string[], "confidence": number(0-1) }], "notes": string[] }. moves array: 1-5 items. reason_bullets: 1-6 items each max ~12 words. CRITICAL CONSTRAINTS for every move: (1) ADD player's fc_bc MUST equal DROP player's fc_bc (preserves 5 FC + 5 BC). (2) cap_after = roster_salary_total - drop.salary + add.salary MUST be <= salary_cap. (3) After applying the swap, the count of roster players from add.team MUST be <= 2 (use team_distribution from payload, subtract 1 if drop is from same team). (4) Both add and drop players MUST exist in the players list. Set cap_after as a number (in $M) so the server can verify. If no legal move exists, return moves: [] and explain in notes.`,
  "pick-captain": `Return JSON: { "captain_id": number, "alternatives": [{ "id": number, "why": string }], "reason_bullets": string[], "confidence": number(0-1), "risk_note": string|null }. captain_id must be from starters. Use biq.roster_summary.captain_candidates as the ranking source — top captain_edge with risk LOW/MED wins. alternatives: 0-3 next-best candidates with one-sentence why citing captain_edge label and form.`,
  "explain-player": `Return JSON: { "player_id": number, "summary": string, "verdict": "START"|"BENCH"|"HOLD"|"WATCH"|"DROP", "biq_rating": number, "biq_label": "Elite"|"Strong"|"Playable"|"Watch"|"Risk", "archetype": "Usage Engine"|"Stocks Hunter"|"Glass Cleaner"|"Value Play"|"Form Climber"|"Minutes Monster"|"Safe Floor"|"Ceiling Swing"|"Trap Pick", "form_signal": string, "salary_efficiency": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "risk_flags": string[], "schedule_context": { "next_game": string|null, "games_count": number, "label": "Schedule Boost"|"Schedule Drag"|"Neutral"|"No Game Risk", "warning": string|null }, "why_it_scores": [{ "factor": "rebounds"|"assists"|"stocks"|"minutes"|"usage", "impact": "low"|"medium"|"high"|"very_high", "note": string }], "trend_flags": [{ "type": "fp_up"|"fp_down"|"minutes_up"|"minutes_down"|"stocks_spike", "detail": string }], "recommendation": { "action": "add"|"hold"|"drop", "rationale": string } }. CRITICAL: Describe ONLY the player whose id matches target_player_id. Echo biq_rating, biq_label, archetype, form_signal, salary_efficiency, risk_level, risk_flags, and schedule_context VERBATIM from biq.player (use biq.player.archetype, biq.player.risk.flags, biq.player.schedule.{next_game,games,label,warning}). Verdict rules: Elite/Strong + risk LOW/MED → START; Playable → HOLD; Watch → WATCH; Risk + HIGH risk OR Salary Trap → DROP; schedule No Game Risk → BENCH. BIOGRAPHY: If the target player has a non-null "nationality" field, append exactly one short biographical sentence at the END of "summary" mentioning the player's country (e.g., "Hails from France."). This is biographical context ONLY and MUST NOT influence biq_rating, verdict, archetype, or any score. Do NOT mention nationality if it is null/missing.`,
  "analyze-roster": `Return JSON: { "summary_bullets": string[](1-5), "strengths": string[], "weaknesses": string[], "quick_wins": [{ "title": string, "why": string[], "risk_flags": string[], "confidence": number(0-1) }], "recommended_actions": [{ "type": "PICK_CAPTAIN"|"SUGGEST_TRANSFERS"|"OPTIMIZE_LINEUP", "note": string }], "notes": string[], "biq_summary": { "projected_fp": number, "risk_count": number, "value_count": number } }. Ground every strength/weakness in a specific Ballers.IQ index value (e.g., "BIQ 82 Strong", "Salary Trap", "Form Spike").`,
  "injury-monitor": `Return JSON: { "items": [{ "player_id": number, "status": "OUT"|"Q"|"DTD"|"ACTIVE"|"UNKNOWN", "headline": string|null, "impact": "low"|"medium"|"high", "recommended_move": { "action": "hold"|"bench"|"drop"|"swap", "replacement_targets": [{ "player_id": number, "why": string[], "confidence": number(0-1) }] }, "risk_flags": string[] }], "notes": string[] }`,
  "explain-trade": `Return JSON: { "verdict": "favorable"|"neutral"|"unfavorable", "summary": string, "pros": string[](1-5), "cons": string[](1-5), "risk_flags": string[], "confidence": number(0-1), "fp_delta": number, "value_delta": number, "schedule_impact": string }. Cite biq.deltas.fp_delta and biq.deltas.biq_delta in summary. Each pro/con <=14 words, anchored in a specific BIQ index or per-game number from trade_outs/trade_ins. STRICT LANGUAGE RULES: (1) Use friendly stat labels — write "FG%" not "fg_pct", "3P%" not "tp_pct", "FT%" not "ft_pct", "OREB/G" not "oreb", "TO/G" not "tov", "+/-" not "plus_minus". (2) Compare counting stats (OREB, TOV) ON A PER-GAME BASIS using the *_pg fields provided in trade_outs/trade_ins — never cite raw season totals. (3) Do NOT make claims about "consistency", "stability", or "form" unless backed by an explicit mpg5 vs mpg gap or fp_pg5 vs fp_pg_t gap from the payload. (4) Do NOT write "fp_delta=0", "biq_delta=0", "zero fp delta", or any equivalent — the server will overwrite the summary if deltas are non-zero. (5) Use ONLY trade_outs/trade_ins for player comparisons.`,
};

async function fetchContext(sb: any, teamId: string | undefined, leagueId: string) {
  const [playersRes, rosterRes, scheduleRes, settingsRes] = await Promise.all([
    sb.from("players").select("*").eq("league_id", leagueId).order("fp_pg5", { ascending: false }).limit(200),
    teamId
      ? sb.from("roster").select("*").eq("team_id", teamId)
      : sb.from("roster").select("*"),
    sb.from("schedule_games").select("*").eq("league_id", leagueId).order("gw").order("day").limit(50),
    teamId
      ? sb.from("team_settings").select("*").eq("team_id", teamId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const settings = settingsRes?.data ?? null;
  return {
    players: playersRes.data ?? [],
    roster: rosterRes.data ?? [],
    schedule: scheduleRes.data ?? [],
    settings: {
      salary_cap: Number(settings?.salary_cap ?? 100),
      starter_fc_min: Number(settings?.starter_fc_min ?? 2),
      starter_bc_min: Number(settings?.starter_bc_min ?? 2),
    },
  };
}

function buildPlayerSummary(players: any[], rosterPlayerIds: Set<number>) {
  return players.slice(0, 100).map((p: any) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    fc_bc: p.fc_bc,
    salary: p.salary,
    fp5: p.fp_pg5,
    fp_season: p.fp_pg_t,
    value5: p.value5,
    mpg: p.mpg,
    mpg5: p.mpg5,
    stl5: p.stl5,
    blk5: p.blk5,
    ast5: p.ast5,
    injury: p.injury,
    on_roster: rosterPlayerIds.has(p.id),
    // Season-to-date accumulated advanced totals (compact — only signal-rich fields).
    fg_pct: p.fg_pct ?? null,
    tp_pct: p.tp_pct ?? null,
    ft_pct: p.ft_pct ?? null,
    oreb: p.oreb ?? null,
    tov: p.tov ?? null,
    plus_minus: p.plus_minus ?? null,
    height: p.height ?? null,
    college: p.college ?? null,
    // WNBA-only biographical addon. Surface in summary text only; NEVER
    // factor into biq_rating, verdict, or any score.
    nationality: p.nationality ?? null,
    // Real NBA contract metadata — narrative flavor only, NOT used by Fantasy.
    real_guaranteed_yearly_salary: p.guaranteed_yearly_salary ?? null,
    real_total_contract_value: p.total_contract_value ?? null,
    real_contract_end_year: p.contract_end_year ?? null,
  }));
}

async function callOpenAI(
  action: string,
  contextPayload: string,
  extraInput?: string,
  retryAttempt = false,
  leagueCode: LeagueCode = "nba",
  preseason = false,
): Promise<any> {
  const schemaDesc = SCHEMA_DESCRIPTIONS[action];
  const devMessage = `ACTION: ${action}\n\nRESPONSE SCHEMA:\n${schemaDesc}\n\nINTERNAL DATA:\n${contextPayload}${extraInput ? `\n\nUSER INPUT:\n${extraInput}` : ""}${retryAttempt ? "\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Return JSON only matching the schema above. No markdown. No extra keys. No wrapping in code blocks." : ""}`;

  // Inject scoring formula from DB rules so this prompt is never hardcoded.
  let scoringFormula = "FP = PTS×1 + REB×1 + AST×2 + STL×3 + BLK×3";
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rules = await fetchScoringRules(sb);
    scoringFormula = formulaString(rules);
  } catch (_) { /* fall back to default */ }
  const leagueName = leagueCode === "wnba" ? "WNBA" : "NBA";
  const preseasonNote = preseason
    ? `${leagueName} season has not started yet. Many players have NO game logs, last-5 stats, or fp_pg5 yet — these will be 0 or null. Reason ONLY from salary, position (FC/BC), team, and schedule. Do NOT pretend last-5 stats exist. Acknowledge "pre-season" in notes.`
    : "";
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replaceAll("{{LEAGUE_NAME}}", leagueName)
    .replace("{{SCORING_FORMULA}}", scoringFormula)
    .replace("{{PRESEASON_NOTE}}", preseasonNote) + BIQ_GUIDANCE;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      instructions: systemPrompt,
      input: [{ role: "developer", content: devMessage }],
      text: { format: { type: "json_object" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", response.status, errText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  
  // Extract text output from the response
  let outputText = "";
  if (result.output) {
    for (const item of result.output) {
      if (item.type === "message" && item.content) {
        for (const c of item.content) {
          if (c.type === "output_text") {
            outputText = c.text;
          }
        }
      }
    }
  }

  if (!outputText) {
    throw new Error("No text output from AI");
  }

  // Clean potential markdown wrapping
  let cleaned = outputText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  return JSON.parse(cleaned);
}

function validateShape(action: string, data: any): string[] {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    errors.push("Response is not an object");
    return errors;
  }

  switch (action) {
    case "suggest-transfers":
      if (!Array.isArray(data.moves)) errors.push("Missing moves array");
      if (!Array.isArray(data.notes)) errors.push("Missing notes array");
      break;
    case "pick-captain":
      if (typeof data.captain_id !== "number") errors.push("Missing captain_id");
      if (!Array.isArray(data.reason_bullets)) errors.push("Missing reason_bullets");
      if (typeof data.confidence !== "number") errors.push("Missing confidence");
      break;
    case "explain-player":
      if (typeof data.summary !== "string") errors.push("Missing summary");
      if (!Array.isArray(data.why_it_scores)) errors.push("Missing why_it_scores");
      if (!data.recommendation) errors.push("Missing recommendation");
      break;
    case "analyze-roster":
      if (!Array.isArray(data.summary_bullets)) errors.push("Missing summary_bullets");
      if (!Array.isArray(data.strengths)) errors.push("Missing strengths");
      if (!Array.isArray(data.weaknesses)) errors.push("Missing weaknesses");
      if (!Array.isArray(data.notes)) errors.push("Missing notes");
      break;
    case "injury-monitor":
      if (!Array.isArray(data.items)) errors.push("Missing items array");
      if (!Array.isArray(data.notes)) errors.push("Missing notes array");
      break;
    case "explain-trade":
      if (typeof data.summary !== "string") errors.push("Missing summary");
      if (!Array.isArray(data.pros)) errors.push("Missing pros array");
      if (!Array.isArray(data.cons)) errors.push("Missing cons array");
      if (typeof data.confidence !== "number") errors.push("Missing confidence");
      if (!["favorable", "neutral", "unfavorable"].includes(data.verdict)) {
        errors.push("Invalid or missing verdict");
      }
      break;
  }
  return errors;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action || !SCHEMA_DESCRIPTIONS[action]) {
      return errorResponse("INVALID_ACTION", `Unknown action: ${action}`);
    }

    console.log(`[ai-coach] action=${action} timestamp=${new Date().toISOString()}`);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const leagueCode = readLeagueCodeFromBody(body);
    const leagueId = await resolveLeagueId(sb, leagueCode);
    const { team_id, team_name } = await resolveTeam(req, sb);
    const ctx = await fetchContext(sb, team_id, leagueId);
    const preseason = (ctx.players ?? []).every((p: any) =>
      Number(p.fp_pg5 ?? 0) === 0 && Number(p.fp_pg_t ?? 0) === 0 && Number(p.gp ?? 0) === 0
    );

    const rosterPlayerIds = new Set<number>(ctx.roster.map((r: any) => r.player_id));
    const rosterSlots = ctx.roster.map((r: any) => ({
      player_id: r.player_id,
      slot: r.slot,
      is_captain: r.is_captain,
      gw: r.gw,
      day: r.day,
    }));

    const playerSummary = buildPlayerSummary(ctx.players, rosterPlayerIds);

    // ---- Compute roster financials & team distribution for HARD CONSTRAINTS ----
    // Build a quick lookup of players-by-id from the (possibly truncated) summary,
    // but for roster math we need accurate salary/team for every roster player —
    // refetch any missing ones directly from the DB.
    const rosterIdsArr = Array.from(rosterPlayerIds);
    let rosterPlayerRows: any[] = [];
    if (rosterIdsArr.length > 0) {
      const { data: rp } = await sb
        .from("players")
        .select("id, name, team, fc_bc, salary")
        .in("id", rosterIdsArr);
      rosterPlayerRows = rp ?? [];
    }
    const rosterPlayerById = new Map<number, any>();
    for (const p of rosterPlayerRows) rosterPlayerById.set(p.id, p);

    const roster_salary_total = rosterPlayerRows.reduce(
      (sum, p) => sum + Number(p.salary ?? 0),
      0
    );
    const team_distribution: Record<string, number> = {};
    for (const p of rosterPlayerRows) {
      const tri = String(p.team ?? "").toUpperCase();
      if (!tri) continue;
      team_distribution[tri] = (team_distribution[tri] ?? 0) + 1;
    }
    const salary_cap = ctx.settings.salary_cap;
    const bank_remaining = salary_cap - roster_salary_total;

    // For explain-player, ensure the requested player is always present in the
    // model context (top-100 truncation can otherwise cause hallucinated wrong
    // player). Prepend the targeted player row if missing.
    let finalPlayerSummary = playerSummary;
    let targetPlayerId: number | undefined;
    if (action === "explain-player" && typeof params.player_id === "number") {
      targetPlayerId = params.player_id;
      const alreadyIn = playerSummary.some((p: any) => p.id === targetPlayerId);
      if (!alreadyIn) {
        const { data: targetRow } = await sb
          .from("players")
          .select("*")
          .eq("id", targetPlayerId)
          .maybeSingle();
        if (targetRow) {
          const enriched = buildPlayerSummary([targetRow], rosterPlayerIds);
          finalPlayerSummary = [...enriched, ...playerSummary];
        }
      }
    }

    // For explain-trade, force-include the OUT and IN players in the summary
    // so the model sees full stat blocks for the exact players being traded.
    let tradeOutsDetail: any[] = [];
    let tradeInsDetail: any[] = [];
    if (action === "explain-trade") {
      const outIds: number[] = Array.isArray(params.outs)
        ? params.outs.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];
      const inIds: number[] = Array.isArray(params.ins)
        ? params.ins.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];
      const allTradeIds = Array.from(new Set([...outIds, ...inIds]));
      if (allTradeIds.length > 0) {
        const { data: tradeRows } = await sb
          .from("players")
          .select("*")
          .in("id", allTradeIds);
        const tradeById = new Map<number, any>();
        for (const p of tradeRows ?? []) tradeById.set(Number(p.id), p);
        tradeOutsDetail = outIds
          .map((id) => tradeById.get(id))
          .filter(Boolean)
          .map((p) => buildPlayerSummary([p], rosterPlayerIds)[0]);
        tradeInsDetail = inIds
          .map((id) => tradeById.get(id))
          .filter(Boolean)
          .map((p) => buildPlayerSummary([p], rosterPlayerIds)[0]);
        // Ensure every IN player is also in the broader summary so the model
        // can compare against schedule/context.
        const summaryIds = new Set(playerSummary.map((p: any) => p.id));
        const missing = (tradeRows ?? []).filter((p: any) => !summaryIds.has(Number(p.id)));
        if (missing.length > 0) {
          finalPlayerSummary = [
            ...buildPlayerSummary(missing, rosterPlayerIds),
            ...playerSummary,
          ];
        }
      }
    }

    // ---- Ballers.IQ index pack (precomputed, fed to the model) ----
    const upcomingGames = (ctx.schedule ?? []).filter((g: any) =>
      !/FINAL/i.test(String(g.status ?? "")));
    const rosterPlayerFull = rosterPlayerRows;
    // Reattach signal fields from the broader player table for richer indexes.
    const playerById = new Map<number, any>();
    for (const p of ctx.players) playerById.set(Number(p.id), p);
    const startersFull = ctx.roster
      .filter((r: any) => r.slot === "starter" || r.is_captain)
      .map((r: any) => playerById.get(Number(r.player_id)) ?? rosterPlayerById.get(Number(r.player_id)))
      .filter(Boolean);
    const benchFull = ctx.roster
      .filter((r: any) => r.slot === "bench")
      .map((r: any) => playerById.get(Number(r.player_id)) ?? rosterPlayerById.get(Number(r.player_id)))
      .filter(Boolean);
    const captainSlot = ctx.roster.find((r: any) => r.is_captain);
    const captainIdForBIQ = captainSlot?.player_id ?? null;
    const biqRoster = buildRosterPack(startersFull, benchFull, upcomingGames, captainIdForBIQ);
    const biqMarket = buildMarketPack(ctx.players, rosterPlayerIds, upcomingGames, 6,
      Number(params?.max_cost ?? bank_remaining ?? salary_cap));
    let biqPlayer: any = undefined;
    if (action === "explain-player" && targetPlayerId !== undefined) {
      const tp = playerById.get(Number(targetPlayerId)) ??
        (await sb.from("players").select("*").eq("id", targetPlayerId).maybeSingle()).data;
      if (tp) biqPlayer = buildPlayerPack(tp, upcomingGames);
    }
    let biqDeltas: any = undefined;
    if (action === "explain-trade") {
      const oPacks = tradeOutsDetail.map((p: any) => buildPlayerPack(playerById.get(Number(p.id)) ?? p, upcomingGames));
      const iPacks = tradeInsDetail.map((p: any) => buildPlayerPack(playerById.get(Number(p.id)) ?? p, upcomingGames));
      const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + Number(x[k] ?? 0), 0);
      biqDeltas = {
        outs: oPacks, ins: iPacks,
        deltas: {
          fp_delta: Math.round((sum(iPacks, "adj_fp") - sum(oPacks, "adj_fp")) * 10) / 10,
          biq_delta: Math.round(sum(iPacks, "biq_rating") - sum(oPacks, "biq_rating")),
          salary_delta: Math.round((sum(iPacks, "salary") - sum(oPacks, "salary")) * 10) / 10,
        },
      };
      // Enrich the trade payload with per-game derived stats so the model
      // never reasons about raw season-to-date totals (oreb, tov, plus_minus).
      const enrichPerGame = (rows: any[]) => rows.map((r: any) => {
        const full = playerById.get(Number(r.id)) ?? {};
        const gp = Number(full.gp ?? 0) || 1;
        return {
          ...r,
          gp: Number(full.gp ?? 0),
          oreb_pg: full.oreb != null ? Math.round((Number(full.oreb) / gp) * 10) / 10 : null,
          tov_pg:  full.tov  != null ? Math.round((Number(full.tov)  / gp) * 10) / 10 : null,
          plus_minus_pg: full.plus_minus != null ? Math.round((Number(full.plus_minus) / gp) * 10) / 10 : null,
        };
      });
      tradeOutsDetail = enrichPerGame(tradeOutsDetail);
      tradeInsDetail = enrichPerGame(tradeInsDetail);
    }
    const biq = {
      ...biqRoster,
      market: biqMarket,
      ...(biqPlayer ? { player: biqPlayer } : {}),
      ...(biqDeltas ? biqDeltas : {}),
    };

    const contextPayload = JSON.stringify({
      roster: rosterSlots,
      roster_players: rosterPlayerRows.map((p) => ({
        id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc, salary: p.salary,
      })),
      salary_cap,
      starter_fc_min: ctx.settings.starter_fc_min,
      starter_bc_min: ctx.settings.starter_bc_min,
      roster_salary_total,
      bank_remaining,
      team_distribution,
      players: finalPlayerSummary,
      schedule: ctx.schedule.slice(0, 20),
      params,
      biq,
      ...(targetPlayerId !== undefined ? { target_player_id: targetPlayerId } : {}),
      ...(action === "explain-trade"
        ? { trade_outs: tradeOutsDetail, trade_ins: tradeInsDetail }
        : {}),
    });

    // First attempt
    let aiData: any;
    try {
      aiData = await callOpenAI(action, contextPayload, params.extraInput, false, leagueCode, preseason);
    } catch (e) {
      console.error("[ai-coach] OpenAI call failed:", e);
      return errorResponse("AI_CALL_FAILED", e instanceof Error ? e.message : "AI call failed");
    }

    // Validate
    let validationErrors = validateShape(action, aiData);

    // Retry once if invalid
    if (validationErrors.length > 0) {
      console.log(`[ai-coach] Retry: validation errors: ${validationErrors.join(", ")}`);
      try {
        aiData = await callOpenAI(action, contextPayload, params.extraInput, true, leagueCode, preseason);
        validationErrors = validateShape(action, aiData);
      } catch (e) {
        console.error("[ai-coach] Retry failed:", e);
        return errorResponse("AI_SCHEMA_INVALID", "AI output failed validation after retry", validationErrors.join("; "));
      }
    }

    if (validationErrors.length > 0) {
      return errorResponse("AI_SCHEMA_INVALID", "AI output does not match expected schema", validationErrors.join("; "));
    }

    // Defense in depth: for explain-player, ensure the AI describes the right player.
    if (action === "explain-player" && targetPlayerId !== undefined) {
      if (typeof aiData.player_id === "number" && aiData.player_id !== targetPlayerId) {
        console.error(`[ai-coach] player mismatch: requested=${targetPlayerId} got=${aiData.player_id}`);
        return errorResponse(
          "AI_PLAYER_MISMATCH",
          `AI returned a different player than requested (requested ${targetPlayerId}, got ${aiData.player_id})`
        );
      }
      // Force the correct id onto the response so downstream UI can rely on it.
      aiData.player_id = targetPlayerId;
    }

    // Defense in depth: for explain-trade, splice the server-computed deltas
    // into the response so the UI always shows authoritative numbers (the
    // model has been observed claiming "0 FP delta" while metrics differ).
    if (action === "explain-trade" && biqDeltas?.deltas) {
      const d = biqDeltas.deltas;
      aiData.fp_delta = d.fp_delta;
      aiData.biq_delta = d.biq_delta;
      aiData.salary_delta = d.salary_delta;
      const sign = (n: number) => (n >= 0 ? "+" : "");
      const deterministicSummary = `FP ${sign(d.fp_delta)}${d.fp_delta.toFixed(1)} · BIQ ${sign(d.biq_delta)}${d.biq_delta.toFixed(0)} · Salary ${sign(d.salary_delta)}$${d.salary_delta.toFixed(1)}M.`;
      // Always overwrite the headline with deterministic deltas so the summary
      // never contradicts the metric table.
      aiData.summary = deterministicSummary;
      // Recompute verdict deterministically from deltas.
      const fpUp = d.fp_delta > 0.1, fpDn = d.fp_delta < -0.1;
      const biqUp = d.biq_delta > 1, biqDn = d.biq_delta < -1;
      let verdict: "favorable" | "neutral" | "unfavorable" = "neutral";
      if ((fpUp && !biqDn) || (biqUp && !fpDn)) verdict = "favorable";
      else if ((fpDn && !biqUp) || (biqDn && !fpUp)) verdict = "unfavorable";
      aiData.verdict = verdict;
      // Sanitize pros/cons: drop "fp_delta=0"/"biq_delta=0" claims, swap raw
      // stat keys for friendly labels.
      const friendly = (s: string) => String(s)
        .replace(/fg_pct/gi, "FG%")
        .replace(/tp_pct/gi, "3P%")
        .replace(/ft_pct/gi, "FT%")
        .replace(/\boreb\b/gi, "OREB/G")
        .replace(/\btov\b/gi, "TO/G")
        .replace(/plus[_\s]?minus/gi, "+/-");
      const dropZero = (s: string) =>
        /(fp|biq)[_\s-]?delta\s*=?\s*0\b/i.test(s) ||
        /\bzero\s+(fp|biq)\b/i.test(s) ||
        /\bno\s+immediate\s+fp\s+gain\b/i.test(s);
      const cleanList = (arr: any) =>
        Array.isArray(arr) ? arr.map(String).filter((s) => !dropZero(s)).map(friendly) : arr;
      aiData.pros = cleanList(aiData.pros);
      aiData.cons = cleanList(aiData.cons);
    }

    // Defense in depth: for suggest-transfers, drop any move that violates HARD CONSTRAINTS.
    if (action === "suggest-transfers" && Array.isArray(aiData.moves)) {
      const playerById = new Map<number, any>();
      for (const p of ctx.players) playerById.set(p.id, p);
      // Make sure roster players are also lookupable
      for (const p of rosterPlayerRows) if (!playerById.has(p.id)) playerById.set(p.id, p);

      const violations: string[] = [];
      const validMoves = aiData.moves.filter((m: any) => {
        const addP = playerById.get(Number(m?.add));
        const dropP = playerById.get(Number(m?.drop));
        if (!addP || !dropP) {
          violations.push(`Unknown player(s) in move add=${m?.add} drop=${m?.drop}`);
          return false;
        }
        if (!rosterPlayerIds.has(Number(m.drop))) {
          violations.push(`Drop ${dropP.name} not on roster`);
          return false;
        }
        if (rosterPlayerIds.has(Number(m.add))) {
          violations.push(`Add ${addP.name} already on roster`);
          return false;
        }
        if (addP.fc_bc !== dropP.fc_bc) {
          violations.push(`FC/BC mismatch: ADD ${addP.name} (${addP.fc_bc}) vs DROP ${dropP.name} (${dropP.fc_bc})`);
          return false;
        }
        const capAfter =
          roster_salary_total - Number(dropP.salary ?? 0) + Number(addP.salary ?? 0);
        if (capAfter > salary_cap + 1e-6) {
          violations.push(
            `Cap exceeded: ${addP.name}↔${dropP.name} → $${capAfter.toFixed(1)}M > $${salary_cap}M`
          );
          return false;
        }
        const addTri = String(addP.team ?? "").toUpperCase();
        const dropTri = String(dropP.team ?? "").toUpperCase();
        const addTeamCountAfter =
          (team_distribution[addTri] ?? 0) - (addTri === dropTri ? 1 : 0) + 1;
        if (addTeamCountAfter > 2) {
          violations.push(
            `Max-2-per-team violated: ${addP.name} (${addTri}) would make ${addTeamCountAfter} on roster`
          );
          return false;
        }
        // Stamp the verified cap_after for the UI
        m.cap_after = Number(capAfter.toFixed(2));
        return true;
      });

      if (validMoves.length !== aiData.moves.length) {
        console.warn(`[ai-coach] suggest-transfers dropped ${aiData.moves.length - validMoves.length} invalid move(s):`, violations);
      }
      aiData.moves = validMoves;
      if (validMoves.length === 0) {
        aiData.notes = Array.isArray(aiData.notes) ? aiData.notes : [];
        aiData.notes.unshift(
          `No legal moves found within constraints (cap $${salary_cap}M, max 2 per ${leagueCode === "wnba" ? "WNBA" : "NBA"} team, FC↔FC / BC↔BC). Bank remaining: $${bank_remaining.toFixed(1)}M.`
        );
        if (violations.length) aiData.notes.push(`Rejected: ${violations.slice(0, 3).join("; ")}`);
      }
    }

    console.log(`[ai-coach] action=${action} success`);
    return okResponse(aiData);
  } catch (e) {
    console.error("[ai-coach] Error:", e);
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
