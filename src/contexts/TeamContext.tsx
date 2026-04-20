import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTeams } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

interface TeamContextValue {
  teams: { id: string; name: string; description: string | null }[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string) => void;
  defaultTeamId: string | null;
  isLoading: boolean;
  isReady: boolean;
  isError: boolean;
}

const TeamContext = createContext<TeamContextValue>({
  teams: [],
  selectedTeamId: null,
  setSelectedTeamId: () => {},
  defaultTeamId: null,
  isLoading: true,
  isReady: false,
  isError: false,
});

const LS_KEY = "nba_selected_team_id";

export function TeamProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isSuccess } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    // Avoid refetching on every mount; cached successful data is preserved
    // across navigations and team-scoped queries don't collapse to empty
    // while a background refresh runs.
  });

  const teams = data?.items ?? [];
  const defaultTeamId = data?.default_team_id ?? null;

  const [selectedTeamId, setSelectedTeamIdRaw] = useState<string | null>(() => {
    return localStorage.getItem(LS_KEY);
  });

  // Sync: if selectedTeamId doesn't exist in teams list, OR points to a team
  // with zero roster rows on initial load, fall back to a team that has data.
  // This only runs once at startup — manual switches are preserved.
  const [autoCorrected, setAutoCorrected] = useState(false);
  useEffect(() => {
    if (isLoading || teams.length === 0 || autoCorrected) return;
    const exists = teams.some((t: any) => t.id === selectedTeamId);

    const pickPopulatedTeam = async (): Promise<string | null> => {
      // Query roster counts for all teams; pick the first team with rows.
      const { data: rows } = await supabase
        .from("roster")
        .select("team_id");
      const counts = new Map<string, number>();
      for (const r of (rows ?? []) as any[]) {
        counts.set(r.team_id, (counts.get(r.team_id) ?? 0) + 1);
      }
      // Prefer default team if populated
      if (defaultTeamId && (counts.get(defaultTeamId) ?? 0) > 0) return defaultTeamId;
      // Otherwise first team in list with rows
      const populated = teams.find((t: any) => (counts.get(t.id) ?? 0) > 0);
      if (populated) return populated.id;
      return defaultTeamId ?? teams[0]?.id ?? null;
    };

    (async () => {
      let target: string | null = selectedTeamId;

      if (!exists || !selectedTeamId) {
        target = await pickPopulatedTeam();
      } else {
        // Check if currently-selected team has any roster rows
        const { count } = await supabase
          .from("roster")
          .select("id", { count: "exact", head: true })
          .eq("team_id", selectedTeamId);
        if (!count || count === 0) {
          const better = await pickPopulatedTeam();
          if (better && better !== selectedTeamId) target = better;
        }
      }

      setAutoCorrected(true);
      if (target !== selectedTeamId) {
        setSelectedTeamIdRaw(target);
        if (target) localStorage.setItem(LS_KEY, target);
        else localStorage.removeItem(LS_KEY);
      }
    })();
  }, [teams, selectedTeamId, defaultTeamId, isLoading, autoCorrected]);

  // If teams query fails, KEEP the saved selection so a transient network
  // hiccup doesn't visually wipe the entire app. The next successful fetch
  // will reconcile through the auto-correct effect above.
  useEffect(() => {
    if (isError) {
      console.warn("[TeamContext] Teams query failed; preserving saved selection until next refresh");
    }
  }, [isError]);

  // Readiness: true once teams have successfully loaded AND the selected team
  // (if any) has been resolved/auto-corrected. Team-scoped queries should
  // gate on this so they never fire with a stale or missing team id.
  const isReady = isSuccess && (autoCorrected || (!!selectedTeamId && teams.some((t: any) => t.id === selectedTeamId)));

  const setSelectedTeamId = useCallback((id: string) => {
    setSelectedTeamIdRaw(id);
    localStorage.setItem(LS_KEY, id);
    // Invalidate team-scoped queries
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }, [queryClient]);

  return (
    <TeamContext.Provider value={{ teams, selectedTeamId, setSelectedTeamId, defaultTeamId, isLoading, isReady, isError }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
