/**
 * Per-row eligibility for the Available Players table on /transactions.
 *
 * Pure function: given a candidate player + current trade context, returns a
 * structured result explaining whether the [+] button should be enabled, and
 * if not, exactly why.
 */

export type EligibilityReason =
  | "ok"
  | "in_zone"
  | "no_out"          // roster full + no OUT picked yet (trade mode)
  | "in_full"         // IN slots already filled
  | "team_cap"        // would exceed max-2-per-team
  | "over_budget"     // would exceed available bank
  | "fc_bc"           // would break 5/5 FC/BC balance
  | "gw_cap";         // GW transfer cap hit

export interface Eligibility {
  ok: boolean;
  reason: EligibilityReason;
  message: string;     // full tooltip sentence
  shortLabel: string;  // tiny chip label, ≤ 14 chars
}

export interface EligibilityCtx {
  /** True when roster has fewer than 10 players → adds don't need an OUT. */
  addMode: boolean;
  /** Player ids currently staged into the IN zone. */
  inZone: number[];
  /** Player ids currently staged into the OUT zone. */
  outZone: number[];
  /** Live "available bank" given the current trade. */
  availableBudget: number;
  /** { TRI: count } — counts of remaining roster players per NBA team after OUTs. */
  postTeamCounts: Record<string, number>;
  /** FC count after OUTs (before any IN). */
  postFc: number;
  /** BC count after OUTs (before any IN). */
  postBc: number;
  /** Number of IN players already staged that are FC. */
  inFc: number;
  /** Number of IN players already staged that are BC. */
  inBc: number;
  /** Current GW transfers used. */
  gwUsed: number;
  /** Current GW transfers cap. */
  gwCap: number;
  /** Current GW number (for messages). */
  gw: number;
}

export interface CandidatePlayer {
  id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC" | string;
  salary: number;
}

export function getEligibility(p: CandidatePlayer, ctx: EligibilityCtx): Eligibility {
  // Already staged → green "in zone" pill (clickable to remove).
  if (ctx.inZone.includes(p.id)) {
    return { ok: true, reason: "in_zone", message: "Staged — click to remove", shortLabel: "STAGED" };
  }

  // GW cap reached
  if (ctx.gwUsed >= ctx.gwCap) {
    return {
      ok: false,
      reason: "gw_cap",
      message: `GW${ctx.gw} cap reached (${ctx.gwUsed}/${ctx.gwCap})`,
      shortLabel: "GW CAP",
    };
  }

  // Trade mode: roster is full (10) and no OUT chosen → must release first.
  if (!ctx.addMode && ctx.outZone.length === 0) {
    return {
      ok: false,
      reason: "no_out",
      message: "Roster full — pick a player to release first (− on a roster row)",
      shortLabel: "PICK OUT",
    };
  }

  // IN zone full (only relevant in trade mode).
  if (!ctx.addMode) {
    const expectedIns = Math.max(1, ctx.outZone.length);
    if (ctx.inZone.length >= expectedIns) {
      return {
        ok: false,
        reason: "in_full",
        message: `IN zone full — only ${expectedIns} replacement${expectedIns === 1 ? "" : "s"} allowed`,
        shortLabel: "IN FULL",
      };
    }
  }

  // Team cap (max 2 from same NBA team).
  const tri = (p.team ?? "").toUpperCase();
  const teamCountAfter = (ctx.postTeamCounts[tri] ?? 0) + 1;
  if (teamCountAfter > 2) {
    return {
      ok: false,
      reason: "team_cap",
      message: `Max 2 from ${tri} (would be ${teamCountAfter})`,
      shortLabel: `${tri} 2/2`,
    };
  }

  // Budget.
  if (p.salary > ctx.availableBudget + 1e-6) {
    const over = p.salary - ctx.availableBudget;
    return {
      ok: false,
      reason: "over_budget",
      message: `Over budget by $${over.toFixed(1)}M (have $${Math.max(0, ctx.availableBudget).toFixed(1)}M)`,
      shortLabel: `−$${over.toFixed(1)}M`,
    };
  }

  // FC/BC balance: only check when this candidate would be the FINAL slot
  // (otherwise the user can still rebalance with another pick).
  const slotsRemaining =
    ctx.addMode && ctx.outZone.length === 0
      ? 1
      : Math.max(1, ctx.outZone.length) - ctx.inZone.length;
  if (slotsRemaining === 1) {
    const finalFc = ctx.postFc + ctx.inFc + (p.fc_bc === "FC" ? 1 : 0);
    const finalBc = ctx.postBc + ctx.inBc + (p.fc_bc === "BC" ? 1 : 0);
    if (finalFc !== 5 || finalBc !== 5) {
      return {
        ok: false,
        reason: "fc_bc",
        message: `Would leave ${finalFc} FC / ${finalBc} BC (need 5/5)`,
        shortLabel: `${finalFc}F/${finalBc}B`,
      };
    }
  }

  return { ok: true, reason: "ok", message: "Stage this player", shortLabel: "OK" };
}
