export interface StandingRow {
  tricode: string;
  name: string;
  logo: string;
  primaryColor: string;
  gp: number;
  w: number;
  l: number;
  pct: number;
  gb: number;
  homeW: number;
  homeL: number;
  awayW: number;
  awayL: number;
  confW: number;
  confL: number;
  divW: number;
  divL: number;
  ppg: number;
  oppPpg: number;
  diff: number;
  l10W: number;
  l10L: number;
  strk: string;
  conference: "East" | "West";
  division: string;
}
