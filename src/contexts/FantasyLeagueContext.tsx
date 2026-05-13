import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFantasyLeagues,
  MAIN_LEAGUE_ID,
  type FantasyLeague,
  type RosterRuleSet,
  type DeadlineRuleSet,
  type ChipRuleSet,
  type ScoringRule,
} from "@/hooks/useFantasyLeagues";

const LS_KEY = "fcc_fantasy_league_id";

interface FantasyLeagueContextValue {
  fantasyLeagues: FantasyLeague[];
  selectedLeagueId: string | null;
  selectedLeague: FantasyLeague | null;
  setSelectedLeagueId: (id: string) => void;
  scoringRules: ScoringRule[];
  rosterRules: RosterRuleSet | null;
  deadlineRules: DeadlineRuleSet | null;
  chipRules: ChipRuleSet | null;
  sportCode: "nba" | "wnba";
  isLoading: boolean;
}

const FantasyLeagueContext = createContext<FantasyLeagueContextValue>({
  fantasyLeagues: [],
  selectedLeagueId: null,
  selectedLeague: null,
  setSelectedLeagueId: () => {},
  scoringRules: [],
  rosterRules: null,
  deadlineRules: null,
  chipRules: null,
  sportCode: "nba",
  isLoading: true,
});

/** Module-level mirror so non-React modules can read the current sport. */
let _currentSport: "nba" | "wnba" = "nba";
export function getCurrentFantasySport(): "nba" | "wnba" {
  return _currentSport;
}

export function FantasyLeagueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: leagues = [], isLoading } = useFantasyLeagues();

  const [selectedLeagueId, setSelectedLeagueIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY) || MAIN_LEAGUE_ID; } catch { return MAIN_LEAGUE_ID; }
  });

  // Reconcile: if persisted id isn't in the user's accessible list, fall back to Main League.
  useEffect(() => {
    if (isLoading || leagues.length === 0) return;
    const exists = leagues.some((l) => l.id === selectedLeagueId);
    if (!exists) {
      const fallback = leagues.find((l) => l.id === MAIN_LEAGUE_ID)?.id ?? leagues[0].id;
      setSelectedLeagueIdState(fallback);
      try { localStorage.setItem(LS_KEY, fallback); } catch { /* ignore */ }
    }
  }, [isLoading, leagues, selectedLeagueId]);

  const setSelectedLeagueId = useCallback((id: string) => {
    setSelectedLeagueIdState(id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
    queryClient.invalidateQueries({ queryKey: ["league-standings"] });
    queryClient.invalidateQueries({ queryKey: ["scoring-history"] });
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["players"] });
  }, [queryClient]);

  const selectedLeague = useMemo(
    () => leagues.find((l) => l.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId],
  );

  const sportCode: "nba" | "wnba" = selectedLeague?.sport ?? "nba";

  useEffect(() => { _currentSport = sportCode; }, [sportCode]);

  const value = useMemo<FantasyLeagueContextValue>(() => ({
    fantasyLeagues: leagues,
    selectedLeagueId,
    selectedLeague,
    setSelectedLeagueId,
    scoringRules: selectedLeague?.scoringRules ?? [],
    rosterRules: selectedLeague?.rosterRules ?? null,
    deadlineRules: selectedLeague?.deadlineRules ?? null,
    chipRules: selectedLeague?.chipRules ?? null,
    sportCode,
    isLoading,
  }), [leagues, selectedLeagueId, selectedLeague, setSelectedLeagueId, sportCode, isLoading]);

  return (
    <FantasyLeagueContext.Provider value={value}>
      {children}
    </FantasyLeagueContext.Provider>
  );
}

export function useFantasyLeague() {
  return useContext(FantasyLeagueContext);
}