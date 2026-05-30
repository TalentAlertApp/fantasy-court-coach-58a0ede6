/**
 * Display-only home/away aggregation for the Standings venue companion table.
 *
 * Derived from the same FINAL schedule rows the standings already consume, so
 * the existing standings calculation is never touched. Provides each team's
 * home/away win-loss records and home points for/against, which feed the
 * HW% / HDIFF (home point differential) / HE (home edge) columns.
 */

export interface ScheduleSplitGame {
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  status: string;
}

export interface HomeSplit {
  homeW: number;
  homeL: number;
  awayW: number;
  awayL: number;
  homePf: number;
  homePa: number;
  homeGames: number;
}

function empty(): HomeSplit {
  return { homeW: 0, homeL: 0, awayW: 0, awayL: 0, homePf: 0, homePa: 0, homeGames: 0 };
}

export function computeHomeAwaySplits(
  games: ScheduleSplitGame[] | undefined | null,
): Record<string, HomeSplit> {
  const acc: Record<string, HomeSplit> = {};
  const ensure = (t: string) => (acc[t] ||= empty());
  for (const g of games ?? []) {
    if (!g.status?.toUpperCase().includes("FINAL")) continue;
    const ht = g.home_team;
    const at = g.away_team;
    if (!ht || !at) continue;
    const h = ensure(ht);
    const a = ensure(at);
    const homeWon = g.home_pts > g.away_pts;
    h.homeGames++;
    h.homePf += g.home_pts;
    h.homePa += g.away_pts;
    if (homeWon) {
      h.homeW++;
      a.awayL++;
    } else {
      h.homeL++;
      a.awayW++;
    }
  }
  return acc;
}

/** Home win % (0–1). Returns 0 when no home games played. */
export function homeWinPct(s: HomeSplit | undefined): number {
  if (!s) return 0;
  const g = s.homeW + s.homeL;
  return g > 0 ? s.homeW / g : 0;
}

/** Away win % (0–1). Returns 0 when no away games played. */
export function awayWinPct(s: HomeSplit | undefined): number {
  if (!s) return 0;
  const g = s.awayW + s.awayL;
  return g > 0 ? s.awayW / g : 0;
}

/** Average home point differential (points scored − allowed per home game). */
export function homePointDiff(s: HomeSplit | undefined): number {
  if (!s || s.homeGames === 0) return 0;
  return (s.homePf - s.homePa) / s.homeGames;
}

/** Home edge = home win% − away win% (in percentage points). */
export function homeEdgePct(s: HomeSplit | undefined): number {
  return (homeWinPct(s) - awayWinPct(s)) * 100;
}