import type { BIQGame, BIQEnvironment, BIQPlayer } from "./types";
import { clamp, mergeBasis, safeNum, scale100, tricodeEq, labelByThreshold } from "./utils";

/**
 * Estimates the fantasy ceiling of a single game (0..100).
 * Higher = more pace / scoring / FP exposure.
 */
export function calculateFantasyEnvironmentScore(
  game: BIQGame,
  ctx?: { players?: BIQPlayer[]; rosterTeamIds?: number[] },
): BIQEnvironment {
  const basis: string[] = [];
  const players = ctx?.players ?? [];
  const rosterIds = new Set(ctx?.rosterTeamIds ?? []);

  let paceScore = 50;
  if (safeNum(game.home_pts) > 0 || safeNum(game.away_pts) > 0) {
    const total = safeNum(game.home_pts) + safeNum(game.away_pts);
    paceScore = clamp((total - 180) * 1.5 + 50, 0, 100); // 220 total → 110 → clamped 100
    basis.push("scoreline");
  }

  // Owned players in the game add ceiling
  const owned = players.filter(
    (p) =>
      rosterIds.has(p.id) &&
      (tricodeEq(p.team, game.home_team) || tricodeEq(p.team, game.away_team)),
  );
  const exposureScore = clamp(owned.length * 22, 0, 100);
  if (owned.length) basis.push("roster_exposure");

  const score = scale100(paceScore * 0.6 + exposureScore * 0.4);

  let label = labelByThreshold(
    score,
    [
      { min: 85, label: "Fantasy Shootout" as const },
      { min: 65, label: "High Ceiling" as const },
      { min: 40, label: "Neutral" as const },
    ],
    "Low Ceiling" as const,
  );

  // Trap Game: low pace but high exposure — risky for owners
  if (paceScore < 40 && owned.length >= 2) label = "Trap Game";

  return {
    score,
    label,
    ownedPlayers: owned.length,
    dataBasis: mergeBasis(basis, basis.length === 0 ? ["limited_sample"] : []),
  };
}
