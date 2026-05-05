import type { BIQPlayer, BIQGame, BIQTeamDifficulty, BIQRiskLevel } from "./types";
import {
  calculateBIQRating, calculateSalaryEfficiency, calculateScheduleEdge,
  calculateRiskRadar, detectFormSignal,
} from "./playerIntelligence";
import { mergeBasis, safeNum } from "./utils";

export interface BIQMarketTarget {
  playerId: number;
  name: string;
  team?: string | null;
  salary: number;
  biqRating: number;
  salaryScore: number;
  reason: string[];
  dataBasis: string[];
}

export interface BIQMarketReport {
  underpriced: BIQMarketTarget[];
  formSpikes: BIQMarketTarget[];
  scheduleBoosts: BIQMarketTarget[];
  avoid: BIQMarketTarget[];
  dataBasis: string[];
}

/**
 * Surface league-wide add/drop candidates by combining player indexes.
 * Pure & defensive: empty input → empty report with limited_sample.
 */
export function calculateMarketReport(
  players: BIQPlayer[],
  ownedIds: Set<number>,
  upcomingGames: BIQGame[],
  diffMap?: Record<string, BIQTeamDifficulty>,
  opts?: { maxSalary?: number; topN?: number },
): BIQMarketReport {
  if (!players?.length) {
    return {
      underpriced: [], formSpikes: [], scheduleBoosts: [], avoid: [],
      dataBasis: ["limited_sample"],
    };
  }
  const topN = opts?.topN ?? 8;
  const maxSal = opts?.maxSalary ?? Infinity;
  const basis = new Set<string>();

  const underpriced: BIQMarketTarget[] = [];
  const formSpikes: BIQMarketTarget[] = [];
  const scheduleBoosts: BIQMarketTarget[] = [];
  const avoid: BIQMarketTarget[] = [];

  for (const p of players) {
    if (ownedIds.has(p.id)) continue;
    if (safeNum(p.salary) > maxSal) continue;

    const sched = calculateScheduleEdge(p, upcomingGames, diffMap);
    const sal = calculateSalaryEfficiency(p);
    const rating = calculateBIQRating(p, { scheduleEdgeScore: sched.score + 50 });
    const form = detectFormSignal(p);
    const risk = calculateRiskRadar(p, { hasGame: sched.gamesCount > 0, salaryEfficiency: sal.score });

    const target: BIQMarketTarget = {
      playerId: p.id,
      name: p.name,
      team: p.team,
      salary: safeNum(p.salary),
      biqRating: rating.score,
      salaryScore: sal.score,
      reason: [],
      dataBasis: mergeBasis(rating.dataBasis, sal.dataBasis, sched.dataBasis),
    };

    if (sal.label === "Underpriced" && rating.score >= 55) {
      target.reason.push(`Underpriced (${sal.ratio.toFixed(2)}x value)`);
      underpriced.push(target);
    }
    if (form.label === "Form Spike" || form.label === "Minutes Spike") {
      target.reason.push(form.label);
      formSpikes.push(target);
    }
    if (sched.label === "Schedule Boost") {
      target.reason.push(`Schedule Boost (${sched.gamesCount} games)`);
      scheduleBoosts.push(target);
    }
    if (sal.label === "Salary Trap" || risk.level === "HIGH") {
      target.reason.push(sal.label === "Salary Trap" ? "Salary Trap" : `Risk: ${risk.flags.join(",")}`);
      avoid.push(target);
    }
    target.dataBasis.forEach((b) => basis.add(b));
  }

  const byScore = (a: BIQMarketTarget, b: BIQMarketTarget) => b.biqRating - a.biqRating;

  return {
    underpriced: underpriced.sort(byScore).slice(0, topN),
    formSpikes: formSpikes.sort(byScore).slice(0, topN),
    scheduleBoosts: scheduleBoosts.sort(byScore).slice(0, topN),
    avoid: avoid.sort(byScore).slice(0, topN),
    dataBasis: mergeBasis(Array.from(basis), ["market_scan"]),
  };
}
