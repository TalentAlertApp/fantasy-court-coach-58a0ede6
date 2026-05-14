import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { isMainLeague } from "@/hooks/useFantasyLeagues";

export type LeagueCode = "nba" | "wnba";

interface LeagueContextValue {
  league: LeagueCode;
  isWnba: boolean;
}

const LeagueContext = createContext<LeagueContextValue>({
  league: "nba",
  isWnba: false,
});

/** Module-level mirror so non-React modules (apiFetch) can read the current league. */
let currentLeague: LeagueCode = "nba";
export function getCurrentLeague(): LeagueCode {
  return currentLeague;
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { sportCode, selectedLeague } = useFantasyLeague();
  const { selectedTeam } = useTeam();
  // Sport is derived from the selected fantasy league. For system Main League
  // rows, the header team pill is the source of truth so NBA/WNBA team switches
  // immediately drive API calls and page data.
  const league: LeagueCode = selectedLeague && !isMainLeague(selectedLeague.id)
    ? sportCode
    : (selectedTeam?.league_code === "wnba" ? "wnba" : "nba");
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

  const value = useMemo(() => ({ league, isWnba: league === "wnba" }), [league]);

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
