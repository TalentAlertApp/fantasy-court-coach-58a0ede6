import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import { simulateTransactions, commitTransaction, autoPickRoster } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import KpiTiles from "@/components/KpiTiles";
import TransactionsTable from "@/components/TransactionsTable";
import FiltersPanel from "@/components/FiltersPanel";
import PlayerRow from "@/components/PlayerRow";
import PlayerModal from "@/components/PlayerModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, "All"] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { selectedTeamId, teams } = useTeam();
  const { data: rosterData, isLoading: rosterLoading } = useRosterQuery();
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 500 });

  // Transfers state
  const [dropId, setDropId] = useState<string>("");
  const [addId, setAddId] = useState<string>("");
  const [simResult, setSimResult] = useState<any>(null);

  // Waiver Wire state
  const [fcBc, setFcBc] = useState("ALL");
  const [sort, setSort] = useState("fp5");
  const [search, setSearch] = useState("");
  const [maxSalary, setMaxSalary] = useState(999);
  const [waiverMode, setWaiverMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [team, setTeam] = useState("ALL");

  const roster = rosterData?.roster;
  const allPlayers = playersData?.items ?? [];
  const rosterIds = useMemo(() => {
    if (!roster) return new Set<number>();
    return new Set([...(roster.starters ?? []), ...(roster.bench ?? [])]);
  }, [roster]);
  const rosterPlayers = allPlayers.filter((p) => rosterIds.has(p.core.id));
  const availablePlayers = allPlayers.filter((p) => !rosterIds.has(p.core.id));

  const maxSalaryLimit = useMemo(() => {
    if (allPlayers.length === 0) return 50;
    return Math.ceil(Math.max(...allPlayers.map((p) => p.core.salary)));
  }, [allPlayers]);

  // Waiver wire filtered
  const filtered = useMemo(() => {
    let items = [...allPlayers];
    if (fcBc !== "ALL") items = items.filter((p) => p.core.fc_bc === fcBc);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q));
    }
    items = items.filter((p) => p.core.salary <= maxSalary);
    if (team !== "ALL") items = items.filter((p) => p.core.team === team);
    if (waiverMode) {
      items = items.filter((p) => !rosterIds.has(p.core.id));
      items.sort((a, b) => b.computed.value5 - a.computed.value5);
      items = items.slice(0, 25);
    }
    return items;
  }, [allPlayers, fcBc, search, maxSalary, waiverMode, rosterIds, team]);

  useMemo(() => { setCurrentPage(1); }, [fcBc, sort, search, maxSalary, waiverMode, team]);

  const totalItems = filtered.length;
  const effectivePageSize = pageSize === "All" ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const paginatedItems = pageSize === "All"
    ? filtered
    : filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const fcPlayers = paginatedItems.filter((p) => p.core.fc_bc === "FC");
  const bcPlayers = paginatedItems.filter((p) => p.core.fc_bc === "BC");

  // Mutations
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
    simulateMutation.mutate({ gw: roster.gw, day: roster.day, adds: [Number(addId)], drops: [Number(dropId)] });
  };

  const handleCommit = () => {
    if (!roster || !dropId || !addId) return;
    commitMutation.mutate({ gw: roster.gw, day: roster.day, adds: [Number(addId)], drops: [Number(dropId)] });
  };

  const handleAdd = (playerId: number) => {
    if (!roster) return;
    simulateMutation.mutate({ gw: roster.gw, day: roster.day, adds: [playerId], drops: [] });
  };

  const isLoading = rosterLoading || playersLoading;
  const teamName = teams.find((t: any) => t.id === selectedTeamId)?.name ?? "My Team";

  const renderSection = (title: string, players: PlayerListItem[], isFC: boolean) => (
    <div>
      <div className={`section-bar mb-1 rounded-sm ${isFC ? "!bg-destructive/10 !text-destructive" : "!bg-primary/10 !text-primary"}`}>
        {title} ({players.length})
      </div>
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

  const renderPagination = () => (
    <div className="flex items-center justify-between border-t pt-3 mt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Show</span>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(v === "All" ? "All" : Number(v) as any); setCurrentPage(1); }}>
          <SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">of {totalItems} players</span>
      </div>
      {pageSize !== "All" && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">{currentPage} / {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-heading font-bold">{teamName}</h2>
        <span className="text-sm text-muted-foreground font-body">— Transactions</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {roster && (
            <KpiTiles gw={roster.gw} day={roster.day} deadline={roster.deadline_utc} bankRemaining={roster.bank_remaining} freeTransfers={roster.free_transfers_remaining} />
          )}

          <Tabs defaultValue="transfers">
            <TabsList className="rounded-sm">
              <TabsTrigger value="transfers" className="font-heading text-xs uppercase rounded-sm">Transfers</TabsTrigger>
              <TabsTrigger value="waiver" className="font-heading text-xs uppercase rounded-sm">Waiver Wire</TabsTrigger>
            </TabsList>

            <TabsContent value="transfers" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => roster && autoPickMutation.mutate({ gw: roster.gw, day: roster.day, strategy: "fp5" })} disabled={autoPickMutation.isPending}>
                  Auto Pick
                </Button>
                <Button variant="outline" onClick={() => { setSimResult(null); setDropId(""); setAddId(""); }}>Reset</Button>
                <Button variant="secondary" disabled>Play Wildcard</Button>
                <Button variant="secondary" disabled>Play All-Star</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-sm overflow-hidden">
                <div className="bg-card p-3 border-r">
                  <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Drop Player</Label>
                  <Select value={dropId} onValueChange={setDropId}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Select player to drop" /></SelectTrigger>
                    <SelectContent>
                      {rosterPlayers.map((p) => (
                        <SelectItem key={p.core.id} value={String(p.core.id)}>
                          {p.core.name} ({p.core.team}) ${p.core.salary}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-card p-3">
                  <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Add Player</Label>
                  <Select value={addId} onValueChange={setAddId}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Select player to add" /></SelectTrigger>
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

              <Button onClick={handleSimulate} disabled={!dropId || !addId || simulateMutation.isPending} variant="outline">
                Simulate
              </Button>

              <TransactionsTable simulation={simResult} onCommit={handleCommit} committing={commitMutation.isPending} />
            </TabsContent>

            <TabsContent value="waiver" className="space-y-0">
              <div className="flex gap-4 mt-3">
                <div className="w-56 flex-shrink-0">
                  <FiltersPanel
                    fcBc={fcBc} onFcBcChange={setFcBc}
                    sort={sort} onSortChange={setSort}
                    search={search} onSearchChange={setSearch}
                    maxSalary={maxSalary} onMaxSalaryChange={setMaxSalary} maxSalaryLimit={maxSalaryLimit}
                    team={team} onTeamChange={setTeam}
                  />
                  <div className="mt-3 flex items-center gap-2 p-3 bg-card border rounded-sm">
                    <Switch checked={waiverMode} onCheckedChange={setWaiverMode} />
                    <Label className="text-xs font-heading uppercase">Waiver Mode</Label>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  {(fcBc === "ALL" || fcBc === "FC") && renderSection("Front Court", fcPlayers, true)}
                  {(fcBc === "ALL" || fcBc === "BC") && renderSection("Back Court", bcPlayers, false)}
                  {renderPagination()}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
}
