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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamLogo } from "@/lib/nba-teams";
import { ChevronLeft, ChevronRight, Plus, Minus, Bot, X, CalendarDays, Users, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentGameday, formatDeadline, DEADLINES } from "@/lib/deadlines";
import AICoachModal from "@/components/AICoachModal";
import { SchedulePreviewBody } from "@/components/SchedulePreviewPanel";
import TradeWorkbench from "@/components/transactions/TradeWorkbench";
import TradeReport from "@/components/transactions/TradeReport";
import RosterPane, { type RosterPanePlayer } from "@/components/transactions/RosterPane";
import { useGameweekTransfers } from "@/hooks/useGameweekTransfers";
import { useTradeValidation, type ValidationPlayer } from "@/hooks/useTradeValidation";
import { commitTransaction } from "@/lib/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getEligibility, type EligibilityCtx } from "@/lib/trade-eligibility";

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
  const [outZone, setOutZone] = useState<number[]>([]);
  const [inZone, setInZone] = useState<number[]>([]);
  const [chipAllStar, setChipAllStar] = useState(false);
  const [chipWildcard, setChipWildcard] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rosterSheetOpen, setRosterSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const isWideScreen = useMediaQuery("(min-width: 1280px)");

  const { selectedTeamId } = useTeam();
  const queryClient = useQueryClient();
  const { data: playersData, isLoading } = usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 });
  const { data: rosterData } = useRosterQuery();
  const allPlayers = playersData?.items ?? [];

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

  const starterIds = useMemo(() => {
    const r: any = (rosterData as any)?.roster ?? rosterData;
    return Array.isArray(r?.starters) ? (r.starters as number[]) : [];
  }, [rosterData]);
  const benchIds = useMemo(() => {
    const r: any = (rosterData as any)?.roster ?? rosterData;
    return Array.isArray(r?.bench) ? (r.bench as number[]) : [];
  }, [rosterData]);
  const hydrate = (id: number): RosterPanePlayer | null => {
    const p = allPlayers.find((pp) => pp.core.id === id);
    if (!p) return null;
    return {
      player_id: p.core.id,
      name: p.core.name,
      team: p.core.team,
      salary: p.core.salary,
      fc_bc: p.core.fc_bc,
      photo: p.core.photo ?? null,
    };
  };
  const rosterStarters = useMemo(
    () => starterIds.map(hydrate).filter((p): p is RosterPanePlayer => !!p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [starterIds, allPlayers],
  );
  const rosterBench = useMemo(
    () => benchIds.map(hydrate).filter((p): p is RosterPanePlayer => !!p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benchIds, allPlayers],
  );

  const bankRemaining: number = (rosterData as any)?.roster?.bank_remaining ?? (rosterData as any)?.bank_remaining ?? 0;
  const totalRosterSalary = useMemo(
    () => rosterPlayers.reduce((s, p) => s + (p.salary ?? 0), 0),
    [rosterPlayers],
  );

  const current = getCurrentGameday();
  const gw = current.gw;
  const day = current.day;

  const baseGwCap = 2;
  const gwCap = chipWildcard ? 999 : chipAllStar ? baseGwCap + 2 : baseGwCap;
  const { data: gwTx } = useGameweekTransfers(selectedTeamId, gw);
  const gwUsed = gwTx?.used ?? 0;

  const capResetLabel = useMemo(() => {
    const next = DEADLINES.find((d) => d.gw === gw + 1);
    return next ? formatDeadline(next.deadline_utc) : "next GW";
  }, [gw]);

  const validationPool: ValidationPlayer[] = useMemo(() => {
    return allPlayers.map((p) => ({
      id: p.core.id,
      name: p.core.name,
      team: p.core.team,
      fc_bc: p.core.fc_bc as "FC" | "BC",
      salary: p.core.salary,
    }));
  }, [allPlayers]);

  const rosterValidationList: ValidationPlayer[] = useMemo(
    () =>
      rosterPlayers.map((p) => ({
        id: p.player_id,
        name: p.name,
        team: p.team,
        fc_bc: p.fc_bc as "FC" | "BC",
        salary: p.salary,
      })),
    [rosterPlayers],
  );

  const validation = useTradeValidation(
    {
      rosterPlayers: rosterValidationList,
      outs: outZone,
      ins: inZone,
      bankRemaining,
      gwUsed,
      gwCap,
      addMode: rosterIdList.length < 10,
    },
    validationPool,
  );

  const outChips = useMemo(
    () =>
      outZone
        .map((id) => rosterPlayers.find((p) => p.player_id === id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.player_id,
          name: p!.name,
          team: p!.team,
          fc_bc: p!.fc_bc as "FC" | "BC",
          salary: p!.salary,
          photo: p!.photo,
        })),
    [outZone, rosterPlayers],
  );
  const inChips = useMemo(
    () =>
      inZone
        .map((id) => allPlayers.find((p) => p.core.id === id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.core.id,
          name: p!.core.name,
          team: p!.core.team,
          fc_bc: p!.core.fc_bc as "FC" | "BC",
          salary: p!.core.salary,
          photo: p!.core.photo ?? null,
        })),
    [inZone, allPlayers],
  );

  const outPlayersFull = useMemo(
    () => outZone.map((id) => allPlayers.find((p) => p.core.id === id)).filter(Boolean) as PlayerListItem[],
    [outZone, allPlayers],
  );
  const inPlayersFull = useMemo(
    () => inZone.map((id) => allPlayers.find((p) => p.core.id === id)).filter(Boolean) as PlayerListItem[],
    [inZone, allPlayers],
  );
  const rosterPlayersFull = useMemo(
    () => rosterIdList.map((id) => allPlayers.find((p) => p.core.id === id)).filter(Boolean) as PlayerListItem[],
    [rosterIdList, allPlayers],
  );

  // ADD mode: roster has < 10 players → [+] can add directly without an OUT.
  const addMode = rosterIdList.length < 10;

  // Per-row eligibility context (computed once per render)
  const eligibilityCtx: EligibilityCtx = useMemo(() => {
    // post = roster after removing OUTs (before adding INs)
    const postTeamCounts: Record<string, number> = {};
    let postFc = 0;
    let postBc = 0;
    for (const p of rosterPlayers) {
      if (outZone.includes(p.player_id)) continue;
      const tri = (p.team ?? "").toUpperCase();
      if (tri) postTeamCounts[tri] = (postTeamCounts[tri] ?? 0) + 1;
      if (p.fc_bc === "FC") postFc += 1;
      else if (p.fc_bc === "BC") postBc += 1;
    }
    // also account for already-staged INs in team counts and fc/bc balance
    let inFc = 0;
    let inBc = 0;
    for (const p of inChips) {
      const tri = (p.team ?? "").toUpperCase();
      if (tri) postTeamCounts[tri] = (postTeamCounts[tri] ?? 0) + 1;
      if (p.fc_bc === "FC") inFc += 1;
      else if (p.fc_bc === "BC") inBc += 1;
    }
    return {
      addMode,
      inZone,
      outZone,
      availableBudget: validation.availableForNextIn,
      postTeamCounts,
      postFc,
      postBc,
      inFc,
      inBc,
      gwUsed,
      gwCap,
      gw,
    };
  }, [addMode, inZone, outZone, validation.availableForNextIn, rosterPlayers, inChips, gwUsed, gwCap, gw]);

  const availableBudget = validation.availableForNextIn;

  const toggleOut = (id: number) => {
    setReportOpen(false);
    setOutZone((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        toast.error("Max 2 OUT players per trade");
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeIn = (id: number) => {
    setReportOpen(false);
    setInZone((prev) => prev.filter((x) => x !== id));
  };

  const resetTrade = () => {
    setOutZone([]);
    setInZone([]);
    setReportOpen(false);
  };

  const handleCommit = async () => {
    if (!selectedTeamId) { toast.error("Select a team first"); return; }
    if (!validation.isValid) { toast.error(validation.reasons[0] ?? "Trade invalid"); return; }
    setCommitting(true);
    try {
      await commitTransaction(
        { gw, day, outs: outZone, ins: inZone },
        selectedTeamId,
      );
      const verb = outZone.length === 0 ? "added" : "swapped";
      const n = Math.max(inZone.length, outZone.length);
      toast.success(`${n} player${n === 1 ? "" : "s"} ${verb}`);
      resetTrade();
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      queryClient.invalidateQueries({ queryKey: ["gw-transfers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const maxSalaryLimit = useMemo(() => {
    if (allPlayers.length === 0) return 50;
    return Math.ceil(Math.max(...allPlayers.map((p) => p.core.salary)));
  }, [allPlayers]);

  useEffect(() => { if (maxSalaryLimit > 0) setMaxSalary(maxSalaryLimit); }, [maxSalaryLimit]);
  useEffect(() => { setCurrentPage(1); }, [fcBc, sort, search, maxSalary, team]);

  const filtered = useMemo(() => {
    let items = allPlayers.filter((p) => p.season.gp > 0);
    items = items.filter((p) => !rosterPlayerIds.has(p.core.id));
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
  }, [allPlayers, rosterPlayerIds, fcBc, search, maxSalary, team, sortCol, sortDir, perfMode]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const totalItems = filtered.length;
  const effectivePageSize = pageSize === "All" ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const paginatedItems = pageSize === "All" ? filtered : filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  // Eligibility summary (count eligible across the FULL filtered list, not just current page)
  const eligibleCount = useMemo(
    () =>
      filtered.reduce((acc, p) => {
        const e = getEligibility(
          { id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc, salary: p.core.salary },
          eligibilityCtx,
        );
        return acc + (e.ok ? 1 : 0);
      }, 0),
    [filtered, eligibilityCtx],
  );

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

  /** Stage a non-roster player: in ADD mode, commit immediately; otherwise stage IN. */
  const stageIn = (playerId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setReportOpen(false);
    if (inZone.includes(playerId)) {
      setInZone((prev) => prev.filter((x) => x !== playerId));
      return;
    }
    if (addMode && outZone.length === 0) {
      // Direct ADD path — stage and let user click Report/Confirm via workbench.
      // We add to IN zone so the workbench previews the same metrics.
      setInZone((prev) => [...prev, playerId]);
      return;
    }
    if (outZone.length === 0) {
      toast.error("Pick a player to release first (− on a roster row)");
      return;
    }
    if (inZone.length >= outZone.length) {
      toast.error(`IN zone full — pick exactly ${outZone.length} replacement${outZone.length === 1 ? "" : "s"}`);
      return;
    }
    setInZone((prev) => [...prev, playerId]);
  };

  const sortableHeader = (col: string, label: string) => {
    const isActive = sortCol === col;
    const tip = columnTooltips[col];
    return (
      <TableHead
        className={`text-xs text-right cursor-pointer select-none px-1 ${isActive ? "text-primary font-bold" : ""}`}
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

  /**
   * Roster pane "−" handler. On narrow viewports (< 1280px), the roster lives
   * inside a Sheet drawer — auto-close after the user stages a release so they
   * can immediately pick a replacement from the table without an extra tap.
   * Do NOT remove the close-on-narrow behavior; it is required UX.
   */
  const onRosterToggleOut = (id: number) => {
    toggleOut(id);
    if (!isWideScreen) setRosterSheetOpen(false);
  };

  const rosterPaneNode = (
    <RosterPane
      starters={rosterStarters}
      bench={rosterBench}
      outZone={outZone}
      isLoading={rosterIdList.length > 0 && rosterStarters.length + rosterBench.length === 0}
      onToggleOut={onRosterToggleOut}
      onPlayerClick={(id) => setSelectedPlayerId(id)}
    />
  );

  return (
    <div className="h-full flex flex-col">
      {/* Compact header row */}
      <div className="flex items-center gap-2 flex-wrap shrink-0 mb-3">
        <h2 className="text-xl font-heading font-bold">Transactions</h2>
        {!isWideScreen && (
          <Sheet open={rosterSheetOpen} onOpenChange={setRosterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-8 font-heading uppercase text-[10px] gap-1.5"
                aria-label="Open my roster"
              >
                <Users className="h-3.5 w-3.5" />
                Roster {rosterIdList.length}/10
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-4 overflow-y-auto">
              <SheetHeader className="mb-3">
                <SheetTitle className="text-sm font-heading uppercase tracking-wider">My Roster</SheetTitle>
              </SheetHeader>
              {rosterPaneNode}
            </SheetContent>
          </Sheet>
        )}
        <Button
          variant={scheduleOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setScheduleOpen((v) => !v)}
          className={`rounded-xl h-8 font-heading text-[10px] uppercase gap-1.5 ${scheduleOpen ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
          title="Toggle schedule preview"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-8 font-heading uppercase text-[10px] gap-1.5"
          onClick={() => setAiCoachOpen(true)}
          title="Open AI Coach"
        >
          <Bot className="h-3.5 w-3.5" />AI Coach
        </Button>
        {/* Page-level chips: All-Star + Wildcard */}
        <Button
          size="sm"
          variant={chipAllStar ? "default" : "outline"}
          className={`rounded-xl h-8 font-heading uppercase text-[10px] gap-1.5 ${chipAllStar ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
          onClick={() => setChipAllStar((v) => !v)}
          title="All-Star chip — boosts trade cap"
        >
          <Sparkles className="h-3.5 w-3.5" />All-Star
        </Button>
        <Button
          size="sm"
          variant={chipWildcard ? "default" : "outline"}
          className={`rounded-xl h-8 font-heading uppercase text-[10px] gap-1.5 ${chipWildcard ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
          onClick={() => setChipWildcard((v) => !v)}
          title="Wildcard chip — unlimited transfers"
        >
          <RefreshCw className="h-3.5 w-3.5" />Wildcard
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {totalItems} available · {eligibleCount} eligible
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <>
          {/* FULL-WIDTH workbench above the 3-column grid */}
          <div className="relative shrink-0 mb-3">
            <TradeWorkbench
              outs={outChips}
              ins={inChips}
              bankRemaining={bankRemaining}
              validation={validation}
              gwUsed={gwUsed}
              gwCap={gwCap}
              gw={gw}
              capResetLabel={capResetLabel}
              onRemoveOut={(id) => toggleOut(id)}
              onRemoveIn={(id) => removeIn(id)}
              onReset={resetTrade}
              onGenerateReport={() => setReportOpen(true)}
              onConfirmAdd={handleCommit}
              committing={committing}
              reportOpen={reportOpen}
              addMode={addMode}
              rosterSize={rosterIdList.length}
            />

            {scheduleOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-3 max-h-[460px] overflow-hidden animate-accordion-down">
                <button
                  type="button"
                  onClick={() => setScheduleOpen(false)}
                  className="absolute top-2 right-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
                  aria-label="Close schedule"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="overflow-y-auto max-h-[440px] pr-1">
                  <SchedulePreviewBody
                    rosterTeams={rosterPlayers.map((p) => p.team).filter(Boolean) as string[]}
                    variant="panel"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* LEFT — Roster pane (only on wide screens; otherwise lives in the Sheet) */}
            {isWideScreen && (
              <div className="w-96 shrink-0 min-h-0 flex flex-col border rounded-lg overflow-hidden bg-card">
                {/* Header — exact h-10 to match table header */}
                <div className="h-10 px-3 flex items-center border-b bg-background shrink-0">
                  <span className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">
                    My Roster
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {rosterIdList.length}/10
                  </span>
                </div>
                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
                  {rosterPaneNode}
                </div>
                {/* Footer — centered, bold NBA-yellow */}
                <div className="h-[52px] px-3 flex items-center justify-center border-t shrink-0 bg-background">
                  <span className="text-xs font-bold text-[hsl(var(--nba-yellow))]">
                    ${totalRosterSalary.toFixed(1)}M used · ${bankRemaining.toFixed(1)}M bank
                  </span>
                </div>
              </div>
            )}

            {/* CENTER — Trade report (when open) + table */}
            <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
              {reportOpen && validation.isValid && (outZone.length > 0 || inZone.length > 0) && (
                <TradeReport
                  outPlayers={outPlayersFull}
                  inPlayers={inPlayersFull}
                  bankRemaining={bankRemaining}
                  salaryCap={100}
                  rosterPlayers={rosterPlayersFull}
                  gw={gw}
                  day={day}
                  teamId={selectedTeamId}
                  committing={committing}
                  onClose={() => setReportOpen(false)}
                  onCommit={handleCommit}
                />
              )}

              <div className="relative flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden bg-card">
              {!filtersOpen && (
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="absolute top-1.5 right-1.5 z-30 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent text-foreground/70 hover:text-foreground transition-colors shadow-sm"
                  aria-label="Expand filters"
                  title="Expand filters"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Fixed header (separate table) */}
              <div className="shrink-0 border-b bg-background">
                <Table className="table-fixed">
                  <colgroup>
                    <col style={{ width: "44px" }} />
                    <col />
                    <col style={{ width: "60px" }} />
                    <col style={{ width: "44px" }} />
                    {columns.map((c) => <col key={c.key} style={{ width: "44px" }} />)}
                    <col style={{ width: "52px" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="h-10 hover:bg-transparent">
                      <TableHead className="text-xs h-10"></TableHead>
                      <TableHead className="text-xs h-10 pr-1">Player</TableHead>
                      <TableHead className="text-xs h-10 pl-1">Team</TableHead>
                    {sortableHeader("gp", "GP")}
                    {columns.map((c) => sortableHeader(c.key, c.label))}
                    {sortableHeader("salary", "$")}
                  </TableRow>
                </TableHeader>
                </Table>
              </div>
              {/* Scrollable body (separate table, same colgroup) */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table className="table-fixed">
                  <colgroup>
                    <col style={{ width: "44px" }} />
                    <col />
                    <col style={{ width: "60px" }} />
                    <col style={{ width: "44px" }} />
                    {columns.map((c) => <col key={c.key} style={{ width: "44px" }} />)}
                    <col style={{ width: "52px" }} />
                  </colgroup>
                <TableBody>
                  {paginatedItems.map((p) => {
                    const gp = p.season.gp || 1;
                    const s = p.season as any;
                    const fmtPg = (key: string) => { const tk = `total_${key}`; return s[tk] !== undefined ? (s[tk] / gp).toFixed(1) : "0.0"; };
                    const fmtTot = (key: string) => { const tk = `total_${key}`; return s[tk] !== undefined ? Math.round(s[tk]).toString() : "0"; };
                    const teamLogo = getTeamLogo(p.core.team);
                    const isInInZone = inZone.includes(p.core.id);
                    const elig = getEligibility(
                      { id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc, salary: p.core.salary },
                      eligibilityCtx,
                    );
                    const canAdd = elig.ok || isInInZone;

                    return (
                      <TableRow key={p.core.id} className="cursor-pointer hover:bg-accent/30 group" onClick={() => setSelectedPlayerId(p.core.id)}>
                        <td className="px-1 py-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 ${isInInZone ? "text-emerald-600 bg-emerald-500/20" : elig.ok ? "text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground"}`}
                                  onClick={(e) => stageIn(p.core.id, e)}
                                  disabled={!canAdd}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                                    isInInZone
                                      ? "bg-emerald-500"
                                      : elig.ok
                                        ? "bg-emerald-500/70"
                                        : elig.reason === "gw_cap"
                                          ? "bg-destructive"
                                          : "bg-amber-500"
                                  }`}
                                  aria-hidden="true"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs max-w-[220px]">
                              {elig.message}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-2 py-1.5 pr-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-7 w-7 shrink-0 rounded-full transition-transform group-hover:scale-110">
                              {p.core.photo && <AvatarImage src={p.core.photo} />}
                              <AvatarFallback className="text-[8px]">{p.core.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-lg">{p.core.fc_bc}</Badge>
                            <span className="font-medium whitespace-nowrap">{p.core.name}</span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 pl-1 text-xs">
                          <div className="flex items-center gap-1">
                            {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                            <span>{p.core.team}</span>
                          </div>
                        </td>
                        <td className={`px-1 py-1.5 text-xs text-right font-mono ${sortCol === "gp" ? "text-primary font-bold" : ""}`}>{gp}</td>
                        {columns.map((c) => (
                          <td key={c.key} className={`px-1 py-1.5 text-xs text-right font-mono ${sortCol === c.key ? "text-primary font-bold" : c.key === "pts" || c.key === "fp" ? "font-bold" : ""}`}>
                            {perfMode === "total" ? fmtTot(c.key) : fmtPg(c.key)}
                          </td>
                        ))}
                        <td className={`px-1 py-1.5 text-xs text-right font-mono ${sortCol === "salary" ? "text-primary font-bold" : ""}`}>${p.core.salary}</td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="h-[52px] px-3 flex items-center justify-between border-t shrink-0 bg-background">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[hsl(var(--nba-yellow))]">Show</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(v === "All" ? "All" : Number(v) as any); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZE_OPTIONS.map((opt) => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs font-bold text-[hsl(var(--nba-yellow))]">of {totalItems} players</span>
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
          </div>

          {/* RIGHT — Filters (retractable, − collapses inside the card) */}
          {filtersOpen && (
            <div className="w-56 flex-shrink-0 self-start relative">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="absolute top-1.5 right-1.5 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent text-foreground/70 hover:text-foreground transition-colors shadow-sm"
                aria-label="Collapse filters"
                title="Collapse filters"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <FiltersPanel
                fcBc={fcBc}
                onFcBcChange={setFcBc}
                search={search}
                onSearchChange={setSearch}
                maxSalary={maxSalary}
                onMaxSalaryChange={setMaxSalary}
                maxSalaryLimit={maxSalaryLimit}
                team={team}
                onTeamChange={setTeam}
                perfMode={perfMode}
                onPerfModeChange={setPerfMode}
              />
            </div>
          )}
          </div>
        </>
      )}

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
      <AICoachModal open={aiCoachOpen} onOpenChange={setAiCoachOpen} />
    </div>
  );
}
