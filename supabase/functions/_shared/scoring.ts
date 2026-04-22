// Shared scoring helper: computes FP from a stat line using DB-driven rules.
// Used by scoring-history, league-standings, sync-sheet, and ai-coach so the
// scoring formula has exactly one source of truth.

export type ScoringRule = {
  stat_key: string;
  rule_type: "multiplier" | "flat_bonus" | "flat_penalty" | string;
  weight: number;
  applies_to: "player" | "team" | "captain" | string;
  is_active: boolean;
};

export type StatLine = {
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  to?: number;
  // any other stat keys are looked up directly
  [key: string]: number | undefined;
};

/** Multiplier rules for player FP calculation */
export function computeFpFromRules(stats: StatLine, rules: ScoringRule[]): number {
  let fp = 0;
  for (const r of rules) {
    if (!r.is_active) continue;
    if (r.applies_to !== "player") continue;
    const val = Number(stats[r.stat_key] ?? 0);
    if (r.rule_type === "multiplier") fp += val * Number(r.weight);
    else if (r.rule_type === "flat_bonus") fp += Number(r.weight);
    else if (r.rule_type === "flat_penalty") fp -= Number(r.weight);
  }
  return fp;
}

/** Captain multiplier (default 2x); reads first applies_to='captain' multiplier rule. */
export function captainMultiplier(rules: ScoringRule[]): number {
  const cap = rules.find(r => r.applies_to === "captain" && r.rule_type === "multiplier" && r.is_active);
  return cap ? Number(cap.weight) : 2;
}

/** Human-readable formula string for AI prompts and HowToPlay copy. */
export function formulaString(rules: ScoringRule[]): string {
  const parts = rules
    .filter(r => r.is_active && r.applies_to === "player" && r.rule_type === "multiplier")
    .sort((a, b) => Number(a.weight) - Number(b.weight))
    .map(r => `${r.stat_key.toUpperCase()}×${r.weight}`);
  return `FP = ${parts.join(" + ")}`;
}

/** Cached fetch helpers (per cold start) */
let _cachedRules: { ts: number; rules: ScoringRule[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchScoringRules(
  sb: any,
  systemId: string = "00000000-0000-0000-0000-000000000001"
): Promise<ScoringRule[]> {
  const now = Date.now();
  if (_cachedRules && now - _cachedRules.ts < CACHE_TTL_MS) return _cachedRules.rules;
  const { data, error } = await sb
    .from("scoring_rules")
    .select("stat_key, rule_type, weight, applies_to, is_active")
    .eq("scoring_system_id", systemId)
    .eq("is_active", true);
  if (error) throw error;
  const rules = (data ?? []) as ScoringRule[];
  _cachedRules = { ts: now, rules };
  return rules;
}

/** Resolve scoring_system_id for a given league (defaults to main league). */
export async function fetchLeagueScoringSystemId(
  sb: any,
  leagueId: string = "00000000-0000-0000-0000-000000000010"
): Promise<string> {
  const { data, error } = await sb
    .from("leagues")
    .select("scoring_system_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  return data?.scoring_system_id ?? "00000000-0000-0000-0000-000000000001";
}
