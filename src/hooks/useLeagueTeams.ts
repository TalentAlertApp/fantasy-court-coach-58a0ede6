import { useLeague } from "@/contexts/LeagueContext";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { WNBA_TEAMS } from "@/lib/wnba-teams";
import { EUROLEAGUE_TEAMS } from "@/lib/euroleague-teams";
import type { CompetitionCode } from "@/lib/competitions";

export interface LeagueTeam {
  id: string;
  name: string;
  tricode: string;
  logo: string;
  primaryColor: string;
  conference?: string | null;
  division?: string | null;
  venueName?: string | null;
  venueImage?: string | null;
}

import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
import { NBA_VENUES } from "@/lib/nba-venues";

/**
 * Returns the active league's team catalog as a uniform shape so pages
 * (Teams, Filters, Schedule grids, Advanced) don't import NBA_TEAMS directly.
 */
export function useLeagueTeams(): { league: CompetitionCode; teams: LeagueTeam[] } {
  const { league } = useLeague();
  if (league === "euroleague") {
    return {
      league,
      teams: EUROLEAGUE_TEAMS.map((t) => ({
        id: t.id,
        name: t.name,
        tricode: t.tricode,
        logo: t.logo,
        primaryColor: t.primaryColor,
        conference: null,
        division: null,
        venueName: t.venueName ?? null,
        venueImage: null,
      })),
    };
  }
  if (league === "wnba") {
    return {
      league,
      teams: WNBA_TEAMS.map((t) => ({
        id: t.id,
        name: t.name,
        tricode: t.tricode,
        logo: t.logo,
        primaryColor: t.primaryColor,
        conference: t.conference ?? null,
        division: null,
        venueName: t.venueName ?? null,
        venueImage: t.venueImage ?? null,
      })),
    };
  }
  return {
    league: "nba",
    teams: NBA_TEAMS.map((t) => {
      const meta = NBA_TEAM_META[t.tricode];
      const v = NBA_VENUES[t.tricode];
      return {
        id: t.id,
        name: t.name,
        tricode: t.tricode,
        logo: t.logo,
        primaryColor: t.primaryColor,
        conference: meta?.conference ?? null,
        division: meta?.division ?? null,
        venueName: v?.name ?? null,
        venueImage: v?.image ?? null,
      };
    }),
  };
}