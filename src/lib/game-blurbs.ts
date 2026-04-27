import type { z } from "zod";
import type { GameBoxscorePlayerSchema, PlayerListItemSchema } from "@/lib/contracts";

type BoxPlayer = z.infer<typeof GameBoxscorePlayerSchema>;
type ListPlayer = z.infer<typeof PlayerListItemSchema>;

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Pick the highest-FP player on a given team in a finished box-score. */
export function pickGameLeader(players: BoxPlayer[], team: string): BoxPlayer | null {
  const team_players = players.filter((p) => p.team === team);
  if (team_players.length === 0) return null;
  return team_players.reduce((best, p) => (p.fp > best.fp ? p : best), team_players[0]);
}

/** Slang verb phrase for a played game leader. Picks the most distinctive line. */
export function describePlayed(p: BoxPlayer): string {
  const stocks = (p.stl ?? 0) + (p.blk ?? 0);
  if (p.fp >= 60) return `went supernova (${p.fp} FP, ${p.ps}/${p.reb}/${p.ast})`;
  if (p.ps >= 35) return `dropped ${p.ps} PTS`;
  if (p.ps >= 25 && p.ast >= 7) return `cooked for ${p.ps} & ${p.ast} dimes`;
  if (p.ast >= 10) return `dished ${p.ast} dimes`;
  if (p.reb >= 14) return `crashed the glass for ${p.reb} boards`;
  if (stocks >= 5) return `wreaked havoc with ${stocks} stocks`;
  if (p.ps >= 25) return `dropped ${p.ps} PTS`;
  if (p.fp >= 40) return `stuffed the sheet (${p.fp} FP)`;
  if (p.ast >= 6) return `dished ${p.ast} dimes`;
  if (p.reb >= 10) return `pulled down ${p.reb} boards`;
  return `posted ${p.ps}/${p.reb}/${p.ast} for ${p.fp} FP`;
}

/** Build the "Outstanding Players" sentence for a finished game. */
export function buildOutstandingBlurb(
  players: BoxPlayer[],
  awayTeam: string,
  homeTeam: string,
): string | null {
  const a = pickGameLeader(players, awayTeam);
  const h = pickGameLeader(players, homeTeam);
  if (!a && !h) return null;
  const parts: string[] = [];
  if (a) parts.push(`${lastName(a.name)} ${describePlayed(a)}`);
  if (h) parts.push(`${lastName(h.name)} ${describePlayed(h)}`);
  return parts.join("; ") + ".";
}

/** Pick the highest season-FP player on a given team from the league players list. */
export function pickWatchLeader(items: ListPlayer[], team: string): ListPlayer | null {
  const team_players = items.filter(
    (p) => p.core.team === team && p.flags.injury !== "OUT",
  );
  if (team_players.length === 0) return null;
  return team_players.reduce(
    (best, p) => (p.season.fp > best.season.fp ? p : best),
    team_players[0],
  );
}

/** Slang form-narrative for a player not yet in the game. */
export function describeWatch(p: ListPlayer): string {
  const fp = p.season.fp.toFixed(1);
  const fp5 = p.last5.fp5.toFixed(1);
  const v5 = p.computed.value5.toFixed(1);
  const delta = p.computed.delta_fp;
  if (delta >= 7) return `red-hot — ${fp5} FP5 (V5 ${v5}), heating up fast`;
  if (delta >= 3) return `trending up at ${fp5} FP5 (V5 ${v5})`;
  if (delta <= -7) return `due for a bounce-back, season ${fp} FP`;
  if (delta <= -3) return `cooling off lately, ${fp5} FP5 vs ${fp} season`;
  if (p.flags.injury) return `questionable but locked in at ${fp} FP/g`;
  return `humming at ${fp} FP/g (V5 ${v5})`;
}

/** Build the "Players to Watch" sentence for a scheduled game. */
export function buildWatchBlurb(
  items: ListPlayer[],
  awayTeam: string,
  homeTeam: string,
): string | null {
  const a = pickWatchLeader(items, awayTeam);
  const h = pickWatchLeader(items, homeTeam);
  if (!a && !h) return null;
  const parts: string[] = [];
  if (a) parts.push(`${lastName(a.core.name)} ${describeWatch(a)}`);
  if (h) parts.push(`${lastName(h.core.name)} ${describeWatch(h)}`);
  return parts.join("; ") + ".";
}