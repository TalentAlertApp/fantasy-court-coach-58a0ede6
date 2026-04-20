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

## HARD CONSTRAINTS (NEVER VIOLATE)
These rules are immutable. Any move suggestion that violates ANY of them MUST be discarded.
- Roster size = 10 (5 starters + 5 bench).
- Roster composition: exactly 5 FC + 5 BC at all times. Every ADD must share the same fc_bc as its DROP.
- Starting 5 must contain >=2 FC and >=2 BC.
- Salary cap (in $M) = team_settings.salary_cap (default 100). After ANY proposed swap:
  total_salary_after = roster_salary_total - drop_salary + add_salary
  total_salary_after MUST be <= salary_cap.
- Maximum 2 players from the same NBA team across the full 10-man roster. After each swap:
  team_distribution[add.team] (after applying the corresponding drop) MUST be <= 2.
- 1 captain per gameweek = 2x FP.
The internal payload includes: salary_cap, roster_salary_total, bank_remaining, team_distribution. USE them.

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
  "suggest-transfers": `Return JSON: { "moves": [{ "add": number, "drop": number, "cap_after": number, "reason_bullets": string[], "expected_delta": { "proj_fp5": number, "proj_stocks5": number, "proj_ast5": number }, "risk_flags": string[], "confidence": number(0-1) }], "notes": string[] }. moves array: 1-5 items. reason_bullets: 1-6 items each max ~12 words. CRITICAL CONSTRAINTS for every move: (1) ADD player's fc_bc MUST equal DROP player's fc_bc (preserves 5 FC + 5 BC). (2) cap_after = roster_salary_total - drop.salary + add.salary MUST be <= salary_cap. (3) After applying the swap, the count of roster players from add.team MUST be <= 2 (use team_distribution from payload, subtract 1 if drop is from same team). (4) Both add and drop players MUST exist in the players list. Set cap_after as a number (in $M) so the server can verify. If no legal move exists, return moves: [] and explain in notes.`,
  "pick-captain": `Return JSON: { "captain_id": number, "alternatives": [{ "id": number, "why": string }], "reason_bullets": string[], "confidence": number(0-1) }. captain_id must be from starters. Pick the best captain for the ENTIRE GAMEWEEK (not just one day). Consider total projected FP across all remaining gamedays, schedule density, matchup quality, and form. alternatives: 0-3.`,
  "explain-player": `Return JSON: { "player_id": number, "summary": string, "why_it_scores": [{ "factor": "rebounds"|"assists"|"stocks"|"minutes"|"usage", "impact": "low"|"medium"|"high"|"very_high", "note": string }], "trend_flags": [{ "type": "fp_up"|"fp_down"|"minutes_up"|"minutes_down"|"stocks_spike", "detail": string }], "recommendation": { "action": "add"|"hold"|"drop", "rationale": string } }. CRITICAL: Describe ONLY the player whose id matches target_player_id from the input. Do not substitute another player. The player_id you return MUST equal target_player_id exactly.`,
  "analyze-roster": `Return JSON: { "summary_bullets": string[](1-5), "strengths": string[], "weaknesses": string[], "quick_wins": [{ "title": string, "why": string[], "risk_flags": string[], "confidence": number(0-1) }], "recommended_actions": [{ "type": "PICK_CAPTAIN"|"SUGGEST_TRANSFERS"|"OPTIMIZE_LINEUP", "note": string }], "notes": string[] }`,
  "injury-monitor": `Return JSON: { "items": [{ "player_id": number, "status": "OUT"|"Q"|"DTD"|"ACTIVE"|"UNKNOWN", "headline": string|null, "impact": "low"|"medium"|"high", "recommended_move": { "action": "hold"|"bench"|"drop"|"swap", "replacement_targets": [{ "player_id": number, "why": string[], "confidence": number(0-1) }] }, "risk_flags": string[] }], "notes": string[] }`,
};

async function fetchContext(sb: any, teamId?: string) {
  const [playersRes, rosterRes, scheduleRes, settingsRes] = await Promise.all([
    sb.from("players").select("*").order("fp_pg5", { ascending: false }).limit(200),
    teamId
      ? sb.from("roster").select("*").eq("team_id", teamId)
      : sb.from("roster").select("*"),
    sb.from("schedule_games").select("*").order("gw").order("day").limit(50),
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
      ...(targetPlayerId !== undefined ? { target_player_id: targetPlayerId } : {}),
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

    console.log(`[ai-coach] action=${action} success`);
    return okResponse(aiData);
  } catch (e) {
    console.error("[ai-coach] Error:", e);
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
