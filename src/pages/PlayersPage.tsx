import { useState, useMemo } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useMutation } from "@tanstack/react-query";
import { simulateTransactions } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import FiltersPanel from "@/components/FiltersPanel";
import PlayerRow from "@/components/PlayerRow";
import PlayerModal from "@/components/PlayerModal";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

export default function PlayersPage() {
  const [fcBc, setFcBc] = useState("ALL");
  const [sort, setSort] = useState("fp5");
  const [search, setSearch] = useState("");
  const [maxSalary, setMaxSalary] = useState(50);
  const [waiverMode, setWaiverMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const { data: playersData, isLoading } = usePlayersQuery({
    sort, order: "desc", limit: 500,
    ...(fcBc !== "ALL" ? { fc_bc: fcBc } : {}),
    ...(search ? { search } : {}),
  });
  const { data: rosterData } = useRosterQuery();

  const rosterIds = useMemo(() => {
    if (!rosterData?.roster) return new Set<number>();
    return new Set([...rosterData.roster.starters, ...rosterData.roster.bench]);
  }, [rosterData]);

  const filtered = useMemo(() => {
    let items = playersData?.items ?? [];
    items = items.filter((p) => p.core.salary <= maxSalary);
    if (waiverMode) {
      items = items.filter((p) => !rosterIds.has(p.core.id));
      items.sort((a, b) => b.computed.value5 - a.computed.value5);
      items = items.slice(0, 25);
    }
    return items;
  }, [playersData, maxSalary, waiverMode, rosterIds]);

  const fcPlayers = filtered.filter((p) => p.core.fc_bc === "FC");
  const bcPlayers = filtered.filter((p) => p.core.fc_bc === "BC");

  const simulateMutation = useMutation({
    mutationFn: simulateTransactions,
    onSuccess: (data) => {
      toast({
        title: data.is_valid ? "Transaction valid ✓" : "Transaction invalid",
        description: `Delta FP5: ${data.delta.proj_fp5 >= 0 ? "+" : ""}${data.delta.proj_fp5.toFixed(1)}`,
      });
    },
    onError: (err) => {
      toast({ title: "Simulation failed", description: err.message, variant: "destructive" });
    },
  });

  const handleAdd = (playerId: number) => {
    if (!rosterData?.roster) return;
    simulateMutation.mutate({
      gw: rosterData.roster.gw, day: rosterData.roster.day,
      adds: [playerId], drops: [],
    });
  };

  const renderSection = (title: string, players: PlayerListItem[], headerClass: string) => (
    <div>
      <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${headerClass}`}>{title} ({players.length})</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>FC/BC</TableHead>
            <TableHead className="text-right">Salary</TableHead>
            <TableHead className="text-right">FP5</TableHead>
            <TableHead className="text-right">Value5</TableHead>
            <TableHead className="text-right">Last FP</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => (
            <PlayerRow
              key={p.core.id}
              player={p}
              onClick={() => setSelectedPlayerId(p.core.id)}
              actionButton={
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleAdd(p.core.id); }}>
                  Add
                </Button>
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex gap-4">
      <div className="w-64 flex-shrink-0">
        <FiltersPanel
          fcBc={fcBc} onFcBcChange={setFcBc}
          sort={sort} onSortChange={setSort}
          search={search} onSearchChange={setSearch}
          maxSalary={maxSalary} onMaxSalaryChange={setMaxSalary}
        />
        <div className="mt-4 flex items-center gap-2 p-4 bg-card border rounded-lg">
          <Switch checked={waiverMode} onCheckedChange={setWaiverMode} />
          <Label className="text-sm">Waiver Mode</Label>
        </div>
      </div>
      <div className="flex-1 space-y-6">
        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <>
            {(fcBc === "ALL" || fcBc === "FC") && renderSection("Front Court", fcPlayers, "text-nba-red")}
            {(fcBc === "ALL" || fcBc === "BC") && renderSection("Back Court", bcPlayers, "text-primary")}
          </>
        )}
      </div>
      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
}
