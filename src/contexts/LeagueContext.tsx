import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { isKnownCompetition, type CompetitionCode } from "@/lib/competitions";

export type LeagueCode = CompetitionCode;

interface LeagueContextValue {
  league: LeagueCode;
  isWnba: boolean;
  isEuroLeague: boolean;
}

const LeagueContext = createContext<LeagueContextValue>({
  league: "nba",
  isWnba: false,
  isEuroLeague: false,
});

/** Module-level mirror so non-React modules (apiFetch) can read the current league. */
let currentLeague: LeagueCode = "nba";
export function getCurrentLeague(): LeagueCode {
  return currentLeague;
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { sportCode } = useFantasyLeague();
  const { selectedTeam } = useTeam();
  // The header team pill is the source of truth for the active sport. Fall back
  // to the selected fantasy league only before a team has resolved.
  // Unknown league codes are NOT silently coerced to NBA — they fall through to
  // the fantasy-league sport (which is itself a known competition).
  const teamLeague = selectedTeam?.league_code;
  const league: LeagueCode = isKnownCompetition(teamLeague) ? teamLeague : sportCode;
  const previousLeagueRef = useRef<LeagueCode>(league);

  // Keep the module-level mirror synchronous with render. Query functions can
  // run before effects, so waiting for useEffect causes wrong league_code calls.
  if (currentLeague !== league) currentLeague = league;

  // Keep the module-level mirror in sync for non-React callers (apiFetch).
  // When the resolved league changes, wipe all server-data caches so no
  // stale league data flashes through.
  useEffect(() => {
    currentLeague = league;
    if (previousLeagueRef.current !== league) {
      previousLeagueRef.current = league;
      queryClient.invalidateQueries();
    }
  }, [league, queryClient]);

  const value = useMemo(
    () => ({ league, isWnba: league === "wnba", isEuroLeague: league === "euroleague" }),
    [league],
  );

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
