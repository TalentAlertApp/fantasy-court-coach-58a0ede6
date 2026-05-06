import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";

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
  const { selectedTeam } = useTeam();
  // League is a property of the selected fantasy team. Legacy teams without
  // an explicit league_code default to NBA.
  const league: LeagueCode = (selectedTeam?.league_code === "wnba") ? "wnba" : "nba";

  // Keep the module-level mirror in sync for non-React callers (apiFetch).
  // When the resolved league changes, wipe all server-data caches so no
  // stale league data flashes through.
  useEffect(() => {
    if (currentLeague !== league) {
      currentLeague = league;
      queryClient.invalidateQueries();
    } else {
      currentLeague = league;
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
