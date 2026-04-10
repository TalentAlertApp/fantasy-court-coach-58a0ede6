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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, "All"] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export default function PlayersPage() {
  const [fcBc, setFcBc] = useState("ALL");
  const [sort, setSort] = useState("fp5");
  const [search, setSearch] = useState("");
  const [maxSalary, setMaxSalary] = useState(50);
  const [waiverMode, setWaiverMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [team, setTeam] = useState("ALL");
  const [activeTab, setActiveTab] = useState("overview");
  const [perfMode, setPerfMode] = useState<"pg" | "total">("pg");

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
    if (team !== "ALL") {
      items = items.filter((p) => p.core.team === team);
    }
    if (waiverMode) {
      items = items.filter((p) => !rosterIds.has(p.core.id));
      items.sort((a, b) => b.computed.value5 - a.computed.value5);
      items = items.slice(0, 25);
    }
    return items;
  }, [playersData, maxSalary, waiverMode, rosterIds, team]);

  useMemo(() => { setCurrentPage(1); }, [fcBc, sort, search, maxSalary, waiverMode, team]);

  const totalItems = filtered.length;
  const effectivePageSize = pageSize === "All" ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const paginatedItems = pageSize === "All"
    ? filtered
    : filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const fcPlayers = paginatedItems.filter((p) => p.core.fc_bc === "FC");
  const bcPlayers = paginatedItems.filter((p) => p.core.fc_bc === "BC");

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
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(v === "All" ? "All" : Number(v) as any);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[70px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          of {totalItems} players
        </span>
      </div>

      {pageSize !== "All" && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderPerformanceTab = () => {
    const allItems = playersData?.items ?? [];
    // Sort by FP per game descending
    const perfFiltered = allItems
      .filter((p) => p.season.gp > 0)
      .sort((a, b) => b.season.fp - a.season.fp);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={perfMode} onValueChange={(v) => v && setPerfMode(v as "pg" | "total")}>
            <ToggleGroupItem value="pg" className="font-heading text-xs uppercase rounded-sm h-8">Per Game</ToggleGroupItem>
            <ToggleGroupItem value="total" className="font-heading text-xs uppercase rounded-sm h-8">Totals</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">{perfFiltered.length} players</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Player</TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="text-xs text-right">GP</TableHead>
              <TableHead className="text-xs text-right">PTS</TableHead>
              <TableHead className="text-xs text-right">MP</TableHead>
              <TableHead className="text-xs text-right">REB</TableHead>
              <TableHead className="text-xs text-right">AST</TableHead>
              <TableHead className="text-xs text-right">STL</TableHead>
              <TableHead className="text-xs text-right">BLK</TableHead>
              <TableHead className="text-xs text-right">FP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfFiltered.slice(0, 100).map((p) => {
              const gp = p.season.gp || 1;
              const fmt = (v: number) => perfMode === "total" ? (v * gp).toFixed(0) : v.toFixed(1);
              const teamLogo = getTeamLogo(p.core.team);
              return (
                <TableRow key={p.core.id} className="cursor-pointer hover:bg-accent/30" onClick={() => setSelectedPlayerId(p.core.id)}>
                  <td className="px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5 shrink-0">
                        {p.core.photo && <AvatarImage src={p.core.photo} />}
                        <AvatarFallback className="text-[8px]">{p.core.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{p.core.name}</span>
                      <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-sm">{p.core.fc_bc}</Badge>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                      <span>{p.core.team}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{gp}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono font-bold">{fmt(p.season.pts)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmt(p.season.mpg)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmt(p.season.reb)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmt(p.season.ast)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmt(p.season.stl)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmt(p.season.blk)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono font-bold">{fmt(p.season.fp)}</td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-sm">
          <TabsTrigger value="overview" className="font-heading text-xs uppercase rounded-sm">Waiver Wire</TabsTrigger>
          <TabsTrigger value="performance" className="font-heading text-xs uppercase rounded-sm">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex gap-4">
            <div className="w-56 flex-shrink-0">
              <FiltersPanel
                fcBc={fcBc} onFcBcChange={setFcBc}
                sort={sort} onSortChange={setSort}
                search={search} onSearchChange={setSearch}
                maxSalary={maxSalary} onMaxSalaryChange={setMaxSalary}
                team={team} onTeamChange={setTeam}
              />
              <div className="mt-3 flex items-center gap-2 p-3 bg-card border rounded-sm">
                <Switch checked={waiverMode} onCheckedChange={setWaiverMode} />
                <Label className="text-xs font-heading uppercase">Waiver Mode</Label>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              {isLoading ? (
                <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <>
                  {(fcBc === "ALL" || fcBc === "FC") && renderSection("Front Court", fcPlayers, true)}
                  {(fcBc === "ALL" || fcBc === "BC") && renderSection("Back Court", bcPlayers, false)}
                  {renderPagination()}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            renderPerformanceTab()
          )}
        </TabsContent>
      </Tabs>

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
}
