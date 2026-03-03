import { useMemo } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import ChartsPanel from "@/components/ChartsPanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsPage() {
  const { data: rosterData, isLoading: rosterLoading } = useRosterQuery();
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 500 });

  const roster = rosterData?.roster;
  const allPlayers = playersData?.items ?? [];

  const resolve = (id: number) => allPlayers.find((p) => p.core.id === id);

  const starters = useMemo(
    () => (roster?.starters ?? []).map(resolve).filter(Boolean) as typeof allPlayers,
    [roster, allPlayers]
  );
  const bench = useMemo(
    () => (roster?.bench ?? []).map(resolve).filter(Boolean) as typeof allPlayers,
    [roster, allPlayers]
  );

  const isLoading = rosterLoading || playersLoading;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-heading font-bold">Stats Hub</h2>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : starters.length === 0 && bench.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading uppercase">No Roster Data</p>
          <p className="text-sm font-body">Set up your roster first to see stats</p>
        </div>
      ) : (
        <ChartsPanel starters={starters} bench={bench} allRoster={[...starters, ...bench]} />
      )}
    </div>
  );
}
