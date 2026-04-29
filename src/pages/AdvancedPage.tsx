import { useState, useMemo, useEffect } from "react";
import { TrendingUp, TrendingDown, Clock, Search, ExternalLink, ChevronsUpDown, Check, X, ChevronLeft, ChevronRight, RotateCcw, Link2, Lightbulb } from "lucide-react";
import { usePlayingTimeTrends, TrendRow } from "@/hooks/usePlayingTimeTrends";
import { getTeamLogo } from "@/lib/nba-teams";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEADLINES, getCurrentGameday } from "@/lib/deadlines";
import AdvancedStatsTab from "@/components/advanced/AdvancedStatsTab";
import TrendingTab from "@/components/advanced/TrendingTab";
import PlaySubFilters from "@/components/advanced/PlaySubFilters";
import { ActionType, EMPTY_SUBFILTERS, SubFilterState, pruneSubFilters } from "@/lib/play-filter-config";
import SectionHeader from "@/components/advanced/SectionHeader";
import { getLastAdvancedTab, setLastAdvancedTab, AdvancedTab } from "@/lib/advanced-tab-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TEAM_NAME: Record<string, string> = Object.fromEntries(
  NBA_TEAMS.map((t) => [t.tricode, t.name]),
);

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function PlayerCombobox({
  label,
  value,
  onChange,
  players,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  players: Array<{ id: number; name: string; team: string; fc_bc: string; photo: string | null }>;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => players.find((p) => p.name === value) ?? null, [players, value]);
  const selectedLogo = selected ? getTeamLogo(selected.team) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-lg font-normal h-10 relative overflow-hidden"
          >
            {selectedLogo && (
              <img
                src={selectedLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 object-contain opacity-[0.18] rotate-12 select-none"
              />
            )}
            {selected ? (
              <div className="relative z-10 flex items-center gap-2 min-w-0">
                {selected.photo ? (
                  <img src={selected.photo} alt="" className="w-6 h-6 rounded-full object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0 inline-flex items-center justify-center text-[8px] font-bold">
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="truncate">{selected.name}</span>
              </div>
            ) : (
              <span className="relative z-10 text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="relative z-10 h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" align="start">
          <Command
            filter={(itemValue, search) => {
              return normalize(itemValue).includes(normalize(search)) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search player..." className="h-9" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No player found.</CommandEmpty>
              <CommandGroup>
                {players.map((p) => {
                  const logo = getTeamLogo(p.team);
                  const isSelected = value === p.name;
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.team}`}
                      onSelect={() => {
                        onChange(p.name);
                        setOpen(false);
                      }}
                      className="group relative overflow-hidden cursor-pointer"
                    >
                      {logo && (
                        <img
                          src={logo}
                          alt=""
                          className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 object-contain opacity-[0.18] rotate-12 select-none group-hover:opacity-[0.28] transition-opacity"
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2 w-full">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="w-7 h-7 rounded-full object-cover bg-muted shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted shrink-0 inline-flex items-center justify-center text-[8px] font-bold">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-heading font-semibold truncate">{p.name}</span>
                            <Badge
                              variant={p.fc_bc === "FC" ? "destructive" : "default"}
                              className="text-[7px] px-1 py-0 rounded-lg h-3.5 shrink-0"
                            >
                              {p.fc_bc}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{p.team}</span>
                        </div>
                        <Check className={cn("h-4 w-4 shrink-0 mr-2", isSelected ? "opacity-100 text-primary" : "opacity-0")} />
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NBAPlaySearchSection() {
  // Hydrate from URL hash (?nbaps=...) so shared "Copy link" URLs reopen the same search.
  const initialFromUrl = useMemo(() => readSearchFromUrl(), []);
  const [actionPlayer, setActionPlayer] = useState(initialFromUrl?.actionPlayer ?? "");
  const [actionTypes, setActionTypes] = useState<string[]>(initialFromUrl?.actionTypes ?? []);
  const [actionPopoverOpen, setActionPopoverOpen] = useState(false);
  const [subFilters, setSubFilters] = useState<SubFilterState>(initialFromUrl?.subFilters ?? EMPTY_SUBFILTERS);

  const ACTION_TYPES = [
    { value: "rebound", label: "Rebound" },
    { value: "2pt", label: "2pt" },
    { value: "3pt", label: "3pt" },
    { value: "freethrow", label: "Free Throw" },
    { value: "block", label: "Block" },
    { value: "steal", label: "Steal" },
    { value: "foul", label: "Foul" },
    { value: "turnover", label: "Turnover" },
    { value: "violation", label: "Violation" },
    { value: "jumpball", label: "Jumpball" },
    { value: "ejection", label: "Ejection" },
  ];

  const initial = useMemo(() => getCurrentGameday(), []);
  const [gw, setGw] = useState<number>(initial.gw);
  const [day, setDay] = useState<number>(initial.day);
  const [gameId, setGameId] = useState("");

  // Lisbon-day label + yyyymmdd derived from the matched deadline
  const currentDeadline = useMemo(
    () => DEADLINES.find((d) => d.gw === gw && d.day === day) ?? initial,
    [gw, day, initial],
  );
  const lisbonDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(currentDeadline.deadline_utc));
  }, [currentDeadline]);
  const yyyymmdd = useMemo(() => {
    // Lisbon Y-M-D for the deadline date
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(currentDeadline.deadline_utc));
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}${m}${d}`;
  }, [currentDeadline]);

  // Step through DEADLINES chronologically
  const currentIndex = useMemo(
    () => DEADLINES.findIndex((d) => d.gw === gw && d.day === day),
    [gw, day],
  );
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < DEADLINES.length - 1;
  const shiftDay = (delta: number) => {
    const next = DEADLINES[currentIndex + delta];
    if (!next) return;
    setGw(next.gw);
    setDay(next.day);
  };

  const daysInGw = useMemo(() => DEADLINES.filter((d) => d.gw === gw).map((d) => d.day), [gw]);
  const allGws = useMemo(() => Array.from(new Set(DEADLINES.map((d) => d.gw))), []);

  // Reset selected game when (gw, day) changes — proper effect, not useMemo
  useEffect(() => {
    setGameId("");
  }, [gw, day]);

  const { data: gamesByDate, isLoading: gamesLoading } = useQuery({
    queryKey: ["games-by-gw-day", gw, day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, away_team, home_team, tipoff_utc, status")
        .eq("gw", gw)
        .eq("day", day)
        .order("tipoff_utc", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 60 * 1000,
  });

  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const players = useMemo(() => {
    const items = (playersData as any)?.items ?? [];
    return items
      .map((p: any) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        fc_bc: p.core.fc_bc,
        photo: p.core.photo ?? null,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [playersData]);

  const selectedGame = (gamesByDate ?? []).find((g: any) => g.game_id === gameId);
  const gamecode = selectedGame ? `${yyyymmdd}/${selectedGame.away_team}${selectedGame.home_team}` : "";
  const gameSearchDisabled = !selectedGame;

  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const handleActionOpen = () => {
    const params = new URLSearchParams();
    params.set("actionplayer", actionPlayer);
    for (const t of actionTypes) params.append("actiontype", t);
    for (const v of subFilters.qualifiers) params.append("qualifiers", v);
    for (const v of subFilters.subtype) params.append("subtype", v);
    for (const v of subFilters.area) params.append("area", v);
    for (const v of subFilters.shotresult) params.append("shotresult", v);
    if (subFilters.isaftertimeout) params.set("isATO", "true");
    if (subFilters.isbuzzerbeater) params.set("isBuzzerBeater", "true");
    if (subFilters.shotdistancemin != null) params.set("shotdistancemin", String(subFilters.shotdistancemin));
    if (subFilters.shotdistancemax != null) params.set("shotdistancemax", String(subFilters.shotdistancemax));
    const url = `https://www.nbaplaydb.com/search?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener,noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    const labels = actionTypes
      .map((v) => ACTION_TYPES.find((x) => x.value === v)?.label ?? v)
      .join(", ");
    toast.success("Opening NBAPlayDB", {
      description: actionTypes.length
        ? `${actionPlayer} · ${labels}`
        : `${actionPlayer} · All actions`,
    });
  };

  const actionDisabled = !actionPlayer;
  const toggleActionType = (v: string) => {
    setActionTypes((prev) => {
      const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
      // prune sub-filters that no longer apply
      setSubFilters((sf) => pruneSubFilters(sf, next as ActionType[]));
      return next;
    });
  };
  const actionTriggerLabel = (() => {
    if (actionTypes.length === 0) return "All actions";
    const first = ACTION_TYPES.find((x) => x.value === actionTypes[0])?.label ?? actionTypes[0];
    if (actionTypes.length === 1) return first;
    return `${first} +${actionTypes.length - 1}`;
  })();

  // Heuristic: warn when the active filter combo is likely too narrow on NBAPlayDB.
  const restrictiveScore = useMemo(() => {
    let s = 0;
    if (actionTypes.length > 0) s += 1;
    s += subFilters.qualifiers.length;
    s += subFilters.subtype.length;
    s += subFilters.area.length;
    if (subFilters.shotresult.length) s += 1;
    if (subFilters.isaftertimeout) s += 1;
    if (subFilters.isbuzzerbeater) s += 1;
    return s;
  }, [actionTypes, subFilters]);
  const tooNarrow = !!actionPlayer && restrictiveScore >= 5;

  const buildShareUrl = () => {
    const payload = {
      p: actionPlayer || undefined,
      a: actionTypes.length ? actionTypes : undefined,
      sf: subFilters,
    };
    const json = JSON.stringify(payload);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const u = new URL(window.location.href);
    u.hash = `nbaps=${encoded}`;
    return u.toString();
  };

  const handleCopyLink = async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Share to reopen this exact search." });
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
      <SectionHeader
        tone="blue"
        icon={<Search className="h-4 w-4" />}
        title="NBA Play Search"
        meta={
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            Play-by-play clips on NBAPlayDB · opens in a new tab
            <ExternalLink className="h-3 w-3" />
          </span>
        }
      />
      <div className="p-5 space-y-4">
        <Tabs defaultValue="action">
          <TabsList className="rounded-lg grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="action" className="font-heading text-xs uppercase rounded-lg">🏀 Player Action</TabsTrigger>
            <TabsTrigger value="game" className="font-heading text-xs uppercase rounded-lg">🏀 By Game</TabsTrigger>
          </TabsList>

          <TabsContent value="action" className="mt-4 space-y-2">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <PlayerCombobox
                label="Player"
                value={actionPlayer}
                onChange={setActionPlayer}
                players={players}
                placeholder="Pick a player…"
              />
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Action Type</Label>
                <Popover open={actionPopoverOpen} onOpenChange={setActionPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between rounded-lg font-normal h-10">
                      <span className={cn("truncate", actionTypes.length === 0 && "text-muted-foreground")}>
                        {actionTriggerLabel}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command>
                      <CommandList className="max-h-[320px]">
                        <CommandGroup>
                          {ACTION_TYPES.map((a) => {
                            const checked = actionTypes.includes(a.value);
                            return (
                              <CommandItem
                                key={a.value}
                                value={a.label}
                                onSelect={() => toggleActionType(a.value)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                    checked ? "bg-primary border-primary text-primary-foreground" : "border-input",
                                  )}>
                                    {checked && <Check className="h-3 w-3" />}
                                  </div>
                                  <span className="text-sm">{a.label}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        {actionTypes.length > 0 && (
                          <CommandGroup>
                            <CommandItem
                              value="__clear"
                              onSelect={() => setActionTypes([])}
                              className="cursor-pointer text-muted-foreground"
                            >
                              <X className="h-3.5 w-3.5 mr-2" /> Clear actions
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={actionDisabled}
                  onClick={handleActionOpen}
                  className="rounded-lg h-10"
                >
                  Open Plays on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <div className="h-8 w-px bg-border mx-1" aria-hidden />
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        className="rounded-lg h-10 w-10 shrink-0"
                        aria-label="Copy shareable link"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link to this exact search</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={
                          !actionPlayer &&
                          actionTypes.length === 0 &&
                          subFilters.qualifiers.length === 0 &&
                          subFilters.subtype.length === 0 &&
                          subFilters.area.length === 0 &&
                          subFilters.shotresult.length === 0 &&
                          !subFilters.isaftertimeout &&
                          !subFilters.isbuzzerbeater &&
                          subFilters.shotdistancemin == null &&
                          subFilters.shotdistancemax == null
                        }
                        onClick={() => {
                          setActionPlayer("");
                          setActionTypes([]);
                          setSubFilters(EMPTY_SUBFILTERS);
                          toast.success("Filters reset");
                        }}
                        className="rounded-lg h-10 w-10 shrink-0"
                        aria-label="Reset filters"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset all filters (player + actions + refinements)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Player + selected action types open as Play Filters on NBAPlayDB.
            </p>
            {tooNarrow && (
              <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--nba-yellow))]/40 bg-[hsl(var(--nba-yellow))]/10 p-3">
                <Lightbulb className="h-4 w-4 text-[hsl(var(--nba-yellow))] shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-[hsl(var(--nba-yellow))]">
                    No plays? Try widening your search
                  </div>
                  <ul className="text-muted-foreground list-disc pl-4 space-y-0.5">
                    {(subFilters.isaftertimeout || subFilters.isbuzzerbeater) && (
                      <li>Turn off <span className="text-foreground font-medium">After Timeout</span> / <span className="text-foreground font-medium">Buzzer Beater</span> — these are rare events.</li>
                    )}
                    {(subFilters.shotdistancemin != null || subFilters.shotdistancemax != null) && (
                      <li>Widen the <span className="text-foreground font-medium">shot distance</span> range or reset it.</li>
                    )}
                    {subFilters.area.length > 0 && (
                      <li>Select fewer <span className="text-foreground font-medium">court areas</span> — or clear them to include all.</li>
                    )}
                    {subFilters.subtype.length > 2 && (
                      <li>Reduce the <span className="text-foreground font-medium">subtype</span> chips you've activated.</li>
                    )}
                    {subFilters.qualifiers.length > 2 && (
                      <li>Reduce the <span className="text-foreground font-medium">qualifiers</span> chips you've activated.</li>
                    )}
                    <li>Or use <span className="text-foreground font-medium">Reset filters</span> and start fresh.</li>
                  </ul>
                </div>
              </div>
            )}
            <PlaySubFilters
              actions={actionTypes as ActionType[]}
              value={subFilters}
              onChange={setSubFilters}
            />
          </TabsContent>

          <TabsContent value="game" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-[280px_1fr_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                  Gameday <span className="text-foreground/70 normal-case tracking-normal">· {lisbonDateLabel}</span>
                </Label>
                <div className="flex items-stretch gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground"
                    onClick={() => shiftDay(-1)}
                    disabled={!canPrev}
                    aria-label="Previous gameday"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select value={String(gw)} onValueChange={(v) => {
                    const newGw = Number(v);
                    setGw(newGw);
                    const days = DEADLINES.filter((d) => d.gw === newGw).map((d) => d.day);
                    if (!days.includes(day)) setDay(days[0] ?? 1);
                  }}>
                    <SelectTrigger className="rounded-lg flex-1 min-w-0 h-10">
                      <SelectValue placeholder="GW" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-[320px]">
                      {allGws.map((g) => (
                        <SelectItem key={g} value={String(g)}>GW {g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                    <SelectTrigger className="rounded-lg flex-1 min-w-0 h-10">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-[320px]">
                      {daysInGw.map((d) => (
                        <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground"
                    onClick={() => shiftDay(1)}
                    disabled={!canNext}
                    aria-label="Next gameday"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Game</Label>
                <Select value={gameId} onValueChange={setGameId} disabled={gamesLoading || !(gamesByDate?.length)}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={
                      gamesLoading
                        ? "Loading games…"
                        : (gamesByDate?.length ? "Pick a game" : "No games on this gameday")
                    } />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {(gamesByDate ?? []).map((g: any) => {
                      const awayLogo = getTeamLogo(g.away_team);
                      const homeLogo = getTeamLogo(g.home_team);
                      const tip = g.tipoff_utc ? new Date(g.tipoff_utc) : null;
                      const tipStr = tip
                        ? tip.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })
                        : "";
                      return (
                        <SelectItem key={g.game_id} value={g.game_id}>
                          <div className="flex items-center gap-2 w-full">
                            {awayLogo && <img src={awayLogo} alt="" className="w-5 h-5 shrink-0" />}
                            <span className="font-medium">{TEAM_NAME[g.away_team] ?? g.away_team}</span>
                            <span className="text-muted-foreground mx-1">@</span>
                            {homeLogo && <img src={homeLogo} alt="" className="w-5 h-5 shrink-0" />}
                            <span className="font-medium">{TEAM_NAME[g.home_team] ?? g.home_team}</span>
                            {tipStr && (
                              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums pl-3">{tipStr}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={gameSearchDisabled}
                  onClick={() => selectedGame && open(`https://www.nbaplaydb.com/games/${yyyymmdd}-${selectedGame.away_team}${selectedGame.home_team}`)}
                  className="rounded-lg h-10"
                >
                  Open Game on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={gameSearchDisabled}
                  onClick={() => open(`https://www.nbaplaydb.com/search?gamecode=${encodeURIComponent(gamecode)}`)}
                  className="rounded-lg h-10"
                >
                  Search Plays <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
            {!gameSearchDisabled && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">
                  If "Search Plays" is blocked by a verification page, use "Open Game" — it loads the game page directly.
                </p>
                <span className="text-[10px] font-mono text-muted-foreground">{gamecode}</span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TrendTable({ rows, type, onPlayerClick, onTeamClick }: {
  rows: TrendRow[];
  type: "increase" | "decrease";
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
}) {
  const isIncrease = type === "increase";
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
      <SectionHeader
        tone={isIncrease ? "green" : "red"}
        icon={isIncrease ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        title={isIncrease ? "Increased Playing Time" : "Decreased Playing Time"}
        meta="Last 7 Game Days"
      />
      <div className="grid grid-cols-[1fr_40px_60px_60px_65px] gap-0 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40">
        <span>Player</span>
        <span className="text-center">GP</span>
        <span className="text-right">Season</span>
        <span className="text-right">7 Days</span>
        <span className="text-right">{isIncrease ? "Increase" : "Decrease"}</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No data available</div>
        )}
        {rows.map((r, i) => {
          const logo = getTeamLogo(r.team);
          return (
            <div key={r.id} className={`grid grid-cols-[1fr_40px_60px_60px_65px] gap-0 px-3 py-1.5 items-center text-xs border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
              <div className="flex items-center gap-2 min-w-0">
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-6 h-6 rounded-full object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                )}
                <span
                  className="truncate font-medium hover:text-primary hover:underline"
                  onClick={() => onPlayerClick(r.id)}
                >
                  {r.name}
                </span>
                {logo && (
                  <img
                    src={logo}
                    alt={r.team}
                    className="w-4 h-4 shrink-0 cursor-pointer hover:scale-125 transition-transform"
                    onClick={(e) => { e.stopPropagation(); onTeamClick(r.team); }}
                  />
                )}
              </div>
              <span className="text-center text-muted-foreground">{r.gp7d}</span>
              <span className="text-right text-muted-foreground">{r.seasonAvg.toFixed(1)}</span>
              <span className="text-right font-medium">{r.avg7d.toFixed(1)}</span>
              <span className={`text-right font-bold ${isIncrease ? "text-emerald-500" : "text-destructive"}`}>
                {isIncrease ? "+" : ""}{r.delta.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdvancedPage() {
  const { data, isLoading } = usePlayingTimeTrends();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tab, setTab] = useState<AdvancedTab>(() => getLastAdvancedTab() ?? "play-search");
  useEffect(() => { setLastAdvancedTab(tab); }, [tab]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-heading uppercase tracking-[0.4em] text-muted-foreground">
          Advanced · NBA Insights
        </span>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as AdvancedTab)} className="space-y-4">
        <div className="border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg">
          <TabsList className="bg-transparent p-0 h-auto grid grid-cols-4 w-full max-w-3xl mx-auto">
            {([
              ["play-search", "NBA Play Search"],
              ["playing-time", "Playing Time"],
              ["advanced-stats", "Advanced Stats"],
              ["trending", "Trending"],
            ] as const).map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-none bg-transparent shadow-none px-2 py-2.5 font-heading text-[11px] uppercase tracking-wider text-muted-foreground border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:border-[hsl(var(--nba-yellow))] data-[state=active]:shadow-none transition-colors"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="play-search">
          <NBAPlaySearchSection />
        </TabsContent>

        <TabsContent value="playing-time" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-heading font-bold uppercase tracking-wider">Playing Time Trends</h1>
              {data?.latestDate && (
                <span className="text-[10px] text-muted-foreground font-body ml-2">
                  Through {data.latestDate}
                </span>
              )}
            </div>
            {data?.updatedAt && (
              <span className="text-[10px] text-muted-foreground font-body">
                Updated {new Date(data.updatedAt).toLocaleString()}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <TrendTable rows={data?.increased ?? []} type="increase" onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
              <TrendTable rows={data?.decreased ?? []} type="decrease" onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="advanced-stats">
          <AdvancedStatsTab onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
        </TabsContent>

        <TabsContent value="trending">
          <TrendingTab onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
        </TabsContent>
      </Tabs>

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
      <TeamModal tricode={selectedTeam ?? ""} open={selectedTeam !== null} onOpenChange={(open) => !open && setSelectedTeam(null)} />
    </div>
  );
}
