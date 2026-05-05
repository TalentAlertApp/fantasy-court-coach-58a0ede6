/**
 * Ballers.IQ — narrative layer.
 *
 * Bridges the existing AI Coach / Ballers.IQ modal with the index core:
 *   1. Compute Ballers.IQ indexes locally (pure, deterministic).
 *   2. Send the compact index pack to the existing ai-coach edge function.
 *   3. Validate the response shape.
 *   4. Fall back to a deterministic, data-only narrative if AI fails / returns
 *      malformed JSON / hits rate limits.
 *
 * No new buttons, no new modals — consumed by the existing AICoachModal handlers.
 */
import type { BIQPlayer, BIQGame } from "./types";
import { buildPlayerIndexPack } from "./indexes";
import { calculateRosterIntelligence } from "./rosterIntelligence";
import {
  validateAnalyze, validateCaptain, validateTransfers,
  validateExplainPlayer, validateExplainTrade,
  type BIQAnalyzeResponse, type BIQCaptainResponse, type BIQTransferResponse,
  type BIQExplainPlayerResponse, type BIQExplainTradeResponse,
} from "./schemas";
import { buildTeamDifficultyMap } from "./teamDifficulty";

export interface BIQNarrativeContext {
  starters: BIQPlayer[];
  bench: BIQPlayer[];
  schedule?: BIQGame[];
  captainId?: number | null;
}

/** Wrap any AI response: validate, fall back to deterministic data if invalid. */
export function safeNarrative<T>(
  raw: unknown,
  validator: (d: unknown) => { ok: boolean; data?: T; errors?: string[] },
  fallback: () => T,
): { data: T; source: "ai" | "fallback"; warnings: string[] } {
  const v = validator(raw);
  if (v.ok && v.data) return { data: v.data, source: "ai", warnings: [] };
  return { data: fallback(), source: "fallback", warnings: v.errors ?? ["validation_failed"] };
}

// ---------- Deterministic fallbacks (data-only, no invented claims) ----------

export function fallbackAnalyze(ctx: BIQNarrativeContext): BIQAnalyzeResponse {
  const sched = ctx.schedule ?? [];
  const diff = buildTeamDifficultyMap(sched);
  const roster = calculateRosterIntelligence(ctx.starters, ctx.bench, {
    upcomingGames: sched, teamDifficultyMap: diff, captainId: ctx.captainId ?? null,
  });
  const summary = [
    `Projected FP (next slate): ${roster.projectedFP.toFixed(1)}.`,
    `${roster.captainCandidates.length} viable captain(s); ${roster.riskPlayers.length} risk player(s).`,
    ...(roster.valuePlayers.length ? [`${roster.valuePlayers.length} underpriced asset(s).`] : []),
  ];
  return {
    summary_bullets: summary,
    strengths: roster.valuePlayers.map((v) => `Underpriced player #${v.playerId} (${v.label})`),
    weaknesses: roster.riskPlayers.map((r) => `Risk player #${r.playerId}: ${r.flags.join(", ")}`),
    quick_wins: [],
    notes: roster.rosterConstructionNotes,
    biq_summary: { projected_fp: roster.projectedFP, risk_count: roster.riskPlayers.length, value_count: roster.valuePlayers.length },
  };
}

export function fallbackCaptain(ctx: BIQNarrativeContext): BIQCaptainResponse {
  const sched = ctx.schedule ?? [];
  const diff = buildTeamDifficultyMap(sched);
  const roster = calculateRosterIntelligence(ctx.starters, ctx.bench, {
    upcomingGames: sched, teamDifficultyMap: diff,
  });
  const top = roster.captainCandidates[0];
  const alts = roster.captainCandidates.slice(1, 4);
  return {
    captain_id: top?.playerId ?? ctx.starters[0]?.id ?? 0,
    alternatives: alts.map((a) => ({ id: a.playerId, why: `${a.label} (BIQ ${a.score})` })),
    reason_bullets: top ? [`${top.label} (Captain Edge ${top.score})`] : ["Insufficient data — defaulting to first starter."],
    confidence: top ? Math.min(1, top.score / 100) : 0.3,
  };
}

export function fallbackTransfers(): BIQTransferResponse {
  return { moves: [], notes: ["AI narrative unavailable — no transfer suggestions generated."] };
}

export function fallbackExplainPlayer(p: BIQPlayer, ctx: BIQNarrativeContext): BIQExplainPlayerResponse {
  const sched = ctx.schedule ?? [];
  const diff = buildTeamDifficultyMap(sched);
  const pack = buildPlayerIndexPack(p, { upcomingGames: sched, teamDifficultyMap: diff });
  const verdict =
    pack.biqRating.score >= 75 ? "START" :
    pack.biqRating.score >= 55 ? "HOLD" :
    pack.riskRadar.level === "HIGH" ? "DROP" : "WATCH";
  return {
    player_id: p.id,
    summary: `${p.name}: BIQ ${pack.biqRating.score} (${pack.biqRating.label}). Form ${pack.formSignal.label}. Risk ${pack.riskRadar.level}.`,
    verdict,
    biq_rating: pack.biqRating.score,
    form_signal: pack.formSignal.label,
    salary_efficiency: pack.salaryEfficiency.label,
    risk_level: pack.riskRadar.level,
    why_it_scores: [
      { factor: "minutes", impact: "medium", note: `MPG5 ${p.mpg5 ?? "n/a"}` },
      { factor: "stocks", impact: "medium", note: `stocks5 ${p.stocks5 ?? 0}` },
    ],
    trend_flags: pack.formSignal.label !== "Stable" ? [{ type: "form", detail: pack.formSignal.label }] : [],
    recommendation: {
      action: verdict === "DROP" ? "drop" : verdict === "START" || verdict === "HOLD" ? "hold" : "hold",
      rationale: `Index-based: ${pack.biqRating.label}, ${pack.salaryEfficiency.label}, risk ${pack.riskRadar.level}.`,
    },
  };
}

export function fallbackExplainTrade(outs: BIQPlayer[], ins: BIQPlayer[]): BIQExplainTradeResponse {
  const sum = (arr: BIQPlayer[], k: keyof BIQPlayer) =>
    arr.reduce((s, p) => s + Number((p as any)[k] ?? 0), 0);
  const fpDelta = sum(ins, "fp_pg5") - sum(outs, "fp_pg5");
  const verdict = fpDelta > 2 ? "favorable" : fpDelta < -2 ? "unfavorable" : "neutral";
  return {
    verdict,
    summary: `Net FP5 change: ${fpDelta >= 0 ? "+" : ""}${fpDelta.toFixed(1)}.`,
    pros: fpDelta >= 0 ? [`+${fpDelta.toFixed(1)} FP5`] : [],
    cons: fpDelta < 0 ? [`${fpDelta.toFixed(1)} FP5`] : [],
    risk_flags: [],
    confidence: Math.min(1, Math.abs(fpDelta) / 10),
    fp_delta: fpDelta,
  };
}

// ---------- Validators re-exported under a single map for convenience ---------

export const NARRATIVE_VALIDATORS = {
  "analyze-roster": validateAnalyze,
  "pick-captain": validateCaptain,
  "suggest-transfers": validateTransfers,
  "explain-player": validateExplainPlayer,
  "explain-trade": validateExplainTrade,
} as const;
