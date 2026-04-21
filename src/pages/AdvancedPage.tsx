import { useState, useMemo, useEffect } from "react";
import { TrendingUp, TrendingDown, Clock, Search, ExternalLink, ChevronsUpDown, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
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
            className="w-full justify-between rounded-lg font-normal h-10"
          >
            {selected ? (
              <div className="flex items-center gap-2 min-w-0">
                {selected.photo ? (
                  <img src={selected.photo} alt="" className="w-6 h-6 rounded-full object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0 inline-flex items-center justify-center text-[8px] font-bold">
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="truncate">{selected.name}</span>
                {selectedLogo && <img src={selectedLogo} alt="" className="w-4 h-4 shrink-0" />}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
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
                          className="absolute right-2 w-9 h-9 opacity-[0.12] group-hover:opacity-30 group-hover:scale-110 transition-all pointer-events-none"
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
                        <Check className={cn("h-4 w-4 shrink-0 mr-8", isSelected ? "opacity-100 text-primary" : "opacity-0")} />
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
  const [actionPlayer, setActionPlayer] = useState("");
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [actionPopoverOpen, setActionPopoverOpen] = useState(false);

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
    setActionTypes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };
  const actionTriggerLabel = (() => {
    if (actionTypes.length === 0) return "All actions";
    const first = ACTION_TYPES.find((x) => x.value === actionTypes[0])?.label ?? actionTypes[0];
    if (actionTypes.length === 1) return first;
    return `${first} +${actionTypes.length - 1}`;
  })();

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-heading font-bold uppercase tracking-wider">NBA Play Search</span>
        <span className="text-[10px] text-muted-foreground ml-2 inline-flex items-center gap-1">
          Search play-by-play clips on NBAPlayDB — results open in a new tab
          <ExternalLink className="h-3 w-3" />
        </span>
      </div>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="matchup">
          <TabsList className="rounded-lg grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="matchup" className="font-heading text-xs uppercase rounded-lg">🏀 Player Matchup</TabsTrigger>
            <TabsTrigger value="game" className="font-heading text-xs uppercase rounded-lg">🏀 By Game</TabsTrigger>
          </TabsList>

          <TabsContent value="matchup" className="mt-4 space-y-2">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <PlayerCombobox
                label="Offensive Player"
                value={offensivePlayer}
                onChange={setOffensivePlayer}
                players={players}
                placeholder="Pick offensive player…"
              />
              <PlayerCombobox
                label="Defensive Player"
                value={defensivePlayer}
                onChange={setDefensivePlayer}
                players={players}
                placeholder="Pick defensive player…"
              />
              <div className="flex items-center gap-2">
                <Button
                  disabled={matchupDisabled}
                  onClick={handleMatchupOpen}
                  className="rounded-lg h-10"
                >
                  Open Matchup on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={!offensivePlayer && !defensivePlayer}
                  onClick={() => {
                    setOffensivePlayer("");
                    setDefensivePlayer("");
                  }}
                  className="rounded-lg h-10"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Both players auto-applied as Matchup filters on NBAPlayDB.
            </p>
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
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 ${isIncrease ? "bg-emerald-500/10 border-b border-emerald-500/20" : "bg-destructive/10 border-b border-destructive/20"}`}>
        {isIncrease ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className="text-xs font-heading font-bold uppercase tracking-wider">
          {isIncrease ? "Increased Playing Time" : "Decreased Playing Time"}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">Last 7 Game Days</span>
      </div>
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

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <NBAPlaySearchSection />

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

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
      <TeamModal tricode={selectedTeam ?? ""} open={selectedTeam !== null} onOpenChange={(open) => !open && setSelectedTeam(null)} />
    </div>
  );
}
