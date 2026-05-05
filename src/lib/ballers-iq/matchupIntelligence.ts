import type { BIQGame, BIQPlayer, BIQTeamDifficulty } from "./types";
import { calculateTeamDifficulty } from "./teamDifficulty";
import { calculateFantasyEnvironmentScore } from "./gameEnvironment";
import { mergeBasis, safeNum, tricodeEq } from "./utils";

export interface BIQMatchupReport {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  difficultyHome: BIQTeamDifficulty;
  difficultyAway: BIQTeamDifficulty;
  environment: ReturnType<typeof calculateFantasyEnvironmentScore>;
  notes: string[];
  dataBasis: string[];
}

/** Build a matchup pack for a single game. Safe with partial inputs. */
export function calculateMatchupReport(
  game: BIQGame,
  scheduleGames: BIQGame[],
  ctx?: { players?: BIQPlayer[]; rosterTeamIds?: number[] },
): BIQMatchupReport {
  const dh = calculateTeamDifficulty(game.home_team, scheduleGames);
  const da = calculateTeamDifficulty(game.away_team, scheduleGames);
  const env = calculateFantasyEnvironmentScore(game, ctx);
  const notes: string[] = [];
  if (dh.label === "Trap Spot") notes.push(`${game.home_team} is a trap spot`);
  if (da.label === "Trap Spot") notes.push(`${game.away_team} is a trap spot`);
  if (env.label === "Fantasy Shootout") notes.push("Pace + scoring setup signals shootout");
  if (env.label === "Trap Game") notes.push("Slow tempo despite owned exposure");
  return {
    gameId: game.game_id,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    difficultyHome: dh,
    difficultyAway: da,
    environment: env,
    notes,
    dataBasis: mergeBasis(dh.dataBasis, da.dataBasis, env.dataBasis),
  };
}

/** Per-team upcoming-games count (used by Schedule Edge). */
export function countUpcomingGamesByTeam(games: BIQGame[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of games) {
    if (g.home_team) out[g.home_team.toUpperCase()] = (out[g.home_team.toUpperCase()] ?? 0) + 1;
    if (g.away_team) out[g.away_team.toUpperCase()] = (out[g.away_team.toUpperCase()] ?? 0) + 1;
  }
  return out;
}

/** Returns the opponent tricode for a given team in a game, or null. */
export function opponentOf(game: BIQGame, teamCode: string): string | null {
  if (tricodeEq(game.home_team, teamCode)) return game.away_team ?? null;
  if (tricodeEq(game.away_team, teamCode)) return game.home_team ?? null;
  return null;
}

/** Aggregate matchup score for a player's upcoming slate (0..100, lower=tougher). */
export function aggregatePlayerMatchupDifficulty(
  player: BIQPlayer,
  upcoming: BIQGame[],
  diffMap: Record<string, BIQTeamDifficulty>,
): { score: number; sample: number; dataBasis: string[] } {
  const team = (player.team ?? "").toUpperCase();
  const opps: number[] = [];
  for (const g of upcoming) {
    const opp = opponentOf(g, team);
    if (opp && diffMap[opp.toUpperCase()]) opps.push(diffMap[opp.toUpperCase()].score);
  }
  if (!opps.length) return { score: 50, sample: 0, dataBasis: ["limited_sample"] };
  const avg = opps.reduce((s, n) => s + n, 0) / opps.length;
  return { score: Math.round(avg), sample: opps.length, dataBasis: ["matchup_difficulty"] };
}
