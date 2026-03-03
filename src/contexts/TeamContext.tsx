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
  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    staleTime: 60_000,
  });

  const teams = data?.items ?? [];
  const defaultTeamId = data?.default_team_id ?? null;

  const [selectedTeamId, setSelectedTeamIdRaw] = useState<string | null>(() => {
    return localStorage.getItem(LS_KEY);
  });

  // Sync: if selectedTeamId doesn't exist in teams list, fallback to default
  useEffect(() => {
    if (isLoading || teams.length === 0) return;
    const exists = teams.some((t: any) => t.id === selectedTeamId);
    if (!exists) {
      const fallback = defaultTeamId ?? teams[0]?.id ?? null;
      setSelectedTeamIdRaw(fallback);
      if (fallback) localStorage.setItem(LS_KEY, fallback);
    }
  }, [teams, selectedTeamId, defaultTeamId, isLoading]);

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
