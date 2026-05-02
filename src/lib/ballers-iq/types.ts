/**
 * Ballers.IQ v2 — Intelligence core type definitions.
 * Logic-only module (no UI imports). All scores 0–100 unless noted.
 */

export type BIQLabel =
  | "Elite" | "Strong" | "Playable" | "Watch" | "Risk"
  | "Safe Captain" | "Upside Captain" | "Viable Captain" | "Avoid Captain"
  | "Easy" | "Neutral" | "Tough" | "Trap Spot"
  | "Low Ceiling" | "High Ceiling" | "Fantasy Shootout" | "Trap Game"
  | "Schedule Boost" | "Schedule Drag" | "No Game Risk"
  | "Underpriced" | "Fair Value" | "Overpriced" | "Salary Trap"
  | "Form Spike" | "Minutes Spike" | "Minutes Without Production"
  | "Production Without Minutes" | "Stocks Spike" | "Regression Risk"
  | "Bounce-Back Candidate" | "Role Warning" | "Stable";

export type BIQRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BIQRating {
  score: number;
  label: Extract<BIQLabel, "Elite" | "Strong" | "Playable" | "Watch" | "Risk">;
  components: {
    fp5: number;
    seasonFp: number;
    minutesStability: number;
    value5: number;
    stocks5: number;
    scheduleAdj: number;
    riskPenalty: number;
  };
  dataBasis: string[];
}

export interface BIQCaptainEdge {
  score: number;
  label: Extract<BIQLabel, "Safe Captain" | "Upside Captain" | "Viable Captain" | "Avoid Captain">;
  reasons: string[];
  riskFlags: string[];
  dataBasis: string[];
}

export interface BIQTeamDifficulty {
  score: number;
  label: Extract<BIQLabel, "Easy" | "Neutral" | "Tough" | "Elite" | "Trap Spot">;
  components: {
    winRate: number;
    pointDiff: number;
    pointsAllowed: number;
    fpAllowed?: number;
    homeAwayBias: number;
  };
  dataBasis: string[];
}

export interface BIQEnvironment {
  score: number;
  label: Extract<BIQLabel, "Low Ceiling" | "Neutral" | "High Ceiling" | "Fantasy Shootout" | "Trap Game">;
  ownedPlayers: number;
  dataBasis: string[];
}

export interface BIQScheduleEdge {
  score: number; // can be negative (drag) or positive (boost)
  label: Extract<BIQLabel, "Schedule Boost" | "Neutral" | "Schedule Drag" | "No Game Risk">;
  gamesCount: number;
  notes: string[];
  dataBasis: string[];
}

export interface BIQSalaryEfficiency {
  score: number;
  label: Extract<BIQLabel, "Underpriced" | "Fair Value" | "Overpriced" | "Salary Trap">;
  ratio: number; // value5 / expected
  dataBasis: string[];
}

export interface BIQFormSignal {
  label: Extract<
    BIQLabel,
    | "Form Spike" | "Minutes Spike" | "Minutes Without Production"
    | "Production Without Minutes" | "Stocks Spike" | "Regression Risk"
    | "Bounce-Back Candidate" | "Role Warning" | "Stable"
  >;
  notes: string[];
  dataBasis: string[];
}

export interface BIQRiskRadar {
  score: number;
  level: BIQRiskLevel;
  flags: string[];
  dataBasis: string[];
}

export interface BIQPlayerIndexPack {
  biqRating: BIQRating;
  captainEdge: BIQCaptainEdge;
  scheduleEdge: BIQScheduleEdge;
  salaryEfficiency: BIQSalaryEfficiency;
  formSignal: BIQFormSignal;
  riskRadar: BIQRiskRadar;
  difficultyAdjustedFP: number;
}

export interface BIQGameIndexPack {
  fantasyEnvironmentScore: BIQEnvironment;
  teamDifficultyHome: BIQTeamDifficulty;
  teamDifficultyAway: BIQTeamDifficulty;
  ownedPlayerImpact: { ownedHome: number; ownedAway: number; total: number };
}

export interface BIQRosterIndexPack {
  projectedFP: number;
  captainCandidates: { playerId: number; score: number; label: string }[];
  riskPlayers: { playerId: number; level: BIQRiskLevel; flags: string[] }[];
  valuePlayers: { playerId: number; score: number; label: string }[];
  scheduleBoostPlayers: { playerId: number; score: number; label: string }[];
  rosterConstructionNotes: string[];
  dataBasis: string[];
}

// ─── shared light-weight payload shapes ─────────────────────────────────

export interface BIQPlayer {
  id: number;
  name: string;
  team?: string | null;
  fc_bc?: string | null;
  salary?: number | null;
  fp_pg5?: number | null;
  fp_pg_t?: number | null;
  value5?: number | null;
  value_t?: number | null;
  mpg?: number | null;
  mpg5?: number | null;
  stl5?: number | null;
  blk5?: number | null;
  ast5?: number | null;
  stocks?: number | null;
  stocks5?: number | null;
  delta_fp?: number | null;
  delta_mpg?: number | null;
  injury?: string | null;
}

export interface BIQRosterSlot {
  player_id: number;
  slot: string;
  is_captain?: boolean;
}

export interface BIQGame {
  game_id: string;
  gw?: number;
  day?: number;
  away_team: string;
  home_team: string;
  away_pts?: number;
  home_pts?: number;
  status?: string;
  tipoff_utc?: string | null;
  back_to_back?: boolean;
}

export interface BIQContext {
  schedule?: BIQGame[];
  upcomingGames?: BIQGame[];
  todayTeams?: string[];
  teamDifficultyMap?: Record<string, BIQTeamDifficulty>;
}
