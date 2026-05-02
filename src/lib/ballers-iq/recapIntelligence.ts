import type { BIQPlayer, BIQRosterSlot } from "./types";
import { safeNum } from "./utils";

export interface BIQBenchOpportunityCost {
  missedFp: number;
  swaps: { out: number; in: number; fpDelta: number }[];
  summary: string;
}

/** Compare bench fp5 against starters and surface missed-upside swaps. */
export function calculateBenchOpportunityCost(
  starters: BIQPlayer[],
  bench: BIQPlayer[],
): BIQBenchOpportunityCost {
  if (!starters.length || !bench.length) {
    return { missedFp: 0, swaps: [], summary: "Insufficient data." };
  }
  const sortedStarters = [...starters].sort((a, b) => safeNum(a.fp_pg5) - safeNum(b.fp_pg5));
  const sortedBench = [...bench].sort((a, b) => safeNum(b.fp_pg5) - safeNum(a.fp_pg5));
  const swaps: { out: number; in: number; fpDelta: number }[] = [];
  let missedFp = 0;
  for (let i = 0; i < Math.min(sortedStarters.length, sortedBench.length); i++) {
    const s = sortedStarters[i];
    const b = sortedBench[i];
    const delta = safeNum(b.fp_pg5) - safeNum(s.fp_pg5);
    if (delta > 2) {
      swaps.push({ out: s.id, in: b.id, fpDelta: Math.round(delta * 10) / 10 });
      missedFp += delta;
    }
  }
  return {
    missedFp: Math.round(missedFp * 10) / 10,
    swaps,
    summary: swaps.length
      ? `${swaps.length} bench upgrade${swaps.length > 1 ? "s" : ""} would have added ${missedFp.toFixed(1)} FP.`
      : "Lineup was well-optimised.",
  };
}
