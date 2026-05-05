/**
 * Ballers.IQ — high-level orchestration: build a complete index pack
 * for a single player by combining the lower-level intelligence modules.
 * Pure & defensive.
 */
import type {
  BIQPlayer, BIQGame, BIQTeamDifficulty, BIQPlayerIndexPack, BIQGameIndexPack,
} from "./types";
import {
  calculateBIQRating, calculateCaptainEdge, calculateScheduleEdge,
  calculateSalaryEfficiency, detectFormSignal, calculateRiskRadar,
  calculateDifficultyAdjustedFP,
} from "./playerIntelligence";
import { calculateTeamDifficulty } from "./teamDifficulty";
import { calculateFantasyEnvironmentScore } from "./gameEnvironment";
import { aggregatePlayerMatchupDifficulty } from "./matchupIntelligence";
import { safeNum, tricodeEq } from "./utils";

export function buildPlayerIndexPack(
  player: BIQPlayer,
  ctx: {
    upcomingGames?: BIQGame[];
    teamDifficultyMap?: Record<string, BIQTeamDifficulty>;
  } = {},
): BIQPlayerIndexPack {
  const upcoming = ctx.upcomingGames ?? [];
  const diffMap = ctx.teamDifficultyMap ?? {};
  const sched = calculateScheduleEdge(player, upcoming, diffMap);
  const matchup = aggregatePlayerMatchupDifficulty(player, upcoming, diffMap);
  const sal = calculateSalaryEfficiency(player);
  const risk = calculateRiskRadar(player, {
    hasGame: sched.gamesCount > 0,
    matchupDifficulty: matchup.score,
    salaryEfficiency: sal.score,
  });
  const form = detectFormSignal(player);
  const captain = calculateCaptainEdge(player, {
    hasGame: sched.gamesCount > 0,
    matchupDifficulty: matchup.score,
  });
  const rating = calculateBIQRating(player, {
    scheduleEdgeScore: sched.score + 50,
    riskPenalty: Math.min(30, risk.score / 4),
  });
  // Use the first upcoming opponent's difficulty (if any) for an FP adjustment
  const team = (player.team ?? "").toUpperCase();
  const firstOpp = upcoming.find(
    (g) => tricodeEq(g.home_team, team) || tricodeEq(g.away_team, team),
  );
  const oppCode = firstOpp
    ? (tricodeEq(firstOpp.home_team, team) ? firstOpp.away_team : firstOpp.home_team)
    : null;
  const oppDiff = oppCode ? diffMap[oppCode.toUpperCase()] : undefined;
  const adjFP = oppDiff
    ? calculateDifficultyAdjustedFP(safeNum(player.fp_pg5), oppDiff)
    : safeNum(player.fp_pg5);

  return {
    biqRating: rating,
    captainEdge: captain,
    scheduleEdge: sched,
    salaryEfficiency: sal,
    formSignal: form,
    riskRadar: risk,
    difficultyAdjustedFP: Math.round(adjFP * 10) / 10,
  };
}

export function buildGameIndexPack(
  game: BIQGame,
  scheduleGames: BIQGame[],
  ctx?: { players?: BIQPlayer[]; rosterTeamIds?: number[] },
): BIQGameIndexPack {
  const dh = calculateTeamDifficulty(game.home_team, scheduleGames);
  const da = calculateTeamDifficulty(game.away_team, scheduleGames);
  const env = calculateFantasyEnvironmentScore(game, ctx);
  const owned = ctx?.players?.filter((p) => (ctx?.rosterTeamIds ?? []).includes(p.id)) ?? [];
  const ownedHome = owned.filter((p) => tricodeEq(p.team, game.home_team)).length;
  const ownedAway = owned.filter((p) => tricodeEq(p.team, game.away_team)).length;
  return {
    fantasyEnvironmentScore: env,
    teamDifficultyHome: dh,
    teamDifficultyAway: da,
    ownedPlayerImpact: { ownedHome, ownedAway, total: ownedHome + ownedAway },
  };
}
