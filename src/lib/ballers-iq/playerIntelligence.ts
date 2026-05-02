import type {
  BIQPlayer, BIQGame, BIQRating, BIQCaptainEdge, BIQScheduleEdge,
  BIQSalaryEfficiency, BIQFormSignal, BIQRiskRadar, BIQTeamDifficulty,
} from "./types";
import { clamp, mergeBasis, safeNum, scale100, tricodeEq, labelByThreshold, normalizeTo100 } from "./utils";

export function calculateBIQRating(
  player: BIQPlayer,
  context?: { scheduleEdgeScore?: number; riskPenalty?: number },
): BIQRating {
  const fp5 = safeNum(player.fp_pg5);
  const fpT = safeNum(player.fp_pg_t);
  const value5 = safeNum(player.value5);
  const stocks5 = safeNum(player.stocks5);
  const mpg = safeNum(player.mpg);
  const dMpg = safeNum(player.delta_mpg);

  const fp5Score = normalizeTo100(fp5, 0, 50);
  const seasonScore = normalizeTo100(fpT, 0, 50);
  const minutesStability = mpg > 0 ? clamp(100 - (Math.abs(dMpg) / mpg) * 200, 0, 100) : 50;
  const value5Score = normalizeTo100(value5, 0, 2);
  const stocksScore = normalizeTo100(stocks5, 0, 5);
  const scheduleAdj = clamp(safeNum(context?.scheduleEdgeScore, 50), 0, 100);
  const riskPenalty = clamp(safeNum(context?.riskPenalty, 0), 0, 30);

  const score = scale100(
    fp5Score * 0.30 +
      seasonScore * 0.20 +
      minutesStability * 0.15 +
      value5Score * 0.15 +
      stocksScore * 0.10 +
      scheduleAdj * 0.10 -
      riskPenalty,
  );

  const label = labelByThreshold(
    score,
    [
      { min: 85, label: "Elite" as const },
      { min: 70, label: "Strong" as const },
      { min: 55, label: "Playable" as const },
      { min: 40, label: "Watch" as const },
    ],
    "Risk" as const,
  );

  return {
    score,
    label,
    components: {
      fp5: fp5Score, seasonFp: seasonScore, minutesStability,
      value5: value5Score, stocks5: stocksScore, scheduleAdj, riskPenalty,
    },
    dataBasis: mergeBasis(
      fp5 > 0 ? ["fp5"] : [],
      fpT > 0 ? ["season_fp"] : [],
      mpg > 0 ? ["mpg"] : [],
      ["computed_index"],
    ),
  };
}

export function calculateCaptainEdge(
  player: BIQPlayer,
  context?: { hasGame?: boolean; matchupDifficulty?: number },
): BIQCaptainEdge {
  const fp5 = safeNum(player.fp_pg5);
  const mpg5 = safeNum(player.mpg5);
  const ceilingProxy = Math.max(fp5, safeNum(player.fp_pg_t)) + safeNum(player.stocks5) * 2;
  const matchup = clamp(safeNum(context?.matchupDifficulty, 50), 0, 100);
  const hasGame = context?.hasGame !== false;
  const injured = !!player.injury && player.injury.toUpperCase() !== "ACTIVE";

  const reasons: string[] = [];
  const flags: string[] = [];

  let score = scale100(
    normalizeTo100(fp5, 0, 50) * 0.40 +
      normalizeTo100(ceilingProxy, 0, 60) * 0.25 +
      clamp(mpg5 * 3, 0, 100) * 0.15 +
      (100 - matchup) * 0.20,
  );

  if (injured) { score = Math.max(0, score - 35); flags.push(player.injury!); }
  if (!hasGame) { score = Math.max(0, score - 50); flags.push("no_upcoming_game"); }
  if (mpg5 > 0 && mpg5 < 24) { score = Math.max(0, score - 10); flags.push("low_minutes"); }

  if (fp5 >= 35) reasons.push(`Elite FP5 (${fp5.toFixed(1)})`);
  if (mpg5 >= 32) reasons.push(`Heavy minutes (${mpg5.toFixed(1)} MPG5)`);
  if (matchup < 40) reasons.push("Soft matchup");

  const label = labelByThreshold(
    score,
    [
      { min: 80, label: "Safe Captain" as const },
      { min: 65, label: "Upside Captain" as const },
      { min: 45, label: "Viable Captain" as const },
    ],
    "Avoid Captain" as const,
  );

  return { score, label, reasons, riskFlags: flags, dataBasis: mergeBasis(["fp5", "mpg5"]) };
}

export function calculateScheduleEdge(
  player: BIQPlayer,
  upcomingGames: BIQGame[],
  teamDifficultyMap?: Record<string, BIQTeamDifficulty>,
): BIQScheduleEdge {
  const team = (player.team ?? "").toUpperCase();
  const games = (upcomingGames ?? []).filter(
    (g) => tricodeEq(g.home_team, team) || tricodeEq(g.away_team, team),
  );
  const notes: string[] = [];

  if (games.length === 0) {
    return {
      score: -30, label: "No Game Risk", gamesCount: 0,
      notes: ["No upcoming games."], dataBasis: ["schedule"],
    };
  }

  // Average matchup difficulty (lower = better for player)
  let diffSum = 0, withDiff = 0;
  for (const g of games) {
    const opp = tricodeEq(g.home_team, team) ? g.away_team : g.home_team;
    const diff = teamDifficultyMap?.[opp.toUpperCase()];
    if (diff) { diffSum += diff.score; withDiff++; }
  }
  const avgDiff = withDiff ? diffSum / withDiff : 50;
  const matchupScore = (100 - avgDiff); // easier opponents → bigger boost

  const b2b = games.filter((g) => g.back_to_back).length;
  if (b2b) notes.push(`${b2b} back-to-back game(s)`);

  let score = (games.length - 3) * 10 + (matchupScore - 50) * 0.6 - b2b * 5;
  score = clamp(score, -50, 50);

  const label =
    score >= 15 ? "Schedule Boost" :
    score <= -15 ? "Schedule Drag" : "Neutral";

  if (matchupScore > 60) notes.push("Soft slate of opponents");
  if (matchupScore < 40) notes.push("Tough slate of opponents");

  return {
    score: Math.round(score),
    label,
    gamesCount: games.length,
    notes,
    dataBasis: mergeBasis(["schedule"], withDiff ? ["matchup_difficulty"] : ["limited_sample"]),
  };
}

export function calculateSalaryEfficiency(player: BIQPlayer): BIQSalaryEfficiency {
  const salary = safeNum(player.salary);
  const value5 = safeNum(player.value5);
  const valueT = safeNum(player.value_t);
  const fp5 = safeNum(player.fp_pg5);
  if (salary <= 0) {
    return { score: 50, label: "Fair Value", ratio: 1, dataBasis: ["limited_sample"] };
  }
  const expected = salary * 0.8; // expected fp5/$ baseline
  const ratio = value5 > 0 ? value5 / 1.0 : (fp5 / salary);
  const score = scale100(normalizeTo100(ratio, 0.4, 1.6));
  const trap = ratio < 0.6 && salary >= 12;
  const label =
    trap ? "Salary Trap" :
    score >= 75 ? "Underpriced" :
    score >= 45 ? "Fair Value" : "Overpriced";
  return {
    score, label, ratio,
    dataBasis: mergeBasis(["salary"], value5 > 0 ? ["value5"] : valueT > 0 ? ["value_t"] : []),
  };
}

export function detectFormSignal(player: BIQPlayer): BIQFormSignal {
  const dFp = safeNum(player.delta_fp);
  const dMpg = safeNum(player.delta_mpg);
  const fp5 = safeNum(player.fp_pg5);
  const fpT = safeNum(player.fp_pg_t);
  const stocks = safeNum(player.stocks);
  const stocks5 = safeNum(player.stocks5);
  const mpg = safeNum(player.mpg);
  const mpg5 = safeNum(player.mpg5);
  const notes: string[] = [];

  let label: BIQFormSignal["label"] = "Stable";
  if (dFp >= 5 && dMpg >= 2) { label = "Form Spike"; notes.push(`Δ FP +${dFp.toFixed(1)}, Δ MPG +${dMpg.toFixed(1)}`); }
  else if (dMpg >= 4 && dFp < 2) { label = "Minutes Without Production"; notes.push(`Minutes up but FP flat`); }
  else if (dFp >= 4 && dMpg <= 0) { label = "Production Without Minutes"; notes.push(`Efficiency surge despite same minutes`); }
  else if (dMpg >= 4) { label = "Minutes Spike"; notes.push(`+${dMpg.toFixed(1)} MPG vs season`); }
  else if (stocks5 - stocks >= 1.5) { label = "Stocks Spike"; notes.push(`Defense surge: ${stocks5.toFixed(1)} stocks5`); }
  else if (dFp <= -5) { label = "Regression Risk"; notes.push(`Δ FP ${dFp.toFixed(1)}`); }
  else if (fpT > fp5 + 5 && mpg5 >= mpg * 0.95) { label = "Bounce-Back Candidate"; notes.push(`Below baseline but minutes intact`); }
  else if (dMpg <= -4) { label = "Role Warning"; notes.push(`Minutes ${dMpg.toFixed(1)} below season`); }

  return {
    label, notes,
    dataBasis: mergeBasis(["delta_fp", "delta_mpg"], stocks5 > 0 ? ["stocks5"] : []),
  };
}

export function calculateRiskRadar(
  player: BIQPlayer,
  context?: { hasGame?: boolean; matchupDifficulty?: number; salaryEfficiency?: number },
): BIQRiskRadar {
  const flags: string[] = [];
  let score = 0;
  if (player.injury && player.injury.toUpperCase() !== "ACTIVE") {
    flags.push(player.injury); score += 35;
  }
  if (safeNum(player.delta_mpg) <= -3) { flags.push("minutes_down"); score += 15; }
  if (safeNum(player.delta_fp) <= -4) { flags.push("fp_down"); score += 15; }
  if (context?.matchupDifficulty != null && context.matchupDifficulty >= 80) {
    flags.push("tough_matchup"); score += 10;
  }
  if (context?.hasGame === false) { flags.push("no_game"); score += 25; }
  if (context?.salaryEfficiency != null && context.salaryEfficiency < 35) {
    flags.push("salary_inefficient"); score += 8;
  }
  score = clamp(score, 0, 100);
  const level: "LOW" | "MEDIUM" | "HIGH" =
    score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  return { score, level, flags, dataBasis: ["risk_radar"] };
}

export function calculateDifficultyAdjustedFP(
  fp: number,
  teamDifficulty: BIQTeamDifficulty | { label: string },
): number {
  const mult =
    teamDifficulty.label === "Easy" ? 0.92 :
    teamDifficulty.label === "Tough" ? 1.08 :
    teamDifficulty.label === "Elite" ? 1.15 : 1.00;
  return safeNum(fp) * mult;
}
