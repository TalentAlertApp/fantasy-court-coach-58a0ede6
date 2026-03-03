import { useState, useMemo, useCallback } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useTeam } from "@/contexts/TeamContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveRoster } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import KpiTiles from "@/components/KpiTiles";
import RosterCourtView from "@/components/RosterCourtView";
import RosterListView from "@/components/RosterListView";
import BottomActionBar from "@/components/BottomActionBar";
import OptimizeDialog from "@/components/OptimizeDialog";
import PlayerModal from "@/components/PlayerModal";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { optimizeLineup, type OptimizerPlayer, type OptimizerResult } from "@/lib/optimizer";
import { LayoutGrid, List, Zap } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

export default function RosterPage() {
  const queryClient = useQueryClient();
  const { selectedTeamId } = useTeam();
  const { data: rosterData, isLoading: rosterLoading } = useRosterQuery();
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 500 });

  const [viewMode, setViewMode] = useState<"court" | "list">("court");
  const [captainId, setCaptainId] = useState<number>(0);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<OptimizerResult | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const roster = rosterData?.roster;
  const allPlayers = playersData?.items ?? [];

  // Resolve player IDs to full objects
  const resolvePlayer = useCallback(
    (id: number) => allPlayers.find((p) => p.core.id === id),
    [allPlayers]
  );

  const starters = useMemo(
    () => (roster?.starters ?? []).map(resolvePlayer).filter(Boolean) as PlayerListItem[],
    [roster?.starters, resolvePlayer]
  );

  const bench = useMemo(
    () => (roster?.bench ?? []).map(resolvePlayer).filter(Boolean) as PlayerListItem[],
    [roster?.bench, resolvePlayer]
  );

  // Set initial captain
  useMemo(() => {
    if (captainId === 0 && roster?.captain_id) setCaptainId(roster.captain_id);
  }, [roster?.captain_id, captainId]);

  const saveMutation = useMutation({
    mutationFn: (body: Parameters<typeof saveRoster>[0]) =>
      saveRoster(body, selectedTeamId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Lineup saved!" });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!roster) return;
    if (starters.length !== 5 || bench.length !== 5) {
      toast({ title: "Invalid lineup", description: "Need exactly 5 starters and 5 bench", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      gw: roster.gw,
      day: roster.day,
      starters: starters.map((p) => p.core.id),
      bench: bench.map((p) => p.core.id),
      captain_id: captainId || starters[0]?.core.id || 0,
    });
  };

  const handleOptimize = () => {
    const toOpt = (p: PlayerListItem): OptimizerPlayer => ({
      id: p.core.id, name: p.core.name, team: p.core.team,
      fc_bc: p.core.fc_bc, salary: p.core.salary, fp5: p.last5.fp5,
    });
    const result = optimizeLineup(
      starters.map(toOpt),
      bench.map(toOpt),
      roster?.constraints ?? { salary_cap: 100, starter_fc_min: 2, starter_bc_min: 2 }
    );
    setOptimizerResult(result);
    setOptimizeOpen(true);
  };

  const handleApplyOptimization = () => {
    if (!optimizerResult || !roster) return;
    saveMutation.mutate({
      gw: roster.gw, day: roster.day,
      starters: optimizerResult.newStarters,
      bench: optimizerResult.newBench,
      captain_id: captainId,
    });
    setOptimizeOpen(false);
  };

  const isLoading = rosterLoading || playersLoading;

  return (
    <div className="space-y-4 pb-20">
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {roster && (
            <KpiTiles
              gw={roster.gw}
              day={roster.day}
              deadline={roster.deadline_utc}
              bankRemaining={roster.bank_remaining}
              freeTransfers={roster.free_transfers_remaining}
            />
          )}

          <div className="flex items-center justify-between">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "court" | "list")}>
              <ToggleGroupItem value="court"><LayoutGrid className="h-4 w-4 mr-1" />Court</ToggleGroupItem>
              <ToggleGroupItem value="list"><List className="h-4 w-4 mr-1" />List</ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={handleOptimize} variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-1" />Optimize
            </Button>
          </div>

          {viewMode === "court" ? (
            <RosterCourtView starters={starters} bench={bench} captainId={captainId} onPlayerClick={setSelectedPlayerId} />
          ) : (
            <RosterListView starters={starters} bench={bench} onPlayerClick={setSelectedPlayerId} />
          )}

          {starters.length > 0 && (
            <BottomActionBar
              starters={starters}
              captainId={captainId}
              onCaptainChange={setCaptainId}
              onSave={handleSave}
              saving={saveMutation.isPending}
            />
          )}

          <OptimizeDialog
            open={optimizeOpen}
            onOpenChange={setOptimizeOpen}
            result={optimizerResult}
            onApply={handleApplyOptimization}
            applying={saveMutation.isPending}
          />

          <PlayerModal
            playerId={selectedPlayerId}
            open={selectedPlayerId !== null}
            onOpenChange={(open) => !open && setSelectedPlayerId(null)}
          />
        </>
      )}
    </div>
  );
}
