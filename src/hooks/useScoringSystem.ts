import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScoringRuleRow {
  stat_key: string;
  rule_type: string;
  weight: number;
  applies_to: string;
  sort_order: number;
}

const DEFAULT_SYSTEM_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Reads the active scoring rules for a given scoring system (defaults to NBA Classic).
 * Used by HowToPlay modal and any UI that needs to show the formula.
 */
export function useScoringSystem(systemId: string = DEFAULT_SYSTEM_ID) {
  return useQuery({
    queryKey: ["scoring-rules", systemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scoring_rules")
        .select("stat_key, rule_type, weight, applies_to, sort_order")
        .eq("scoring_system_id", systemId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScoringRuleRow[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Builds a human-readable formula string from the rules array. */
export function buildFormulaString(rules: ScoringRuleRow[] | undefined): string {
  if (!rules || rules.length === 0) return "FP = PTS×1 + REB×1 + AST×2 + STL×3 + BLK×3";
  const parts = rules
    .filter(r => r.applies_to === "player" && r.rule_type === "multiplier")
    .map(r => `${r.stat_key.toUpperCase()}×${r.weight}`);
  return `FP = ${parts.join(" + ")}`;
}

/** Captain multiplier value; defaults to 2x. */
export function captainMultiplier(rules: ScoringRuleRow[] | undefined): number {
  if (!rules) return 2;
  const cap = rules.find(r => r.applies_to === "captain" && r.rule_type === "multiplier");
  return cap ? Number(cap.weight) : 2;
}
