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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getTeamLogo } from "@/lib/nba-teams";
import { ChevronLeft, ChevronRight, Plus, Minus, Sparkles, RefreshCw, Bot, X, Check, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentGameday } from "@/lib/deadlines";
import AICoachModal from "@/components/AICoachModal";

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
  const [releasing, setReleasing] = useState<number[]>([]);
  const [chipAllStar, setChipAllStar] = useState(false);
  const [chipWildcard, setChipWildcard] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [tradePopoverOpen, setTradePopoverOpen] = useState(false);

  const { selectedTeamId } = useTeam();
  const queryClient = useQueryClient();
  const { data: playersData, isLoading } = usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 });
  const { data: rosterData } = useRosterQuery();
  const allPlayers = playersData?.items ?? [];

  // roster-current returns { roster: { starters: number[], bench: number[], bank_remaining } }
  // — IDs only. Hydrate names/teams/salaries from the already-loaded `allPlayers` list.
  const rosterIdList = useMemo(() => {
    const r: any = (rosterData as any)?.roster ?? rosterData;
    const starters: number[] = Array.isArray(r?.starters) ? r.starters : [];
    const bench: number[] = Array.isArray(r?.bench) ? r.bench : [];
    return [...starters, ...bench].filter((id) => typeof id === "number" && id > 0);
  }, [rosterData]);

  const rosterPlayerIds = useMemo(() => new Set<number>(rosterIdList), [rosterIdList]);

  const rosterPlayers = useMemo(() => {
    return rosterIdList
      .map((id) => allPlayers.find((p) => p.core.id === id))
      .filter((p): p is PlayerListItem => !!p)
      .map((p) => ({
        player_id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        salary: p.core.salary,
        fc_bc: p.core.fc_bc,
        photo: p.core.photo ?? null,
      }));
  }, [rosterIdList, allPlayers]);

  const releasingMap = useMemo(() => {
    const m = new Map<number, typeof rosterPlayers[number]>();
    for (const p of rosterPlayers) if (releasing.includes(p.player_id)) m.set(p.player_id, p);
    return m;
  }, [rosterPlayers, releasing]);

  const releaseCap = chipAllStar || chipWildcard ? 10 : 2;
  const bankRemaining = (rosterData as any)?.roster?.bank_remaining ?? (rosterData as any)?.bank_remaining ?? 0;
  const releasedSalary = useMemo(
    () => Array.from(releasingMap.values()).reduce((s, p) => s + (p.salary ?? 0), 0),
    [releasingMap],
  );
  const availableBudget = bankRemaining + releasedSalary;
  const budgetClass = availableBudget > 0 ? "text-emerald-500" : availableBudget < 0 ? "text-destructive" : "text-foreground";

  const toggleRelease = (id: number) => {
    setReleasing((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= releaseCap) {
        toast.error(`Max ${releaseCap} releases. Activate All-Star or Wildcard to release more.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const applyTrades = async () => {
    if (releasing.length === 0) { toast.error("No players selected to release"); return; }
    if (!selectedTeamId) { toast.error("Select a team first"); return; }
    const { error } = await supabase
      .from("roster")
      .delete()
      .eq("team_id", selectedTeamId)
      .in("player_id", releasing);
    if (error) { toast.error("Failed to release players"); return; }
    toast.success(`Released ${releasing.length} player${releasing.length === 1 ? "" : "s"}`);
    setReleasing([]);
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
  };

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of rosterPlayers) {
      if (p.team) counts[p.team] = (counts[p.team] || 0) + 1;
    }
    return counts;
  }, [rosterPlayers]);

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
        if (sortCol === "fp5") return (p.last5 as any)?.fp5 ?? 0;
        if (sortCol === "value5") return (p.computed as any)?.value5 ?? 0;
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
    gp: { pg: "Games played", total: "Games played" },
    fp5: { pg: "Fantasy points avg (last 5 games)", total: "Fantasy points avg (last 5 games)" },
    value5: { pg: "Value from last 5 games (FP÷5)", total: "Value from last 5 games (FP÷5)" },
    salary: { pg: "Player salary ($M)", total: "Player salary ($M)" },
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
    const r: any = (rosterData as any)?.roster ?? rosterData;
    const starters: number[] = Array.isArray(r?.starters) ? r.starters : [];
    const bench: number[] = Array.isArray(r?.bench) ? r.bench : [];
    let slot: string | null = null;
    // edge fn pads with 0 — empty slot = id 0 or missing
    for (let i = 0; i < 5; i++) {
      if (!starters[i]) { slot = "STARTER"; break; }
    }
    if (!slot) {
      for (let i = 0; i < 5; i++) {
        if (!bench[i]) { slot = "BENCH"; break; }
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

  const sortableHeader = (col: string, label: string) => {
    const isActive = sortCol === col;
    const tip = columnTooltips[col];
    return (
      <TableHead
        className={`text-xs text-right cursor-pointer select-none ${isActive ? "text-primary font-bold" : ""}`}
        onClick={() => handleSort(col)}
      >
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {perfMode === "pg" ? tip.pg : tip.total}
            </TooltipContent>
          </Tooltip>
        ) : (
          label
        )}
      </TableHead>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col gap-3 shrink-0 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-heading font-bold">Transactions</h2>
          <ToggleGroup type="single" value={perfMode} onValueChange={(v) => v && setPerfMode(v as "pg" | "total")}>
            <ToggleGroupItem value="pg" className="font-heading text-xs uppercase rounded-xl h-8">Per Game</ToggleGroupItem>
            <ToggleGroupItem value="total" className="font-heading text-xs uppercase rounded-xl h-8">Totals</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground ml-auto">{totalItems} players</span>
        </div>

        {/* Trade toolbar */}
        <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card/40 px-3 py-2">
          {/* Trade dropdown */}
          <Popover open={tradePopoverOpen} onOpenChange={setTradePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl h-9 font-heading text-xs uppercase gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Trade
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[9px] font-mono">
                  {releasing.length}/{releaseCap}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Find player to release..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No roster players</CommandEmpty>
                  <CommandGroup heading="Your Roster">
                    {rosterPlayers.map((p) => {
                      const sel = releasing.includes(p.player_id);
                      return (
                        <CommandItem
                          key={p.player_id}
                          value={`${p.name} ${p.team}`}
                          onSelect={() => toggleRelease(p.player_id)}
                          className="flex items-center gap-2"
                        >
                          <Check className={`h-3.5 w-3.5 ${sel ? "opacity-100 text-destructive" : "opacity-0"}`} />
                          <Avatar className="h-6 w-6 shrink-0">
                            {p.photo && <AvatarImage src={p.photo} />}
                            <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 h-3.5 rounded">{p.fc_bc}</Badge>
                          <span className="text-xs font-heading flex-1 truncate">{p.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">${p.salary}M</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected pills */}
          {Array.from(releasingMap.values()).map((p) => (
            <span key={p.player_id} className="inline-flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/40 text-destructive px-2 h-7 text-[11px] font-heading uppercase">
              <span className="font-bold">{p.name}</span>
              <span className="font-mono opacity-70">${p.salary}M</span>
              <button
                type="button"
                onClick={() => toggleRelease(p.player_id)}
                className="hover:bg-destructive/30 rounded-full p-0.5"
                aria-label={`Cancel release ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Live budget */}
          <span className={`ml-auto inline-flex items-center gap-1 rounded-xl border bg-background px-3 h-9 text-xs font-heading uppercase`}>
            <span className="text-muted-foreground">Budget</span>
            <span className={`font-mono font-bold ${budgetClass}`}>${availableBudget.toFixed(1)}M</span>
          </span>

          {/* Chips */}
          <Button
            size="sm"
            variant={chipAllStar ? "default" : "outline"}
            className={`rounded-xl h-9 font-heading uppercase text-xs ${chipAllStar ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
            onClick={() => setChipAllStar(!chipAllStar)}
            title="All-Star chip — boosts release cap"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />All-Star
          </Button>
          <Button
            size="sm"
            variant={chipWildcard ? "default" : "outline"}
            className={`rounded-xl h-9 font-heading uppercase text-xs ${chipWildcard ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
            onClick={() => setChipWildcard(!chipWildcard)}
            title="Wildcard chip — unlimited transfers"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Wildcard
          </Button>

          {/* Apply trades */}
          {releasing.length > 0 && (
            <Button
              size="sm"
              className="rounded-xl h-9 font-heading uppercase text-xs"
              onClick={applyTrades}
            >
              Apply ({releasing.length})
            </Button>
          )}

          {/* AI Coach */}
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-9 font-heading uppercase text-xs gap-1.5"
            onClick={() => setAiCoachOpen(true)}
            title="Open AI Coach"
          >
            <Bot className="h-3.5 w-3.5" />AI Coach
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="text-xs w-8"></TableHead>
                    <TableHead className="text-xs">Player</TableHead>
                    <TableHead className="text-xs">Team</TableHead>
                    {sortableHeader("gp", "GP")}
                    {sortableHeader("fp5", "FP5")}
                    {sortableHeader("value5", "V5")}
                    {columns.map((c) => sortableHeader(c.key, c.label))}
                    {sortableHeader("salary", "$")}
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
                    const isReleasing = releasing.includes(p.core.id);
                    const effectiveRosterSize = rosterPlayerIds.size - releasing.length;
                    const overBudget = p.core.salary > availableBudget;
                    const canAdd = !isOnRoster && !teamAtMax && effectiveRosterSize < 10 && !overBudget;
                    const addTitle = teamAtMax
                      ? "Max 2 per team"
                      : effectiveRosterSize >= 10
                        ? "Roster full"
                        : overBudget
                          ? `Over budget ($${availableBudget.toFixed(1)}M left)`
                          : "Add to roster";

                    return (
                      <TableRow key={p.core.id} className="cursor-pointer hover:bg-accent/30 group" onClick={() => setSelectedPlayerId(p.core.id)}>
                        <td className="px-1 py-1">
                          {isOnRoster ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 ${isReleasing ? "text-destructive bg-destructive/20" : "text-destructive hover:bg-destructive/10"}`}
                              onClick={(e) => { e.stopPropagation(); toggleRelease(p.core.id); }}
                              title={isReleasing ? "Cancel release" : "Mark for release"}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-500/10" onClick={(e) => handleAddPlayer(p.core.id, e)} disabled={!canAdd} title={addTitle}>
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
                            <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-lg">{p.core.fc_bc}</Badge>
                            <span className="font-medium whitespace-nowrap">{p.core.name}</span>
                            {isOnRoster && <Badge variant="outline" className="text-[7px] px-1 py-0 rounded-lg border-green-500/50 text-green-600">ROSTER</Badge>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-1">
                            {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                            <span>{p.core.team}</span>
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-xs text-right font-mono ${sortCol === "gp" ? "text-primary font-bold" : ""}`}>{gp}</td>
                        <td className={`px-2 py-1.5 text-xs text-right font-mono ${sortCol === "fp5" ? "text-primary font-bold" : "font-bold"}`}>{(p.last5 as any)?.fp5?.toFixed(1) ?? "0.0"}</td>
                        <td className={`px-2 py-1.5 text-xs text-right font-mono ${sortCol === "value5" ? "text-primary font-bold" : "font-bold"}`}>{(p.computed as any)?.value5?.toFixed(1) ?? "0.0"}</td>
                        {columns.map((c) => (
                          <td key={c.key} className={`px-2 py-1.5 text-xs text-right font-mono ${sortCol === c.key ? "text-primary font-bold" : c.key === "pts" || c.key === "fp" ? "font-bold" : ""}`}>
                            {perfMode === "total" ? fmtTot(c.key) : fmtPg(c.key)}
                          </td>
                        ))}
                        <td className={`px-2 py-1.5 text-xs text-right font-mono ${sortCol === "salary" ? "text-primary font-bold" : ""}`}>${p.core.salary}</td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t pt-3 shrink-0">
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

          <div className="w-56 flex-shrink-0 sticky top-0 self-start">
            <FiltersPanel fcBc={fcBc} onFcBcChange={setFcBc} search={search} onSearchChange={setSearch} maxSalary={maxSalary} onMaxSalaryChange={setMaxSalary} maxSalaryLimit={maxSalaryLimit} team={team} onTeamChange={setTeam} />
          </div>
        </div>
      )}

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
      <AICoachModal open={aiCoachOpen} onOpenChange={setAiCoachOpen} />
    </div>
  );
}
