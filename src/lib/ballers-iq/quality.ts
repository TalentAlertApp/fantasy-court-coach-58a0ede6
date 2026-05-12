/**
 * Ballers.IQ — Quality Gate.
 *
 * Validates and sanitises BallersIQResponse before it reaches any UI surface.
 * Pure functions, no UI imports, safe with partial data.
 *
 * Responsibilities:
 *  1. Shape validation (drop malformed insights instead of throwing).
 *  2. Deduplicate insights (same type + same primary player + similar headline).
 *  3. Strip unsupported claims (injuries/news/quotes/trades/live updates that
 *     are not backed by app data).
 *  4. Clean generic AI filler wording.
 *  5. Ensure each insight has a non-empty dataBasis (synthesised when absent).
 *  6. Coerce action ↔ type and risk level ↔ flags into a consistent state.
 *  7. Cap confidence when supporting data is thin.
 */

import type {
  BallersIQAction,
  BallersIQInsight,
  BallersIQInsightType,
  BallersIQResponse,
  BallersIQRisk,
} from "@/lib/ballers-iq";

// ─── Public types ──────────────────────────────────────────────────────

export interface QualityGateOptions {
  /** When true, strips even soft-unsupported phrases ("reportedly", etc.). */
  strict?: boolean;
  /** Hard cap on number of insights returned. Default 6. */
  maxInsights?: number;
}

export interface QualityGateReport {
  ok: boolean;
  removed: number;
  cappedConfidence: number;
  rejectedClaims: number;
  fallback: boolean;
}

export interface QualityGatedResponse extends BallersIQResponse {
  __quality?: QualityGateReport;
}

// ─── Constants ─────────────────────────────────────────────────────────

/**
 * Patterns that suggest the model fabricated information NOT present in
 * Supabase data (no live news feed, no coach quotes, no trade rumours).
 */
const UNSUPPORTED_PATTERNS: RegExp[] = [
  /\b(reportedly|sources say|per (?:[A-Z][a-z]+ )?(?:report|sources?))\b/i,
  /\b(coach|head coach)\s+(said|stated|told|noted|confirmed|hinted)\b/i,
  /\btrade rumou?r/i,
  /\b(rumou?red to be (?:traded|signed|waived))\b/i,
  /\b(breaking news|just in|live update|moments ago|tonight on espn)\b/i,
  /\b(twitter|x\.com|woj|shams|adrian wojnarowski)\b/i,
  /\b(probable|questionable|doubtful|out)\s+vs?\.?\s+/i, // injury status not in our data
];

/** Generic filler the model loves to add — strip it. */
const FILLER_PATTERNS: RegExp[] = [
  /\b(in conclusion|overall|to summarize|all in all|at the end of the day)\b[,\s]*/gi,
  /\b(it'?s (?:worth|important) (?:noting|to note))\b[,\s]*/gi,
  /\b(as an ai|as a language model)[^.]*\.?/gi,
  /\b(please note that|kindly note)[,\s]*/gi,
];

/** Allowed action per insight type. Anything else is coerced to null. */
const ACTION_BY_TYPE: Record<BallersIQInsightType, ReadonlyArray<NonNullable<BallersIQAction>>> = {
  CAPTAIN: ["CAPTAIN", "HOLD"],
  LINEUP:  ["START", "BENCH", "HOLD"],
  PLAYER:  ["START", "BENCH", "WATCH", "HOLD", "CAPTAIN"],
  GAME:    ["WATCH", "HOLD"],
  RECAP:   ["START", "BENCH", "CAPTAIN", "WATCH", "HOLD"],
  RISK:    ["BENCH", "DROP", "WATCH"],
  VALUE:   ["ADD", "WATCH", "HOLD"],
  FORM:    ["WATCH", "HOLD", "BENCH"],
  MARKET:  ["ADD", "DROP", "WATCH"],
  HEALTH:  ["BENCH", "WATCH", "HOLD"],
};

/** Words that signal an active risk flag (used to verify riskLevel). */
const HIGH_RISK_WORDS = /\b(injury|injured|out|gtd|no game|idle|suspension|inactive)\b/i;
const MEDIUM_RISK_WORDS = /\b(minutes drop|cold streak|slump|cool(?:ed|ing) off|bench risk|tough matchup)\b/i;

// ─── Helpers ───────────────────────────────────────────────────────────

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function asString(v: unknown, max = 240): string {
  if (typeof v !== "string") return "";
  const cleaned = v.trim().slice(0, max);
  return cleaned;
}

function asStringArray(v: unknown, maxItems = 4, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const item of v) {
    const n = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(n)) out.push(n);
  }
  return Array.from(new Set(out));
}

function stripFiller(s: string): string {
  let out = s;
  for (const re of FILLER_PATTERNS) out = out.replace(re, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function hasUnsupportedClaim(text: string): boolean {
  return UNSUPPORTED_PATTERNS.some((re) => re.test(text));
}

function normaliseHeadlineKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
}

function coerceAction(type: BallersIQInsightType, action: unknown): BallersIQAction {
  if (action == null) return null;
  const a = String(action).toUpperCase() as NonNullable<BallersIQAction>;
  return ACTION_BY_TYPE[type]?.includes(a) ? a : null;
}

function coerceRisk(insight: BallersIQInsight): BallersIQRisk {
  const raw = insight.riskLevel;
  const valid: BallersIQRisk[] = ["LOW", "MEDIUM", "HIGH", null];
  const current = valid.includes(raw) ? raw : null;

  const blob = `${insight.headline} ${insight.bullets.join(" ")}`;
  if (HIGH_RISK_WORDS.test(blob)) return "HIGH";
  if (current === "HIGH" && !HIGH_RISK_WORDS.test(blob)) return "MEDIUM";
  if (MEDIUM_RISK_WORDS.test(blob)) return current === "LOW" ? "MEDIUM" : current ?? "MEDIUM";
  return current ?? "LOW";
}

function calibrateConfidence(insight: BallersIQInsight): number {
  let c = isFiniteNumber(insight.confidence) ? clamp01(insight.confidence) : 0.5;

  // Cap when supporting evidence is thin.
  if (!insight.bullets.length) c = Math.min(c, 0.45);
  if (insight.bullets.length === 1) c = Math.min(c, 0.65);
  if (!insight.playerIds.length && (insight.type === "PLAYER" || insight.type === "CAPTAIN")) {
    c = Math.min(c, 0.4);
  }
  if (insight.riskLevel === "HIGH") c = Math.min(c, 0.7);
  return Math.round(c * 100) / 100;
}

/** Synthesise a dataBasis when one is missing, so UI can always display it. */
function deriveDataBasis(insight: BallersIQInsight): string[] {
  const basis = new Set<string>();
  const blob = `${insight.headline} ${insight.bullets.join(" ")}`.toLowerCase();
  if (/fp5|fp\b/.test(blob)) basis.add("fp_pg5");
  if (/season|fpt/.test(blob)) basis.add("season fp");
  if (/value|v5|\$\d/.test(blob)) basis.add("salary/value5");
  if (/min|mp\b|playing time/.test(blob)) basis.add("mpg5");
  if (/stl|blk|stocks/.test(blob)) basis.add("stocks5");
  if (/schedule|tonight|game/.test(blob)) basis.add("schedule_games");
  if (/captain|armband/.test(blob)) basis.add("roster.captain");
  if (/bench|starter/.test(blob)) basis.add("roster.slots");
  if (basis.size === 0) basis.add("calculated indexes");
  return Array.from(basis);
}

// ─── Single insight gate ──────────────────────────────────────────────

function gateInsight(
  raw: unknown,
  ctx: { rejectRef: { count: number }; strict: boolean },
): BallersIQInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const type = r.type as BallersIQInsightType;
  if (!type || !ACTION_BY_TYPE[type]) return null;

  const title = asString(r.title, 60);
  let headline = stripFiller(asString(r.headline, 200));
  let bullets = asStringArray(r.bullets, 4, 200).map(stripFiller).filter(Boolean);

  if (!title || !headline) return null;

  // Reject unsupported / hallucinated claims
  if (hasUnsupportedClaim(headline)) {
    ctx.rejectRef.count += 1;
    return null;
  }
  bullets = bullets.filter((b) => {
    if (hasUnsupportedClaim(b)) {
      ctx.rejectRef.count += 1;
      return false;
    }
    return true;
  });

  const playerIds = asNumberArray(r.playerIds);

  const interim: BallersIQInsight = {
    type,
    title,
    headline,
    bullets,
    playerIds,
    confidence: isFiniteNumber(r.confidence) ? clamp01(r.confidence as number) : 0.5,
    action: coerceAction(type, r.action),
    riskLevel: (r.riskLevel as BallersIQRisk) ?? null,
  };

  // Carry over dataBasis if present, else synthesise.
  const incomingBasis = asStringArray((r as any).dataBasis, 8, 60);
  const dataBasis = incomingBasis.length ? incomingBasis : deriveDataBasis(interim);

  const finalInsight: BallersIQInsight & { dataBasis: string[] } = {
    ...interim,
    riskLevel: coerceRisk(interim),
    confidence: calibrateConfidence(interim),
    // dataBasis is appended as an extra field; UI components ignore unknown fields.
    dataBasis,
  } as any;

  return finalInsight;
}

function dedupe(insights: BallersIQInsight[]): { kept: BallersIQInsight[]; removed: number } {
  const seen = new Set<string>();
  const kept: BallersIQInsight[] = [];
  let removed = 0;
  for (const ins of insights) {
    const key = `${ins.type}|${ins.playerIds[0] ?? ""}|${normaliseHeadlineKey(ins.headline)}`;
    if (seen.has(key)) { removed += 1; continue; }
    seen.add(key);
    kept.push(ins);
  }
  return { kept, removed };
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Run the quality gate on a BallersIQResponse. Always returns a safe object —
 * never throws. Attaches a non-enumerable __quality report for debugging.
 */
export function applyQualityGate(
  response: unknown,
  options: QualityGateOptions = {},
): QualityGatedResponse {
  const { strict = false, maxInsights = 6 } = options;

  const fallback: QualityGatedResponse = {
    summary: "",
    insights: [],
    __quality: { ok: false, removed: 0, cappedConfidence: 0, rejectedClaims: 0, fallback: true },
  };

  if (!response || typeof response !== "object") return fallback;
  const r = response as Record<string, unknown>;

  const rejectRef = { count: 0 };
  const rawList = Array.isArray(r.insights) ? r.insights : [];

  const gated: BallersIQInsight[] = [];
  for (const item of rawList) {
    const ins = gateInsight(item, { rejectRef, strict });
    if (ins) gated.push(ins);
  }

  const { kept, removed } = dedupe(gated);
  const trimmed = kept.slice(0, maxInsights);

  let summary = stripFiller(asString(r.summary, 320));
  if (hasUnsupportedClaim(summary)) {
    summary = "";
    rejectRef.count += 1;
  }

  // Track how many confidences were capped (rough heuristic).
  let capped = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const orig = (rawList[i] as any)?.confidence;
    if (isFiniteNumber(orig) && orig > trimmed[i].confidence + 0.001) capped += 1;
  }

  return {
    summary,
    insights: trimmed,
    __quality: {
      ok: true,
      removed,
      cappedConfidence: capped,
      rejectedClaims: rejectRef.count,
      fallback: false,
    },
  };
}

/** Convenience: apply gate then drop the debug envelope. */
export function gateBallersIQ(response: unknown, options?: QualityGateOptions): BallersIQResponse {
  const gated = applyQualityGate(response, options);
  // Strip the debug field before returning to UI.
  const { __quality, ...clean } = gated;
  void __quality;
  return clean;
}