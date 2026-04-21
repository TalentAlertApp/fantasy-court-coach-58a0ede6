import { useState } from "react";
import { TrendingUp, TrendingDown, Clock, Search, ExternalLink } from "lucide-react";
import { usePlayingTimeTrends, TrendRow } from "@/hooks/usePlayingTimeTrends";
import { getTeamLogo } from "@/lib/nba-teams";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NBA_TEAMS } from "@/lib/nba-teams";

const PLAY_TYPES = [
  { value: "__all__", label: "All plays" },
  { value: "dunk", label: "Dunk" },
  { value: "3pt", label: "3-pointer" },
  { value: "assist", label: "Assist" },
  { value: "rebound", label: "Rebound" },
  { value: "block", label: "Block" },
  { value: "steal", label: "Steal" },
  { value: "turnover", label: "Turnover" },
  { value: "foul", label: "Foul" },
  { value: "freethrow", label: "Free throw" },
];

const SORTED_TEAMS = [...NBA_TEAMS].sort((a, b) => a.name.localeCompare(b.name));

function NBAPlaySearchSection() {
  const [player, setPlayer] = useState("");
  const [playType, setPlayType] = useState("__all__");
  const [team, setTeam] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [away, setAway] = useState("");
  const [home, setHome] = useState("");

  const playTypeLabel = playType !== "__all__" ? playType : "";
  const composedQ = [player.trim(), playTypeLabel, team.trim()].filter(Boolean).join(" ").trim();
  const playerSearchDisabled = !player.trim() && !playTypeLabel;

  const yyyymmdd = date.split("-").join("");
  const gamecode = `${yyyymmdd}/${away}${home}`;
  const gameSearchDisabled = !date || !away || !home;

  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

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
        <Tabs defaultValue="player">
          <TabsList className="rounded-lg">
            <TabsTrigger value="player" className="font-heading text-xs uppercase rounded-lg">🔍 By Player / Play</TabsTrigger>
            <TabsTrigger value="game" className="font-heading text-xs uppercase rounded-lg">🏀 By Game</TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Player name</Label>
                <Input
                  placeholder="e.g. Nikola Jokić"
                  value={player}
                  onChange={(e) => setPlayer(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Play type</Label>
                <Select value={playType} onValueChange={setPlayType}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {PLAY_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Team</Label>
                <Input
                  placeholder="e.g. Denver Nuggets"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={playerSearchDisabled}
              onClick={() => open(`https://www.nbaplaydb.com/search?q=${encodeURIComponent(composedQ)}`)}
              className="rounded-lg"
            >
              Open on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </TabsContent>

          <TabsContent value="game" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Game date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Away team</Label>
                <Select value={away} onValueChange={setAway}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select away team" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[300px]">
                    {SORTED_TEAMS.map((t) => (
                      <SelectItem key={t.tricode} value={t.tricode}>{t.tricode} — {t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Home team</Label>
                <Select value={home} onValueChange={setHome}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select home team" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[300px]">
                    {SORTED_TEAMS.map((t) => (
                      <SelectItem key={t.tricode} value={t.tricode}>{t.tricode} — {t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={gameSearchDisabled}
                onClick={() => open(`https://www.nbaplaydb.com/search?gamecode=${encodeURIComponent(gamecode)}`)}
                className="rounded-lg"
              >
                Open on NBAPlayDB <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={gameSearchDisabled}
                onClick={() => open(`https://www.nbaplaydb.com/games/${yyyymmdd}-${away}${home}`)}
                className="rounded-lg"
              >
                View Game Page <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              {!gameSearchDisabled && (
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">{gamecode}</span>
              )}
            </div>
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
