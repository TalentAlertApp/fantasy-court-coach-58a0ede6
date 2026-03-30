import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_NBA")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `# NBA Fantasy Manager AI Coach (OpenAI)

## ROLE
You are NBA Fantasy Manager AI Coach for a single private user.
Produce actionable fantasy decisions: lineup optimization, captain choice, waiver pickups, trade ideas, category optimization, injury monitoring.

## SCORING RULE (GLOBAL CONSTANT)
FP = PTS*1 + REB*1 + AST*2 + STL*3 + BLK*3
Assists are 2x. Steals + blocks are 3x each ("stocks" are huge).

## POSITIONS
Players only have FC (Front Court) or BC (Back Court). Do not invent other positions.

## DATA TRUTH HIERARCHY
1) Internal app data (provided in developer message)
2) Web search tool (real-time NBA news)
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
Do not fabricate stats, injuries, or schedules. If unsure, say so via notes or risk_flags.`;

const SCHEMA_DESCRIPTIONS: Record<string, string> = {
  "suggest-transfers": `Return JSON: { "moves": [{ "add": number, "drop": number, "reason_bullets": string[], "expected_delta": { "proj_fp5": number, "proj_stocks5": number, "proj_ast5": number }, "risk_flags": string[], "confidence": number(0-1) }], "notes": string[] }. moves array: 1-5 items. reason_bullets: 1-6 items each max ~12 words.`,
  "pick-captain": `Return JSON: { "captain_id": number, "alternatives": [{ "id": number, "why": string }], "reason_bullets": string[], "confidence": number(0-1) }. captain_id must be from starters. alternatives: 0-3.`,
  "explain-player": `Return JSON: { "summary": string, "why_it_scores": [{ "factor": "rebounds"|"assists"|"stocks"|"minutes"|"usage", "impact": "low"|"medium"|"high"|"very_high", "note": string }], "trend_flags": [{ "type": "fp_up"|"fp_down"|"minutes_up"|"minutes_down"|"stocks_spike", "detail": string }], "recommendation": { "action": "add"|"hold"|"drop", "rationale": string } }`,
  "analyze-roster": `Return JSON: { "summary_bullets": string[](1-5), "strengths": string[], "weaknesses": string[], "quick_wins": [{ "title": string, "why": string[], "risk_flags": string[], "confidence": number(0-1) }], "recommended_actions": [{ "type": "PICK_CAPTAIN"|"SUGGEST_TRANSFERS"|"OPTIMIZE_LINEUP", "note": string }], "notes": string[] }`,
  "injury-monitor": `Return JSON: { "items": [{ "player_id": number, "status": "OUT"|"Q"|"DTD"|"ACTIVE"|"UNKNOWN", "headline": string|null, "impact": "low"|"medium"|"high", "recommended_move": { "action": "hold"|"bench"|"drop"|"swap", "replacement_targets": [{ "player_id": number, "why": string[], "confidence": number(0-1) }] }, "risk_flags": string[] }], "notes": string[] }`,
};

async function fetchContext(sb: any, teamId?: string) {
  const [playersRes, rosterRes, scheduleRes] = await Promise.all([
    sb.from("players").select("*").order("fp_pg5", { ascending: false }).limit(200),
    teamId
      ? sb.from("roster").select("*").eq("team_id", teamId)
      : sb.from("roster").select("*"),
    sb.from("schedule_games").select("*").order("gw").order("day").limit(50),
  ]);
  return {
    players: playersRes.data ?? [],
    roster: rosterRes.data ?? [],
    schedule: scheduleRes.data ?? [],
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
  }));
}

async function callOpenAI(
  action: string,
  contextPayload: string,
  extraInput?: string,
  retryAttempt = false
): Promise<any> {
  const schemaDesc = SCHEMA_DESCRIPTIONS[action];
  const devMessage = `ACTION: ${action}\n\nRESPONSE SCHEMA:\n${schemaDesc}\n\nINTERNAL DATA:\n${contextPayload}${extraInput ? `\n\nUSER INPUT:\n${extraInput}` : ""}${retryAttempt ? "\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Return JSON only matching the schema above. No markdown. No extra keys. No wrapping in code blocks." : ""}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      instructions: SYSTEM_PROMPT,
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
    const { team_id, team_name } = await resolveTeam(req, sb);
    const ctx = await fetchContext(sb, team_id);

    const rosterPlayerIds = new Set(ctx.roster.map((r: any) => r.player_id));
    const rosterSlots = ctx.roster.map((r: any) => ({
      player_id: r.player_id,
      slot: r.slot,
      is_captain: r.is_captain,
      gw: r.gw,
      day: r.day,
    }));

    const playerSummary = buildPlayerSummary(ctx.players, rosterPlayerIds);

    const contextPayload = JSON.stringify({
      roster: rosterSlots,
      players: playerSummary,
      schedule: ctx.schedule.slice(0, 20),
      params,
    });

    // First attempt
    let aiData: any;
    try {
      aiData = await callOpenAI(action, contextPayload, params.extraInput);
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
        aiData = await callOpenAI(action, contextPayload, params.extraInput, true);
        validationErrors = validateShape(action, aiData);
      } catch (e) {
        console.error("[ai-coach] Retry failed:", e);
        return errorResponse("AI_SCHEMA_INVALID", "AI output failed validation after retry", validationErrors.join("; "));
      }
    }

    if (validationErrors.length > 0) {
      return errorResponse("AI_SCHEMA_INVALID", "AI output does not match expected schema", validationErrors.join("; "));
    }

    console.log(`[ai-coach] action=${action} success`);
    return okResponse(aiData);
  } catch (e) {
    console.error("[ai-coach] Error:", e);
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
