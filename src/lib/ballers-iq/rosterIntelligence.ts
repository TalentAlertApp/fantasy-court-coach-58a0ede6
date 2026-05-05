import type {
  BIQPlayer, BIQRosterSlot, BIQRosterIndexPack, BIQGame, BIQTeamDifficulty,
} from "./types";
import {
  calculateBIQRating, calculateCaptainEdge, calculateScheduleEdge,
  calculateSalaryEfficiency, calculateRiskRadar, detectFormSignal,
} from "./playerIntelligence";
import { mergeBasis, safeNum } from "./utils";

/**
 * Aggregate intelligence for an entire roster.
 * Pure: never mutates inputs, safe with partial data.
 */
export function calculateRosterIntelligence(
  starters: BIQPlayer[],
  bench: BIQPlayer[],
  context?: {
    upcomingGames?: BIQGame[];
    teamDifficultyMap?: Record<string, BIQTeamDifficulty>;
    captainId?: number | null;
  },
): BIQRosterIndexPack {
  const games = context?.upcomingGames ?? [];
  const diffMap = context?.teamDifficultyMap;
  const all = [...starters, ...bench];

  if (all.length === 0) {
    return {
      projectedFP: 0,
      captainCandidates: [],
      riskPlayers: [],
      valuePlayers: [],
      scheduleBoostPlayers: [],
      rosterConstructionNotes: ["No players supplied."],
      dataBasis: ["limited_sample"],
    };
  }

  const captainCandidates: BIQRosterIndexPack["captainCandidates"] = [];
  const riskPlayers: BIQRosterIndexPack["riskPlayers"] = [];
  const valuePlayers: BIQRosterIndexPack["valuePlayers"] = [];
  const scheduleBoostPlayers: BIQRosterIndexPack["scheduleBoostPlayers"] = [];
  const basis = new Set<string>();

  let projectedFP = 0;
  for (const p of starters) {
    const sched = calculateScheduleEdge(p, games, diffMap);
    const sal = calculateSalaryEfficiency(p);
    const risk = calculateRiskRadar(p, {
      hasGame: sched.gamesCount > 0,
      salaryEfficiency: sal.score,
    });
    const cap = calculateCaptainEdge(p, { hasGame: sched.gamesCount > 0 });
    const isCap = context?.captainId === p.id;
    const fp = safeNum(p.fp_pg5);
    projectedFP += isCap ? fp * 2 : fp;

    captainCandidates.push({ playerId: p.id, score: cap.score, label: cap.label });
    if (risk.level !== "LOW") riskPlayers.push({ playerId: p.id, level: risk.level, flags: risk.flags });
    if (sal.label === "Underpriced") valuePlayers.push({ playerId: p.id, score: sal.score, label: sal.label });
    if (sched.label === "Schedule Boost") scheduleBoostPlayers.push({ playerId: p.id, score: sched.score, label: sched.label });

    sched.dataBasis.forEach((b) => basis.add(b));
    sal.dataBasis.forEach((b) => basis.add(b));
  }

  for (const p of bench) {
    const sched = calculateScheduleEdge(p, games, diffMap);
    const sal = calculateSalaryEfficiency(p);
    const risk = calculateRiskRadar(p, { hasGame: sched.gamesCount > 0, salaryEfficiency: sal.score });
    if (risk.level === "HIGH") riskPlayers.push({ playerId: p.id, level: risk.level, flags: risk.flags });
    if (sal.label === "Underpriced") valuePlayers.push({ playerId: p.id, score: sal.score, label: sal.label });
  }

  captainCandidates.sort((a, b) => b.score - a.score);
  valuePlayers.sort((a, b) => b.score - a.score);
  scheduleBoostPlayers.sort((a, b) => b.score - a.score);

  // Construction notes
  const notes: string[] = [];
  const fcCount = all.filter((p) => p.fc_bc === "FC").length;
  const bcCount = all.filter((p) => p.fc_bc === "BC").length;
  if (fcCount && bcCount && Math.abs(fcCount - bcCount) >= 4) {
    notes.push(`Roster skewed: ${fcCount} FC / ${bcCount} BC`);
  }
  const teamCounts: Record<string, number> = {};
  for (const p of all) {
    if (!p.team) continue;
    teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
  }
  for (const [tm, c] of Object.entries(teamCounts)) {
    if (c > 2) notes.push(`Over team cap: ${c} players from ${tm}`);
  }
  if (riskPlayers.length >= 3) notes.push(`${riskPlayers.length} elevated-risk starters`);

  return {
    projectedFP: Math.round(projectedFP * 10) / 10,
    captainCandidates: captainCandidates.slice(0, 5),
    riskPlayers,
    valuePlayers: valuePlayers.slice(0, 5),
    scheduleBoostPlayers: scheduleBoostPlayers.slice(0, 5),
    rosterConstructionNotes: notes,
    dataBasis: mergeBasis(Array.from(basis), ["roster_aggregate"]),
  };
}

/** Convenience: split a roster shape ({starters,bench} of ids) using a player lookup map. */
export function hydrateRoster(
  slots: { starters: number[]; bench: number[]; captain_id?: number | null },
  byId: Map<number, BIQPlayer>,
): { starters: BIQPlayer[]; bench: BIQPlayer[]; captainId: number | null } {
  const lift = (id: number) => byId.get(id);
  return {
    starters: slots.starters.map(lift).filter(Boolean) as BIQPlayer[],
    bench: slots.bench.map(lift).filter(Boolean) as BIQPlayer[],
    captainId: slots.captain_id ?? null,
  };
}
