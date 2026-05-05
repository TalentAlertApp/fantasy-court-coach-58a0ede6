/**
 * Ballers.IQ — lightweight runtime validators for AI Coach responses.
 * No dependencies (Zod-free) so this can be reused server-side too.
 * Each validator returns { ok: true, data } or { ok: false, errors }.
 */

export type Validation<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export interface BIQAnalyzeResponse {
  summary_bullets: string[];
  strengths: string[];
  weaknesses: string[];
  quick_wins: { title: string; why: string[]; risk_flags?: string[]; confidence: number }[];
  recommended_actions?: { type: string; note: string }[];
  notes: string[];
  biq_summary?: { projected_fp?: number; risk_count?: number; value_count?: number };
}

export function validateAnalyze(d: unknown): Validation<BIQAnalyzeResponse> {
  const errs: string[] = [];
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  if (!isStrArr(d.summary_bullets) || d.summary_bullets.length < 1) errs.push("summary_bullets missing");
  if (!isStrArr(d.strengths)) errs.push("strengths missing");
  if (!isStrArr(d.weaknesses)) errs.push("weaknesses missing");
  if (!isStrArr(d.notes)) errs.push("notes missing");
  if (!Array.isArray(d.quick_wins)) errs.push("quick_wins missing");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQAnalyzeResponse };
}

export interface BIQCaptainResponse {
  captain_id: number;
  alternatives: { id: number; why: string }[];
  reason_bullets: string[];
  confidence: number;
  risk_note?: string | null;
}
export function validateCaptain(d: unknown): Validation<BIQCaptainResponse> {
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  const errs: string[] = [];
  if (!isNum(d.captain_id)) errs.push("captain_id");
  if (!isStrArr(d.reason_bullets)) errs.push("reason_bullets");
  if (!isNum(d.confidence)) errs.push("confidence");
  if (!Array.isArray(d.alternatives)) errs.push("alternatives");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQCaptainResponse };
}

export interface BIQTransferMove {
  add: number; drop: number; cap_after?: number;
  reason_bullets: string[];
  expected_delta: { proj_fp5: number; proj_stocks5?: number; proj_ast5?: number };
  risk_flags: string[];
  confidence: number;
}
export interface BIQTransferResponse { moves: BIQTransferMove[]; notes: string[]; }
export function validateTransfers(d: unknown): Validation<BIQTransferResponse> {
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  const errs: string[] = [];
  if (!Array.isArray(d.moves)) errs.push("moves");
  if (!isStrArr(d.notes)) errs.push("notes");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQTransferResponse };
}

export interface BIQExplainPlayerResponse {
  player_id: number;
  summary: string;
  verdict?: "START" | "BENCH" | "HOLD" | "WATCH" | "DROP";
  biq_rating?: number;
  form_signal?: string;
  salary_efficiency?: string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH";
  why_it_scores: { factor: string; impact: string; note: string }[];
  trend_flags: { type: string; detail: string }[];
  recommendation: { action: "add" | "hold" | "drop"; rationale: string };
}
export function validateExplainPlayer(d: unknown): Validation<BIQExplainPlayerResponse> {
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  const errs: string[] = [];
  if (typeof d.summary !== "string") errs.push("summary");
  if (!Array.isArray(d.why_it_scores)) errs.push("why_it_scores");
  if (!isObj(d.recommendation)) errs.push("recommendation");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQExplainPlayerResponse };
}

export interface BIQExplainTradeResponse {
  verdict: "favorable" | "neutral" | "unfavorable";
  summary: string;
  pros: string[]; cons: string[];
  risk_flags: string[];
  confidence: number;
  fp_delta?: number;
  value_delta?: number;
  schedule_impact?: string;
}
export function validateExplainTrade(d: unknown): Validation<BIQExplainTradeResponse> {
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  const errs: string[] = [];
  if (!["favorable", "neutral", "unfavorable"].includes(d.verdict as string)) errs.push("verdict");
  if (typeof d.summary !== "string") errs.push("summary");
  if (!isStrArr(d.pros)) errs.push("pros");
  if (!isStrArr(d.cons)) errs.push("cons");
  if (!isNum(d.confidence)) errs.push("confidence");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQExplainTradeResponse };
}

export interface BIQInjuryResponse {
  items: {
    player_id: number;
    status: "OUT" | "Q" | "DTD" | "ACTIVE" | "UNKNOWN";
    headline: string | null;
    impact: "low" | "medium" | "high";
    recommended_move: { action: string; replacement_targets: { player_id: number; why: string[]; confidence: number }[] };
    risk_flags: string[];
  }[];
  notes: string[];
}
export function validateInjury(d: unknown): Validation<BIQInjuryResponse> {
  if (!isObj(d)) return { ok: false, errors: ["root not object"] };
  const errs: string[] = [];
  if (!Array.isArray(d.items)) errs.push("items");
  if (!isStrArr(d.notes)) errs.push("notes");
  return errs.length ? { ok: false, errors: errs } : { ok: true, data: d as BIQInjuryResponse };
}

export const VALIDATORS = {
  "analyze-roster": validateAnalyze,
  "pick-captain": validateCaptain,
  "suggest-transfers": validateTransfers,
  "explain-player": validateExplainPlayer,
  "explain-trade": validateExplainTrade,
  "injury-monitor": validateInjury,
} as const;
