import { useLeague } from "@/contexts/LeagueContext";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { WNBA_TEAMS } from "@/lib/wnba-teams";
import { EUROLEAGUE_TEAMS } from "@/lib/euroleague-teams";
import type { CompetitionCode } from "@/lib/competitions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo } from "react";
import {
  registerEuroLeagueTeams,
  type EuroLeagueTeamRecord,
} from "@/lib/euroleague-team-registry";

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

  // EuroLeague hydrates from synced sport_teams (logos, venues, city/country).
  // The static EUROLEAGUE_TEAMS catalog stays as instant fallback so the UI
  // never flashes empty while the query resolves.
  const { data: euroleagueRows } = useQuery({
    queryKey: ["euroleague-sport-teams"],
    queryFn: async (): Promise<EuroLeagueTeamRecord[]> => {
      const { data, error } = await supabase
        .from("sport_teams")
        .select("team_code, name, short_name, city, country, venue_name, venue_image_url, logo_url, roster_url, sport_league_id")
        .eq("sport_league_id", "00000000-0000-0000-0000-000000000003");
      if (error) throw error;
      return (data ?? []) as EuroLeagueTeamRecord[];
    },
    enabled: league === "euroleague",
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (euroleagueRows?.length) registerEuroLeagueTeams(euroleagueRows);
  }, [euroleagueRows]);

  const euroleagueTeams = useMemo<LeagueTeam[]>(() => {
    // Resolve each club's synced metadata directly from the fetched rows.
    // Reading from the module-level registry here would race the useEffect
    // that populates it (effects run after render commits), leaving every
    // logo stuck on the static EuroLeague crest fallback.
    const byCode = new Map<string, EuroLeagueTeamRecord>();
    const byName = new Map<string, EuroLeagueTeamRecord>();
    for (const r of euroleagueRows ?? []) {
      if (r.team_code) byCode.set(r.team_code.toUpperCase(), r);
      if (r.name) byName.set(r.name.toLowerCase(), r);
      if (r.short_name) byName.set(r.short_name.toLowerCase(), r);
    }
    return EUROLEAGUE_TEAMS.map((t) => {
      const synced =
        byCode.get(t.tricode.toUpperCase()) ?? byName.get(t.name.toLowerCase());
      return {
        id: t.id,
        name: synced?.name ?? t.name,
        tricode: t.tricode,
        logo: synced?.logo_url || t.logo,
        primaryColor: t.primaryColor,
        conference: null,
        division: null,
        venueName: synced?.venue_name ?? t.venueName ?? null,
        venueImage: synced?.venue_image_url ?? null,
      };
    });
  }, [euroleagueRows]);

  if (league === "euroleague") {
    return { league, teams: euroleagueTeams };
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