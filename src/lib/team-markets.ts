import { getEuroLeagueTeamRecord } from "@/lib/euroleague-team-registry";
import type { CompetitionCode } from "@/lib/competitions";

/**
 * Team "Market" (home city) lookups for the Standings venue companion table.
 * NBA + WNBA use explicit tricode→city maps for accuracy; EuroLeague reads the
 * synced `sport_teams.city`. A name-based fallback covers any gaps so a cell
 * never renders blank.
 */

const NBA_MARKETS: Record<string, string> = {
  ATL: "Atlanta",
  BOS: "Boston",
  BKN: "Brooklyn",
  CHA: "Charlotte",
  CHI: "Chicago",
  CLE: "Cleveland",
  DAL: "Dallas",
  DEN: "Denver",
  DET: "Detroit",
  GSW: "San Francisco",
  HOU: "Houston",
  IND: "Indianapolis",
  LAC: "Los Angeles",
  LAL: "Los Angeles",
  MEM: "Memphis",
  MIA: "Miami",
  MIL: "Milwaukee",
  MIN: "Minneapolis",
  NOP: "New Orleans",
  NYK: "New York",
  OKC: "Oklahoma City",
  ORL: "Orlando",
  PHI: "Philadelphia",
  PHX: "Phoenix",
  POR: "Portland",
  SAC: "Sacramento",
  SAS: "San Antonio",
  TOR: "Toronto",
  UTA: "Salt Lake City",
  WAS: "Washington",
};

const WNBA_MARKETS: Record<string, string> = {
  ATL: "Atlanta",
  CHI: "Chicago",
  CON: "Uncasville",
  IND: "Indianapolis",
  NYL: "Brooklyn",
  TOR: "Toronto",
  WAS: "Washington",
  DAL: "Arlington",
  GSV: "San Francisco",
  LVA: "Las Vegas",
  LAS: "Los Angeles",
  MIN: "Minneapolis",
  PHX: "Phoenix",
  POR: "Portland",
  SEA: "Seattle",
};

/** Derive a plausible city from a full team name (drops the trailing nickname). */
function deriveFromName(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.trim();
  // Most franchises are "<City...> <Nickname>"; drop the last word as nickname.
  return parts.slice(0, -1).join(" ");
}

export function getTeamMarket(
  league: CompetitionCode,
  tricode: string,
  name?: string | null,
): string {
  const t = (tricode || "").toUpperCase();
  if (league === "nba" && NBA_MARKETS[t]) return NBA_MARKETS[t];
  if (league === "wnba" && WNBA_MARKETS[t]) return WNBA_MARKETS[t];
  if (league === "euroleague") {
    const rec = getEuroLeagueTeamRecord(t) ?? getEuroLeagueTeamRecord(name ?? "");
    if (rec?.city) return rec.city;
  }
  return deriveFromName(name);
}