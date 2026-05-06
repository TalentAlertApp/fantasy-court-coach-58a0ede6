import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type LeagueCode = "nba" | "wnba";

interface LeagueContextValue {
  league: LeagueCode;
  setLeague: (code: LeagueCode) => void;
  isWnba: boolean;
}

const LS_KEY = "selected_league_code";

const LeagueContext = createContext<LeagueContextValue>({
  league: "nba",
  setLeague: () => {},
  isWnba: false,
});

/** Module-level mirror so non-React modules (apiFetch) can read the current league. */
let currentLeague: LeagueCode = "nba";
export function getCurrentLeague(): LeagueCode {
  return currentLeague;
}

function readInitial(): LeagueCode {
  if (typeof window === "undefined") return "nba";
  const v = localStorage.getItem(LS_KEY);
  return v === "wnba" ? "wnba" : "nba";
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [league, setLeagueState] = useState<LeagueCode>(() => {
    const v = readInitial();
    currentLeague = v;
    return v;
  });

  const setLeague = useCallback(
    (code: LeagueCode) => {
      currentLeague = code;
      setLeagueState(code);
      try {
        localStorage.setItem(LS_KEY, code);
      } catch {
        /* ignore */
      }
      // Wipe all server-data caches so no NBA-data flashes through after a switch.
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  return (
    <LeagueContext.Provider value={{ league, setLeague, isWnba: league === "wnba" }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
