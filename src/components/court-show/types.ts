export type SlideKind =
  | "intro"
  | "performances"
  | "value"
  | "recap"
  | "matchups"
  | "ballersiq"
  | "captain"
  | "outro";

export type StoryLabel =
  | "STOCK ALERT"
  | "USAGE MONSTER"
  | "GLASS CLEANER"
  | "TWO-WAY JUICE"
  | "VALUE POP"
  | "CAPTAIN MATERIAL"
  | "TRAP GAME"
  | "SLATE HAMMER";

export interface TopPerformer {
  player_id: number;
  name: string;
  team: string;
  photo: string | null;
  fc_bc?: string;
  fp: number;
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  mp?: number;
  label?: StoryLabel;
  onRosterCount?: number;
}

export interface ValuePlay {
  player_id: number;
  name: string;
  team: string;
  photo: string | null;
  salary: number;
  fp5?: number;
  value5?: number;
  mpg5?: number;
  label?: StoryLabel;
}

export interface RecapGame {
  game_id: string;
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  margin: number;
  winner: string;
  topPerformer?: TopPerformer | null;
  nba_game_url?: string | null;
  game_recap_url?: string | null;
}

export interface MatchupGame {
  game_id: string;
  home_team: string;
  away_team: string;
  tipoff_utc?: string | null;
  competitiveScore: number;
  rosterRelevant: number;
  starPower: number;
  label?: StoryLabel;
}

export interface CaptainPick {
  player_id: number;
  name: string;
  team: string;
  photo: string | null;
  fp5?: number;
  mpg5?: number;
  fpProj?: number;
  label?: StoryLabel;
}

export interface IntroPayload {
  gw: number;
  day: number;
  dateLabel: string;
  gamesCount: number;
  deadlineUtc: string | null;
}

export interface OutroPayload {
  nextDeadlineUtc: string | null;
  bestPlayer?: TopPerformer | null;
  bestValue?: ValuePlay | null;
  keyGame?: RecapGame | MatchupGame | null;
}

export interface BallersIQSlideBullet {
  title: string;
  body: string;
  icon?: "flame" | "target" | "trend" | "shield";
}

export interface BallersIQSlidePayload {
  mode: "recap" | "matchup";
  gw: number;
  day: number;
  headline: string;
  bullets: BallersIQSlideBullet[];
  topPerformer?: TopPerformer | null;
  keyMatchup?: MatchupGame | null;
}

export type SlidePayload =
  | { kind: "intro"; data: IntroPayload }
  | { kind: "performances"; data: TopPerformer[] }
  | { kind: "value"; data: ValuePlay[] }
  | { kind: "recap"; data: RecapGame[] }
  | { kind: "matchups"; data: MatchupGame[] }
  | { kind: "ballersiq"; data: BallersIQSlidePayload }
  | { kind: "captain"; data: CaptainPick[] }
  | { kind: "outro"; data: OutroPayload };

export interface CourtShowSlideItem {
  kind: SlideKind;
  title: string;
  subtitle?: string;
  payload: SlidePayload;
}

export interface CourtShowData {
  gw: number;
  day: number;
  dateLabel: string;
  deadlineUtc: string | null;
  gamesCount: number;
  slides: CourtShowSlideItem[];
}
