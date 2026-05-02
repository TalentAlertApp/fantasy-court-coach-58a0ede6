import type { BIQGame, BIQTeamDifficulty } from "./types";
import { clamp, mergeBasis, safeNum, scale100, tricodeEq, labelByThreshold } from "./utils";

/**
 * Estimates how tough a team is to score against / beat from recent results.
 * Returns a 0..100 score where higher = tougher matchup for the opponent.
 * Falls back to neutral 50 with `dataBasis: ["limited_sample"]` when input is sparse.
 */
export function calculateTeamDifficulty(
  teamCode: string,
  scheduleGames: BIQGame[],
  playerLogs?: Array<{ team?: string | null; opp?: string | null; fp?: number | null }>,
): BIQTeamDifficulty {
  const code = (teamCode ?? "").toUpperCase();
  const finals = (scheduleGames ?? []).filter(
    (g) => /FINAL/i.test(g.status ?? "") &&
      (tricodeEq(g.home_team, code) || tricodeEq(g.away_team, code)),
  );

  if (finals.length < 5) {
    return {
      score: 50,
      label: "Neutral",
      components: { winRate: 0.5, pointDiff: 0, pointsAllowed: 0, homeAwayBias: 0 },
      dataBasis: ["limited_sample"],
    };
  }

  let wins = 0, losses = 0, totalDiff = 0, allowed = 0, scored = 0, homeWins = 0, homeGames = 0;
  const recent = finals.slice(-15);
  for (const g of recent) {
    const isHome = tricodeEq(g.home_team, code);
    const my = isHome ? safeNum(g.home_pts) : safeNum(g.away_pts);
    const opp = isHome ? safeNum(g.away_pts) : safeNum(g.home_pts);
    if (my > opp) wins++; else losses++;
    totalDiff += my - opp;
    allowed += opp;
    scored += my;
    if (isHome) {
      homeGames++;
      if (my > opp) homeWins++;
    }
  }
  const gp = recent.length;
  const winRate = wins / gp;
  const pointDiff = totalDiff / gp;
  const pointsAllowed = allowed / gp;
  const homeAwayBias = homeGames ? homeWins / homeGames - winRate : 0;

  // Optional FP allowed (if we have player logs against this team)
  let fpAllowed: number | undefined;
  let fpBasis: string[] = [];
  if (playerLogs && playerLogs.length > 0) {
    const vsTeam = playerLogs.filter((l) => tricodeEq(l.opp, code));
    if (vsTeam.length >= 10) {
      fpAllowed = vsTeam.reduce((s, l) => s + safeNum(l.fp), 0) / vsTeam.length;
      fpBasis = ["fp_allowed"];
    }
  }

  // Compose: high win rate + positive diff + low points allowed → tougher
  const winRateScore = winRate * 100;                       // 0..100
  const diffScore = clamp(50 + pointDiff * 2.5, 0, 100);    // ±20 pt diff -> 0..100
  const allowedScore = clamp(150 - pointsAllowed, 0, 100);  // 110 allowed -> 40
  const fpAllowedScore = fpAllowed != null ? clamp(120 - fpAllowed, 0, 100) : 50;

  const score = scale100(
    winRateScore * 0.35 +
      diffScore * 0.30 +
      allowedScore * 0.20 +
      fpAllowedScore * 0.15,
  );

  const label = labelByThreshold(
    score,
    [
      { min: 85, label: "Elite" as const },
      { min: 65, label: "Tough" as const },
      { min: 40, label: "Neutral" as const },
      { min: 25, label: "Easy" as const },
    ],
    "Easy" as const,
  );
  // Trap Spot: looks easy on paper but defensive surge (low recent allowed despite low win rate)
  const trap = winRate < 0.4 && allowedScore > 70;
  const finalLabel = trap ? ("Trap Spot" as const) : label;

  return {
    score,
    label: finalLabel,
    components: { winRate, pointDiff, pointsAllowed, fpAllowed, homeAwayBias },
    dataBasis: mergeBasis(["recent_results"], fpBasis, gp < 10 ? ["short_window"] : []),
  };
}

/** Build a difficulty map for every team in the schedule (for cross-referencing). */
export function buildTeamDifficultyMap(
  scheduleGames: BIQGame[],
): Record<string, BIQTeamDifficulty> {
  const teams = new Set<string>();
  for (const g of scheduleGames) {
    if (g.home_team) teams.add(g.home_team.toUpperCase());
    if (g.away_team) teams.add(g.away_team.toUpperCase());
  }
  const map: Record<string, BIQTeamDifficulty> = {};
  for (const t of teams) map[t] = calculateTeamDifficulty(t, scheduleGames);
  return map;
}
