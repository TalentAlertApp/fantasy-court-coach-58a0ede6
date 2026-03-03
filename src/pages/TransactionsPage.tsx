import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import { simulateTransactions, commitTransaction, autoPickRoster } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import KpiTiles from "@/components/KpiTiles";
import TransactionsTable from "@/components/TransactionsTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { selectedTeamId, teams } = useTeam();
  const { data: rosterData, isLoading: rosterLoading } = useRosterQuery();
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 500 });

  const [dropId, setDropId] = useState<string>("");
  const [addId, setAddId] = useState<string>("");
  const [simResult, setSimResult] = useState<any>(null);

  const roster = rosterData?.roster;
  const allPlayers = playersData?.items ?? [];
  const rosterIds = new Set([...(roster?.starters ?? []), ...(roster?.bench ?? [])]);
  const rosterPlayers = allPlayers.filter((p) => rosterIds.has(p.core.id));
  const availablePlayers = allPlayers.filter((p) => !rosterIds.has(p.core.id));

  const simulateMutation = useMutation({
    mutationFn: (body: Parameters<typeof simulateTransactions>[0]) =>
      simulateTransactions(body, selectedTeamId ?? undefined),
    onSuccess: (data) => setSimResult(data),
    onError: (err) => toast({ title: "Simulation failed", description: err.message, variant: "destructive" }),
  });

  const commitMutation = useMutation({
    mutationFn: (body: Parameters<typeof commitTransaction>[0]) =>
      commitTransaction(body, selectedTeamId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Transaction committed!" });
      setSimResult(null); setDropId(""); setAddId("");
    },
    onError: (err) => toast({ title: "Commit failed", description: err.message, variant: "destructive" }),
  });

  const autoPickMutation = useMutation({
    mutationFn: (body: Parameters<typeof autoPickRoster>[0]) =>
      autoPickRoster(body, selectedTeamId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Auto-pick applied!" });
    },
    onError: (err) => toast({ title: "Auto-pick failed", description: err.message, variant: "destructive" }),
  });


  const handleSimulate = () => {
    if (!roster || !dropId || !addId) return;
    simulateMutation.mutate({
      gw: roster.gw, day: roster.day,
      adds: [Number(addId)], drops: [Number(dropId)],
    });
  };

  const handleCommit = () => {
    if (!roster || !dropId || !addId) return;
    commitMutation.mutate({
      gw: roster.gw, day: roster.day,
      adds: [Number(addId)], drops: [Number(dropId)],
    });
  };

  const isLoading = rosterLoading || playersLoading;

  const teamName = teams.find((t: any) => t.id === selectedTeamId)?.name ?? "My Team";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{teamName}</h2>
        <span className="text-sm text-muted-foreground">— Transactions</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {roster && (
            <KpiTiles
              gw={roster.gw} day={roster.day}
              deadline={roster.deadline_utc}
              bankRemaining={roster.bank_remaining}
              freeTransfers={roster.free_transfers_remaining}
            />
          )}

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => roster && autoPickMutation.mutate({ gw: roster.gw, day: roster.day, strategy: "fp5" })}
              disabled={autoPickMutation.isPending}
              className="bg-nba-yellow text-foreground hover:bg-nba-yellow/90"
            >
              Auto Pick
            </Button>
            <Button variant="outline" onClick={() => { setSimResult(null); setDropId(""); setAddId(""); }}>Reset</Button>
            <Button variant="outline" disabled>Play Wildcard</Button>
            <Button variant="outline" disabled>Play All-Star</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card border rounded-lg">
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-2 block">Drop Player</Label>
              <Select value={dropId} onValueChange={setDropId}>
                <SelectTrigger><SelectValue placeholder="Select player to drop" /></SelectTrigger>
                <SelectContent>
                  {rosterPlayers.map((p) => (
                    <SelectItem key={p.core.id} value={String(p.core.id)}>
                      {p.core.name} ({p.core.team}) ${p.core.salary}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-2 block">Add Player</Label>
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger><SelectValue placeholder="Select player to add" /></SelectTrigger>
                <SelectContent>
                  {availablePlayers.slice(0, 50).map((p) => (
                    <SelectItem key={p.core.id} value={String(p.core.id)}>
                      {p.core.name} ({p.core.team}) ${p.core.salary}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSimulate} disabled={!dropId || !addId || simulateMutation.isPending}>
            Simulate
          </Button>

          <TransactionsTable
            simulation={simResult}
            onCommit={handleCommit}
            committing={commitMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
