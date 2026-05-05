/**
 * Ballers.IQ — central tuning constants & label thresholds.
 * Pure data. Importing this file has no side effects.
 */

export const BIQ_WEIGHTS = {
  rating: {
    fp5: 0.30,
    seasonFp: 0.20,
    minutesStability: 0.15,
    value5: 0.15,
    stocks5: 0.10,
    scheduleAdj: 0.10,
  },
  captain: {
    fp5: 0.40,
    ceiling: 0.25,
    minutes: 0.15,
    matchup: 0.20,
  },
  teamDifficulty: {
    winRate: 0.35,
    pointDiff: 0.30,
    pointsAllowed: 0.20,
    fpAllowed: 0.15,
  },
} as const;

export const BIQ_THRESHOLDS = {
  rating: { elite: 85, strong: 70, playable: 55, watch: 40 },
  captain: { safe: 80, upside: 65, viable: 45 },
  risk: { high: 50, medium: 25 },
  schedule: { boost: 15, drag: -15 },
  salary: { underpriced: 75, fair: 45 },
  difficulty: { elite: 85, tough: 65, neutral: 40, easy: 25 },
  environment: { shootout: 85, high: 65, neutral: 40 },
} as const;

export const BIQ_NORMALISATION = {
  fp5: { min: 0, max: 50 },
  seasonFp: { min: 0, max: 50 },
  value: { min: 0, max: 2 },
  stocks: { min: 0, max: 5 },
  ceiling: { min: 0, max: 60 },
  salaryRatio: { min: 0.4, max: 1.6 },
} as const;

export const BIQ_PENALTIES = {
  injury: 35,
  noGame: 50,
  lowMinutes: 10,
  toughMatchup: 10,
  minutesDown: 15,
  fpDown: 15,
  noGameRisk: 25,
  salaryInefficient: 8,
} as const;

export const BIQ_DIFFICULTY_FP_MULT = {
  Easy: 0.92,
  Neutral: 1.00,
  Tough: 1.08,
  Elite: 1.15,
  "Trap Spot": 1.05,
} as const;

// ─── Central named thresholds (used by quality gate & narrative layer) ──
export const BIQ_ELITE = BIQ_THRESHOLDS.rating.elite;
export const BIQ_STRONG = BIQ_THRESHOLDS.rating.strong;
export const CAPTAIN_SAFE = BIQ_THRESHOLDS.captain.safe;
export const RISK_HIGH = BIQ_THRESHOLDS.risk.high;
export const VALUE_STRONG = BIQ_THRESHOLDS.salary.underpriced;
export const SCHEDULE_BOOST = BIQ_THRESHOLDS.schedule.boost;
export const FANTASY_ENV_HIGH = BIQ_THRESHOLDS.environment.high;
