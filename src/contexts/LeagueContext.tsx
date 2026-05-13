import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";

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
  // Sport is derived from the selected fantasy league. For the system Main
  // League (which has no fixed sport), fall back to the selected team's
  // league_code so single-sport teams still resolve correctly.
  const league: LeagueCode = selectedLeague && selectedLeague.id !== "00000000-0000-0000-0000-000000000010"
    ? sportCode
    : (selectedTeam?.league_code === "wnba" ? "wnba" : "nba");

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
