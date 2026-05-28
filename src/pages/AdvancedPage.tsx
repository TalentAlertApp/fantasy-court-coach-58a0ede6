import { useState, useMemo, useEffect } from "react";
import { Flame, Snowflake, Search, ExternalLink, ChevronsUpDown, Check, X, ChevronLeft, ChevronRight, RotateCcw, Link2, Lightbulb } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeagueDeadlines, getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";
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
import LeaderTable, { LeaderRow, LeaderColumn } from "@/components/advanced/LeaderTable";
import { ActionType, EMPTY_SUBFILTERS, SubFilterState, pruneSubFilters } from "@/lib/play-filter-config";
import SectionHeader from "@/components/advanced/SectionHeader";
import { getLastAdvancedTab, setLastAdvancedTab, AdvancedTab } from "@/lib/advanced-tab-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ShareSearchDialog from "@/components/advanced/ShareSearchDialog";
import { getCompetition } from "@/lib/competitions";
import { Link } from "react-router-dom";
import { Users, BarChart3 } from "lucide-react";

const PUBLIC_ORIGIN = "https://hoopsfantasy.app";
/** Build a clean canonical share URL on hoopsfantasy.app — never the lovable preview host. */
function getShareOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  // Always honour the current origin so shared links open on whatever
  // domain the user is testing (preview, custom domain, prod). The canonical
  // PUBLIC_ORIGIN remains the SSR fallback only.
  return window.location.origin;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Decode an `nbaps=...` hash payload into search state. Returns null if missing/invalid. */
function readSearchFromUrl(): { actionPlayer: string; actionTypes: string[]; subFilters: SubFilterState } | null {
  if (typeof window === "undefined") return null;
  // Strip leading "#" and any "/" that some routers prepend before parsing.
  const hash = window.location.hash.replace(/^#\/?/, "");
  let enc: string | null = null;
  try {
    enc = new URLSearchParams(hash).get("nbaps");
  } catch { enc = null; }
  if (!enc) {
    // Fallback: manual extraction in case URLSearchParams chokes on the payload.
    const m = hash.match(/(?:^|&)nbaps=([^&]+)/);
    if (m) enc = decodeURIComponent(m[1]);
  }
  if (!enc) return null;
  try {
    const json = decodeURIComponent(escape(atob(enc)));
    const payload = JSON.parse(json) as { p?: string; a?: string[]; sf?: Partial<SubFilterState> };
    const sf: SubFilterState = { ...EMPTY_SUBFILTERS, ...(payload.sf ?? {}) };
    return {
      actionPlayer: payload.p ?? "",
      actionTypes: Array.isArray(payload.a) ? payload.a : [],
      subFilters: sf,
    };
  } catch {
    return null;
  }
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

type AdvancedGameOption = {
  game_id: string;
  away_team: string;
  home_team: string;
  tipoff_utc: string | null;
  status: string | null;
  home_pts: number | null;
  away_pts: number | null;
};

const ADVANCED_GAME_ROW_GRID =
  "grid w-full min-w-0 items-center gap-2 grid-cols-[28px_52px_minmax(0,1fr)_32px_minmax(0,1fr)_64px]";

function AdvancedGameLogo({ src, alt }: { src?: string; alt: string }) {
  return src ? <img src={src} alt={alt} className="h-5 w-5 shrink-0 object-contain" /> : <span aria-hidden className="h-5 w-5 shrink-0" />;
}

function AdvancedGameSelectRow({
  game,
  isSelected,
  nameFor,
  compact = false,
}: {
  game: AdvancedGameOption;
  isSelected: boolean;
  nameFor: (team: string) => string;
  compact?: boolean;
}) {
  const awayLogo = getTeamLogo(game.away_team);
  const homeLogo = getTeamLogo(game.home_team);
  const hasScores = game.away_pts != null && game.home_pts != null;
  const isPlayed = String(game.status ?? "").toUpperCase() === "FINAL" || hasScores;
  const awayWin = isPlayed && hasScores && Number(game.away_pts) > Number(game.home_pts);
  const homeWin = isPlayed && hasScores && Number(game.home_pts) > Number(game.away_pts);
  const tip = game.tipoff_utc ? new Date(game.tipoff_utc) : null;
  const tipStr = tip
    ? tip.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })
    : "—";

  return (
    <div className={cn(ADVANCED_GAME_ROW_GRID, compact ? "text-[11px]" : "text-xs")}>
      <span className="flex h-5 items-center justify-center">
        {isSelected ? <Check className="h-3.5 w-3.5 text-primary" /> : <span aria-hidden className="invisible">·</span>}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap",
          isPlayed && "text-foreground",
          awayWin && "font-bold",
        )}
      >
        {isPlayed && hasScores ? game.away_pts : "—"}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        <span className={cn("min-w-0 truncate whitespace-nowrap", awayWin ? "font-bold text-foreground" : "font-medium")}>{nameFor(game.away_team)}</span>
        <AdvancedGameLogo src={awayLogo} alt={`${nameFor(game.away_team)} logo`} />
      </div>
      <span className="text-center font-heading text-muted-foreground">@</span>
      <div className="flex min-w-0 items-center justify-start gap-1.5 text-left">
        <AdvancedGameLogo src={homeLogo} alt={`${nameFor(game.home_team)} logo`} />
        <span className={cn("min-w-0 truncate whitespace-nowrap", homeWin ? "font-bold text-foreground" : "font-medium")}>{nameFor(game.home_team)}</span>
      </div>
      <span
        className={cn(
          "font-mono tabular-nums text-left text-muted-foreground whitespace-nowrap",
          isPlayed && "text-foreground",
          homeWin && "font-bold",
        )}
      >
        {isPlayed && hasScores ? game.home_pts : tipStr}
      </span>
    </div>
  );
}

function NBAPlaySearchSection() {
  const { league, isWnba } = useLeague();
  const { data: leagueId } = useLeagueId();
  const { teams: leagueTeams } = useLeagueTeams();
  const TEAM_NAME = useMemo<Record<string, string>>(
    () => Object.fromEntries(leagueTeams.map((t) => [t.tricode, t.name])),
    [leagueTeams],
  );
  const { deadlines: leagueDeadlinesRaw } = useLeagueDeadlines();
  const activeDeadlines = league === "wnba" ? leagueDeadlinesRaw : DEADLINES;
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

  const initial = useMemo(
    () => (league === "wnba" ? (getCurrentGamedayFrom(activeDeadlines) ?? activeDeadlines[0] ?? getCurrentGameday()) : getCurrentGameday()),
    [league, activeDeadlines],
  );
  const [gw, setGw] = useState<number>(initial.gw);
  const [day, setDay] = useState<number>(initial.day);
  const [gameId, setGameId] = useState("");
  // Re-anchor when league switches and deadlines change.
  useEffect(() => {
    setGw(initial.gw);
    setDay(initial.day);
    setGameId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  // Lisbon-day label + yyyymmdd derived from the matched deadline
  const currentDeadline = useMemo(
    () => activeDeadlines.find((d) => d.gw === gw && d.day === day) ?? initial,
    [gw, day, initial, activeDeadlines],
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
    () => activeDeadlines.findIndex((d) => d.gw === gw && d.day === day),
    [gw, day, activeDeadlines],
  );
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < activeDeadlines.length - 1;
  const shiftDay = (delta: number) => {
    const next = activeDeadlines[currentIndex + delta];
    if (!next) return;
    setGw(next.gw);
    setDay(next.day);
  };

  const daysInGw = useMemo(() => activeDeadlines.filter((d) => d.gw === gw).map((d) => d.day), [gw, activeDeadlines]);
  const allGws = useMemo(() => Array.from(new Set(activeDeadlines.map((d) => d.gw))), [activeDeadlines]);

  // Reset selected game when (gw, day) changes — proper effect, not useMemo
  useEffect(() => {
    setGameId("");
  }, [gw, day]);

  const { data: gamesByDate, isLoading: gamesLoading } = useQuery({
    queryKey: ["games-by-gw-day", gw, day, leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, away_team, home_team, tipoff_utc, status, home_pts, away_pts")
        .eq("league_id", leagueId!)
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
    const url = `https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}search?${params.toString()}`;
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
    const u = new URL(`${getShareOrigin()}/advanced`);
    u.hash = `nbaps=${encoded}`;
    return u.toString();
  };

  const [shareOpen, setShareOpen] = useState(false);
  const handleCopyLink = () => setShareOpen(true);
  const buildNbaPlayDbUrl = (): string | null => {
    if (!actionPlayer && actionTypes.length === 0) return null;
    const params = new URLSearchParams();
    if (actionPlayer) params.set("actionplayer", actionPlayer);
    for (const t of actionTypes) params.append("actiontype", t);
    for (const v of subFilters.qualifiers) params.append("qualifiers", v);
    for (const v of subFilters.subtype) params.append("subtype", v);
    for (const v of subFilters.area) params.append("area", v);
    for (const v of subFilters.shotresult) params.append("shotresult", v);
    if (subFilters.isaftertimeout) params.set("isATO", "true");
    if (subFilters.isbuzzerbeater) params.set("isBuzzerBeater", "true");
    if (subFilters.shotdistancemin != null) params.set("shotdistancemin", String(subFilters.shotdistancemin));
    if (subFilters.shotdistancemax != null) params.set("shotdistancemax", String(subFilters.shotdistancemax));
    return `https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}search?${params.toString()}`;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
      <ShareSearchDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareUrl={buildShareUrl()}
        nbaPlayDbUrl={buildNbaPlayDbUrl()}
        actionPlayer={actionPlayer}
        actionTypes={actionTypes}
        subFilters={subFilters}
      />
      <SectionHeader
        tone="blue"
        icon={<Search className="h-4 w-4" />}
        title="Play Search"
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
                  <PopoverContent className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" align="start" collisionPadding={12}>
                    <Command>
                      <CommandList className="max-h-[60vh] overflow-y-auto">
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
                        : (gamesByDate?.length
                            ? (lisbonDateLabel ? `Pick a game · ${lisbonDateLabel}` : "Pick a game")
                            : "No games on this gameday")
                    } />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[70vh] min-w-[var(--radix-select-trigger-width)]">
                    {(gamesByDate ?? []).map((g: any) => {
                      const awayLogo = getTeamLogo(g.away_team);
                      const homeLogo = getTeamLogo(g.home_team);
                      const tip = g.tipoff_utc ? new Date(g.tipoff_utc) : null;
                      const tipStr = tip
                        ? tip.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })
                        : "";
                      const isPlayed = g.status === "FINAL";
                      const aPts = g.away_pts ?? 0;
                      const hPts = g.home_pts ?? 0;
                      const awayWin = isPlayed && aPts > hPts;
                      const homeWin = isPlayed && hPts > aPts;
                      return (
                        <SelectItem
                          key={g.game_id}
                          value={g.game_id}
                          className={cn(
                            "!pl-2 !pr-2 [&>span:first-child]:hidden",
                            isPlayed ? "" : "opacity-60",
                          )}
                        >
                          <div className="group grid items-center gap-2 w-full grid-cols-[44px_minmax(0,1fr)_28px_minmax(0,1fr)_44px]">
                            <span className={cn("font-mono tabular-nums text-right text-[11px] text-foreground/80", awayWin && "font-bold text-foreground")}>
                              {isPlayed ? aPts : ""}
                            </span>
                            <div className="relative flex items-center justify-end pr-12 min-w-0">
                              <span className={cn("relative z-10 truncate whitespace-nowrap", awayWin ? "font-bold" : "font-medium")}>
                                {TEAM_NAME[g.away_team] ?? g.away_team}
                              </span>
                              {awayLogo && (
                                <img
                                  src={awayLogo}
                                  alt=""
                                  aria-hidden
                                  className="pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 h-10 w-10 object-contain opacity-30 group-hover:opacity-80 group-hover:scale-125 group-hover:translate-x-1 transition-all duration-300 ease-out drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
                                />
                              )}
                            </div>
                            <span className="text-center text-muted-foreground">@</span>
                            <div className="relative flex items-center justify-start pl-12 min-w-0">
                              {homeLogo && (
                                <img
                                  src={homeLogo}
                                  alt=""
                                  aria-hidden
                                  className="pointer-events-none select-none absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 object-contain opacity-30 group-hover:opacity-80 group-hover:scale-125 group-hover:-translate-x-1 transition-all duration-300 ease-out drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
                                />
                              )}
                              <span className={cn("relative z-10 truncate whitespace-nowrap", homeWin ? "font-bold" : "font-medium")}>
                                {TEAM_NAME[g.home_team] ?? g.home_team}
                              </span>
                            </div>
                            <span className={cn("font-mono tabular-nums text-left text-[11px] text-foreground/80", homeWin && "font-bold text-foreground")}>
                              {isPlayed ? hPts : (tipStr || "")}
                            </span>
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
                  onClick={() => {
                    if (!selectedGame) return;
                    const gameDateET = new Intl.DateTimeFormat("en-CA", {
                      timeZone: "America/New_York",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(selectedGame.tipoff_utc)).replace(/-/g, "");
                    // nbaplaydb uses PDX (not POR) for Portland in its URL scheme.
                    const mapTri = (t: string) => (t?.toUpperCase() === "POR" ? "PDX" : t);
                    const away = mapTri(selectedGame.away_team);
                    const home = mapTri(selectedGame.home_team);
                    open(`https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}games/${gameDateET}-${away}${home}`);
                  }}
                  className="rounded-lg h-10"
                >
                  Open Game on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={gameSearchDisabled}
                  onClick={() => open(`https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}search?gamecode=${encodeURIComponent(gamecode)}`)}
                  className="rounded-lg h-10"
                >
                  Search Plays <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
            {!gameSearchDisabled && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">
                  {selectedGame && selectedGame.status !== "FINAL"
                    ? "This game hasn't been played yet — no player actions to search."
                    : "If \"Search Plays\" is blocked by a verification page, use \"Open Game\" — it loads the game page directly."}
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

export default function AdvancedPage() {
  const { league } = useLeague();
  const competition = getCompetition(league);
  // Advanced / PLAY SEARCH is gated by the competition registry. Competitions
  // that don't expose play-by-play data (e.g. EuroLeague today) still get
  // Playing Time / Advanced Stats / Trending — we just hide the Play Search tab.
  const showPlaySearch = competition.hasAdvancedPlaySearch;
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 1000 });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tab, setTab] = useState<AdvancedTab>(() => {
    const last = getLastAdvancedTab() ?? (showPlaySearch ? "play-search" : "playing-time");
    return last === "play-search" && !showPlaySearch ? "playing-time" : last;
  });
  useEffect(() => { setLastAdvancedTab(tab); }, [tab]);

  const tabsDef = ([
    ...(showPlaySearch ? [["play-search", "Play Search"] as const] : []),
    ["playing-time", "Fantasy Points"] as const,
    ["advanced-stats", "Advanced Stats"] as const,
    ["trending", "Trending"] as const,
  ]);
  const gridColsCls = tabsDef.length === 4 ? "grid-cols-4" : "grid-cols-3";

  const fpCols: LeaderColumn[] = [
    { key: "fp", label: "FP", align: "right", tone: "accent" },
    { key: "fp5", label: "FP5", align: "right" },
    { key: "mpg", label: "MPG", align: "right" },
    { key: "v", label: "V", align: "right" },
    { key: "d", label: "Δ", align: "right", tone: "delta" },
  ];
  const fpItems = useMemo(() => ((playersData as any)?.items ?? []) as any[], [playersData]);
  const fpRowsAll: LeaderRow[] = useMemo(() => {
    return fpItems
      .filter((p) => Number(p.season?.fp) > 0 && Number(p.season?.gp ?? p.last5?.gp ?? 0) >= 3)
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [
          Number(p.season?.fp ?? 0),
          Number(p.last5?.fp5 ?? 0),
          Number(p.last5?.mpg5 ?? p.season?.mpg ?? 0),
          Number(p.computed?.value ?? 0),
          Number(p.computed?.delta_fp ?? 0),
        ],
      }));
  }, [fpItems]);
  const topFpRows = useMemo(
    () => [...fpRowsAll].sort((a, b) => Number(b.values[0]) - Number(a.values[0])),
    [fpRowsAll],
  );
  const lessFpRows = useMemo(
    () => [...fpRowsAll].sort((a, b) => Number(a.values[0]) - Number(b.values[0])),
    [fpRowsAll],
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-heading uppercase tracking-[0.4em] text-muted-foreground">
          Advanced · {competition.label} Insights
        </span>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as AdvancedTab)} className="space-y-4">
        <div className="border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg">
          <TabsList className={`bg-transparent p-0 h-auto grid ${gridColsCls} w-full max-w-3xl mx-auto`}>
            {tabsDef.map(([v, label]) => (
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

        {showPlaySearch && (
          <TabsContent value="play-search">
            <NBAPlaySearchSection />
          </TabsContent>
        )}

        <TabsContent value="playing-time" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-[hsl(var(--nba-yellow))]" />
              <h1 className="text-lg font-heading font-bold uppercase tracking-wider">Fantasy Points Leaders</h1>
              <span className="text-[10px] text-muted-foreground font-body ml-2">
                Season FP · FP5 · MPG · Value · Δ (FP5 vs season)
              </span>
            </div>
          </div>

          {playersLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <LeaderTable
                title="Top FP"
                subtitle="Season leaders"
                icon={<Flame className="h-4 w-4 text-[hsl(var(--nba-yellow))]" />}
                tone="yellow"
                columns={fpCols}
                rows={topFpRows}
                onPlayerClick={setSelectedPlayerId}
                onTeamClick={setSelectedTeam}
              />
              <LeaderTable
                title="Less FP"
                subtitle="Bottom of the board"
                icon={<Snowflake className="h-4 w-4 text-blue-400" />}
                tone="blue"
                columns={fpCols}
                rows={lessFpRows}
                onPlayerClick={setSelectedPlayerId}
                onTeamClick={setSelectedTeam}
              />
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
