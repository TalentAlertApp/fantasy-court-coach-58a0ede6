import { useMemo } from "react";

export interface ValidationPlayer {
  id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  salary: number;
}

export interface TradeValidationInput {
  rosterPlayers: ValidationPlayer[];
  outs: number[];
  ins: number[];
  bankRemaining: number;
  salaryCap?: number;
  /** trades already committed in current GW (read from useGameweekTransfers) */
  gwUsed: number;
  /** GW transfer cap, default 2 (chips can override) */
  gwCap?: number;
}

export interface TradeValidationResult {
  isValid: boolean;
  reasons: string[];
  postSalary: number;
  postFc: number;
  postBc: number;
  postTeamCounts: Record<string, number>;
  freedSalary: number;
  addedSalary: number;
  /** salary not yet locked by IN picks — used to gate per-row eligibility */
  availableForNextIn: number;
  gwRemaining: number;
}

/**
 * Pure validation hook for the Trade Machine.
 *
 * Validates a (outs, ins) pairing against all hard fantasy rules:
 *   - equal counts (1↔1 or 2↔2)
 *   - $100M salary cap
 *   - 5 FC + 5 BC after trade (FC/BC balance)
 *   - max 2 players per NBA team after trade
 *   - GW transfer cap (2 trades / GW)
 *
 * Also exposes derived numbers (`availableForNextIn`, `postTeamCounts`) used
 * by the per-row eligibility badge in the players table.
 */
export function useTradeValidation(
  input: TradeValidationInput,
  candidatePool: ValidationPlayer[],
): TradeValidationResult {
  return useMemo(() => {
    const cap = input.salaryCap ?? 100;
    const gwCap = input.gwCap ?? 2;
    const reasons: string[] = [];

    const byId = new Map<number, ValidationPlayer>();
    for (const p of input.rosterPlayers) byId.set(p.id, p);
    for (const p of candidatePool) if (!byId.has(p.id)) byId.set(p.id, p);

    const outPlayers = input.outs.map((id) => byId.get(id)).filter(Boolean) as ValidationPlayer[];
    const inPlayers = input.ins.map((id) => byId.get(id)).filter(Boolean) as ValidationPlayer[];

    const freedSalary = outPlayers.reduce((s, p) => s + (p.salary ?? 0), 0);
    const addedSalary = inPlayers.reduce((s, p) => s + (p.salary ?? 0), 0);
    const availableForNextIn = input.bankRemaining + freedSalary - addedSalary;

    // Post-trade roster
    const postIds = new Set<number>(input.rosterPlayers.map((p) => p.id));
    for (const id of input.outs) postIds.delete(id);
    for (const id of input.ins) postIds.add(id);

    let postSalary = 0;
    let postFc = 0;
    let postBc = 0;
    const postTeamCounts: Record<string, number> = {};
    for (const id of postIds) {
      const p = byId.get(id);
      if (!p) continue;
      postSalary += p.salary ?? 0;
      if (p.fc_bc === "FC") postFc += 1;
      else if (p.fc_bc === "BC") postBc += 1;
      const tri = (p.team ?? "").toUpperCase();
      if (tri) postTeamCounts[tri] = (postTeamCounts[tri] ?? 0) + 1;
    }

    // Rules
    if (input.outs.length === 0) {
      reasons.push("Pick at least 1 player to release");
    }
    if (input.outs.length > 2) {
      reasons.push("Max 2 players per trade");
    }
    if (input.ins.length !== input.outs.length) {
      reasons.push(
        input.ins.length < input.outs.length
          ? `Pick ${input.outs.length - input.ins.length} more replacement(s)`
          : `Too many replacements — pick exactly ${input.outs.length}`
      );
    }
    if (postSalary > cap + 1e-6) {
      reasons.push(`Over salary cap by $${(postSalary - cap).toFixed(1)}M`);
    }
    if (postFc !== 5 || postBc !== 5) {
      reasons.push(`Position balance broken: would leave ${postFc} FC / ${postBc} BC`);
    }
    for (const [tri, count] of Object.entries(postTeamCounts)) {
      if (count > 2) reasons.push(`Max 2 per team violated: ${count} from ${tri}`);
    }
    const gwRemaining = Math.max(0, gwCap - input.gwUsed);
    if (input.outs.length > gwRemaining) {
      reasons.push(`GW transfer cap: only ${gwRemaining}/${gwCap} trade(s) left this GW`);
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      postSalary,
      postFc,
      postBc,
      postTeamCounts,
      freedSalary,
      addedSalary,
      availableForNextIn,
      gwRemaining,
    };
  }, [input, candidatePool]);
}