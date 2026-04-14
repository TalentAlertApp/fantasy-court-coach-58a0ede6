import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTeams } from "@/lib/api";

interface TeamContextValue {
  teams: { id: string; name: string; description: string | null }[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string) => void;
  defaultTeamId: string | null;
  isLoading: boolean;
}

const TeamContext = createContext<TeamContextValue>({
  teams: [],
  selectedTeamId: null,
  setSelectedTeamId: () => {},
  defaultTeamId: null,
  isLoading: true,
});

const LS_KEY = "nba_selected_team_id";

export function TeamProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnMount: "always",
  });

  const teams = data?.items ?? [];
  const defaultTeamId = data?.default_team_id ?? null;

  const [selectedTeamId, setSelectedTeamIdRaw] = useState<string | null>(() => {
    return localStorage.getItem(LS_KEY);
  });

  // Sync: if selectedTeamId doesn't exist in teams list, fallback to default
  // Also handle fresh sessions where localStorage might have a stale ID
  useEffect(() => {
    if (isLoading || teams.length === 0) return;
    const exists = teams.some((t: any) => t.id === selectedTeamId);
    if (!exists || !selectedTeamId) {
      const fallback = defaultTeamId ?? teams[0]?.id ?? null;
      setSelectedTeamIdRaw(fallback);
      if (fallback) {
        localStorage.setItem(LS_KEY, fallback);
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }
  }, [teams, selectedTeamId, defaultTeamId, isLoading]);

  // If teams query fails, clear stale localStorage to prevent stuck state
  useEffect(() => {
    if (isError) {
      console.warn("[TeamContext] Teams query failed, clearing stale selection");
      localStorage.removeItem(LS_KEY);
      setSelectedTeamIdRaw(null);
    }
  }, [isError]);

  const setSelectedTeamId = useCallback((id: string) => {
    setSelectedTeamIdRaw(id);
    localStorage.setItem(LS_KEY, id);
    // Invalidate team-scoped queries
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }, [queryClient]);

  return (
    <TeamContext.Provider value={{ teams, selectedTeamId, setSelectedTeamId, defaultTeamId, isLoading }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
