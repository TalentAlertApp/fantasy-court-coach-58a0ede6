import { useState, useMemo, useEffect } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useTeam } from "@/contexts/TeamContext";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerModal from "@/components/PlayerModal";
import FiltersPanel from "@/components/FiltersPanel";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamLogo } from "@/lib/nba-teams";
import { ChevronLeft, ChevronRight, Plus, Minus, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentGameday } from "@/lib/deadlines";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, "All"] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
type SortKey = "fp5" | "salary" | "value5" | "lastFp";

export default function PlayersPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [perfMode, setPerfMode] = useState<"pg" | "total">("pg");
  const [fcBc, setFcBc] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("fp5");
  const [search, setSearch] = useState("");
  const [maxSalary, setMaxSalary] = useState(50);
  const [team, setTeam] = useState("ALL");
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<string>("fp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { selectedTeamId } = useTeam();
  const queryClient = useQueryClient();
  const { data: playersData, isLoading } = usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 });
  const { data: rosterData } = useRosterQuery();
  const allPlayers = playersData?.items ?? [];

  // Build roster lookup
  const rosterPlayerIds = useMemo(() => {
    if (!rosterData?.starters && !rosterData?.bench) return new Set<number>();
    const ids = new Set<number>();
    for (const s of rosterData?.starters ?? []) if (s.player_id) ids.add(s.player_id);
    for (const b of rosterData?.bench ?? []) if (b.player_id) ids.add(b.player_id);
    return ids;
  }, [rosterData]);

  // Team count for max-2-per-team rule
  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!rosterData) return counts;
    const allSlots = [...(rosterData.starters ?? []), ...(rosterData.bench ?? [])];
    for (const s of allSlots) {
      if (s.player_id && s.team) {
        counts[s.team] = (counts[s.team] || 0) + 1;
      }
    }
    return counts;
  }, [rosterData]);

  const maxSalaryLimit = useMemo(() => {
    if (allPlayers.length === 0) return 50;
    return Math.ceil(Math.max(...allPlayers.map((p) => p.core.salary)));
  }, [allPlayers]);

  useEffect(() => { if (maxSalaryLimit > 0) setMaxSalary(maxSalaryLimit); }, [maxSalaryLimit]);
  useEffect(() => { setCurrentPage(1); }, [fcBc, sort, search, maxSalary, team]);

  const filtered = useMemo(() => {
    let items = allPlayers.filter((p) => p.season.gp > 0);
    if (fcBc !== "ALL") items = items.filter((p) => p.core.fc_bc === fcBc);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q));
    }
    items = items.filter((p) => p.core.salary <= maxSalary);
    if (team !== "ALL") items = items.filter((p) => p.core.team === team);
    items.sort((a, b) => {
      const getVal = (p: PlayerListItem): number => {
        const gp = p.season.gp || 1;
        const s = p.season as any;
        if (sortCol === "gp") return p.season.gp;
        if (sortCol === "salary") return p.core.salary;
        if (perfMode === "total") return s[`total_${sortCol}`] ?? 0;
        else { const tk = `total_${sortCol}`; return s[tk] !== undefined ? s[tk] / gp : 0; }
      };
      return sortDir === "desc" ? getVal(b) - getVal(a) : getVal(a) - getVal(b);
    });
    return items;
  }, [allPlayers, fcBc, search, maxSalary, team, sortCol, sortDir, perfMode]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const totalItems = filtered.length;
  const effectivePageSize = pageSize === "All" ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const paginatedItems = pageSize === "All" ? filtered : filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const columnTooltips: Record<string, { pg: string; total: string }> = {
    pts: { pg: "Points per game", total: "Total points scored" },
    mp: { pg: "Minutes per game", total: "Total minutes played" },
    reb: { pg: "Rebounds per game", total: "Total rebounds" },
    ast: { pg: "Assists per game", total: "Total assists" },
    stl: { pg: "Steals per game", total: "Total steals" },
    blk: { pg: "Blocks per game", total: "Total blocks" },
    fp: { pg: "Fantasy points per game", total: "Total fantasy points" },
  };

  const columns = [
    { key: "pts", label: "PTS" },
    { key: "mp", label: "MP" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
    { key: "fp", label: "FP" },
  ];

  const handleAddPlayer = async (playerId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTeamId) { toast.error("Select a team first"); return; }
    const current = getCurrentGameday();
    // Find an empty slot
    const starters = rosterData?.starters ?? [];
    const bench = rosterData?.bench ?? [];
    let slot: string | null = null;
    for (let i = 0; i < 5; i++) {
      if (!starters[i] || !starters[i].player_id) { slot = `starter_${i + 1}`; break; }
    }
    if (!slot) {
      for (let i = 0; i < 5; i++) {
        if (!bench[i] || !bench[i].player_id) { slot = `bench_${i + 1}`; break; }
      }
    }
    if (!slot) { toast.error("Roster is full (10/10)"); return; }

    const { error } = await supabase.from("roster").insert({
      team_id: selectedTeamId,
      player_id: playerId,
      slot,
      gw: current.gw,
      day: current.day,
    });
    if (error) { toast.error("Failed to add player"); return; }
    toast.success("Player added to roster");
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
  };

  const handleRemovePlayer = async (playerId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTeamId) return;
    const { error } = await supabase.from("roster").delete().eq("team_id", selectedTeamId).eq("player_id", playerId);
    if (error) { toast.error("Failed to remove player"); return; }
    toast.success("Player removed from roster");
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-heading font-bold">Transactions</h2>
        <ToggleGroup type="single" value={perfMode} onValueChange={(v) => v && setPerfMode(v as "pg" | "total")}>
          <ToggleGroupItem value="pg" className="font-heading text-xs uppercase rounded-sm h-8">Per Game</ToggleGroupItem>
          <ToggleGroupItem value="total" className="font-heading text-xs uppercase rounded-sm h-8">Totals</ToggleGroupItem>
        </ToggleGroup>
        <span className="text-xs text-muted-foreground ml-auto">{totalItems} players</span>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">Player</TableHead>
                  <TableHead className="text-xs">Team</TableHead>
                  <TableHead className={`text-xs text-right cursor-pointer select-none ${sortCol === "gp" ? "font-bold" : ""}`} onClick={() => handleSort("gp")}>GP</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={`text-xs text-right cursor-pointer select-none ${sortCol === c.key ? "font-bold" : ""}`} onClick={() => handleSort(c.key)}>
                      <span className="inline-flex items-center gap-0.5">
                        {c.label}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground inline" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {perfMode === "pg" ? columnTooltips[c.key]?.pg : columnTooltips[c.key]?.total}
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className={`text-xs text-right cursor-pointer select-none ${sortCol === "salary" ? "font-bold" : ""}`} onClick={() => handleSort("salary")}>$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((p) => {
                  const gp = p.season.gp || 1;
                  const s = p.season as any;
                  const fmtPg = (key: string) => { const tk = `total_${key}`; return s[tk] !== undefined ? (s[tk] / gp).toFixed(1) : "0.0"; };
                  const fmtTot = (key: string) => { const tk = `total_${key}`; return s[tk] !== undefined ? Math.round(s[tk]).toString() : "0"; };
                  const teamLogo = getTeamLogo(p.core.team);
                  const isOnRoster = rosterPlayerIds.has(p.core.id);
                  const teamAtMax = (teamCounts[p.core.team] ?? 0) >= 2;
                  const canAdd = !isOnRoster && !teamAtMax && rosterPlayerIds.size < 10;

                  return (
                    <TableRow key={p.core.id} className="cursor-pointer hover:bg-accent/30 group" onClick={() => setSelectedPlayerId(p.core.id)}>
                      <td className="px-1 py-1">
                        {isOnRoster ? (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => handleRemovePlayer(p.core.id, e)} title="Remove from roster">
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-500/10" onClick={(e) => handleAddPlayer(p.core.id, e)} disabled={!canAdd} title={teamAtMax ? "Max 2 per team" : "Add to roster"}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-7 w-7 shrink-0 rounded-full transition-transform group-hover:scale-110">
                            {p.core.photo && <AvatarImage src={p.core.photo} />}
                            <AvatarFallback className="text-[8px]">{p.core.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-sm">{p.core.fc_bc}</Badge>
                          <span className="font-medium whitespace-nowrap">{p.core.name}</span>
                          {isOnRoster && <Badge variant="outline" className="text-[7px] px-1 py-0 rounded-sm border-green-500/50 text-green-600">ROSTER</Badge>}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        <div className="flex items-center gap-1">
                          {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                          <span>{p.core.team}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right font-mono">{gp}</td>
                      {columns.map((c) => (
                        <td key={c.key} className={`px-2 py-1.5 text-xs text-right font-mono ${c.key === "pts" || c.key === "fp" ? "font-bold" : ""}`}>
                          {perfMode === "total" ? fmtTot(c.key) : fmtPg(c.key)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-xs text-right font-mono">${p.core.salary}</td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Show</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(v === "All" ? "All" : Number(v) as any); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZE_OPTIONS.map((opt) => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">of {totalItems} players</span>
              </div>
              {pageSize !== "All" && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted-foreground px-2">{currentPage} / {totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </div>

          <div className="w-56 flex-shrink-0">
            <FiltersPanel fcBc={fcBc} onFcBcChange={setFcBc} sort={sort} onSortChange={(v) => setSort(v as SortKey)} search={search} onSearchChange={setSearch} maxSalary={maxSalary} onMaxSalaryChange={setMaxSalary} maxSalaryLimit={maxSalaryLimit} team={team} onTeamChange={setTeam} />
          </div>
        </div>
      )}

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
    </div>
  );
}
