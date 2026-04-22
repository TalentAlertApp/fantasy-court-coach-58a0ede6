import { useState, useRef, useMemo, useEffect } from "react";
import { Trophy, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Crown, Flame, Medal, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, Shield, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useScoringHistory, type ScoringGameDay } from "@/hooks/useScoringHistory";
import { useLeagueStandings } from "@/hooks/useLeagueStandings";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamLogo } from "@/lib/nba-teams";
import TeamModal from "@/components/TeamModal";
import PlayerModal from "@/components/PlayerModal";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

type SortCol = "gw" | "total_fp" | "best" | "worst" | "captain_bonus";
type SortDir = "asc" | "desc";
type TabValue = "league" | "team";

const TAB_LS_KEY = "nba_scoring_tab";

export default function ScoringPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teams: userTeams, selectedTeamId, setSelectedTeamId, isReady: teamReady } = useTeam();

  const [tab, setTab] = useState<TabValue>(() => {
    if (typeof window === "undefined") return "league";
    return (localStorage.getItem(TAB_LS_KEY) as TabValue) || "league";
  });
  useEffect(() => { try { localStorage.setItem(TAB_LS_KEY, tab); } catch {} }, [tab]);

  const standingsQuery = useLeagueStandings();
  const historyQuery = useScoringHistory();
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [teamModalTeam, setTeamModalTeam] = useState<string | null>(null);
  const [playerModalId, setPlayerModalId] = useState<number | null>(null);
  const rosterRef = useRef<HTMLDivElement>(null);
  const [sortCol, setSortCol] = useState<SortCol>("gw");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const myTeams = useMemo(
    () => userTeams.filter(t => true), // RLS already scopes to current user
    [userTeams]
  );

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">
      {/* Header — premium NBA bar with court-line gradient */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-card via-card/80 to-card px-5 py-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 0% 50%, hsl(var(--nba-yellow) / 0.18), transparent 40%), radial-gradient(circle at 100% 50%, hsl(var(--primary) / 0.18), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[hsl(var(--nba-yellow))]/15 ring-1 ring-[hsl(var(--nba-yellow))]/40 flex items-center justify-center">
            <Activity className="h-5 w-5 text-[hsl(var(--nba-yellow))]" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-black uppercase tracking-wider leading-none">Scoring</h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-heading mt-1">
              League standings · Team performance
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        {/* Tab bar + (when on Your Team) inline team selector at far right */}
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList className="grid grid-cols-2 w-full max-w-sm bg-card border border-border h-10 p-1 rounded-xl">
            <TabsTrigger
              value="league"
              className="font-heading uppercase text-xs tracking-wider gap-2 rounded-lg data-[state=active]:bg-[hsl(var(--nba-yellow))]/15 data-[state=active]:text-[hsl(var(--nba-yellow))] data-[state=active]:shadow-none"
            >
              <Crown className="h-3.5 w-3.5" /> League
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="font-heading uppercase text-xs tracking-wider gap-2 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Shield className="h-3.5 w-3.5" /> Your Team
            </TabsTrigger>
          </TabsList>
          {tab === "team" && myTeams.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] uppercase font-heading tracking-[0.2em] text-muted-foreground">Team</span>
              <Select value={selectedTeamId ?? ""} onValueChange={(v) => setSelectedTeamId(v)}>
                <SelectTrigger className="w-64 h-10 rounded-xl bg-card border-border font-heading text-xs uppercase tracking-wider">
                  <SelectValue placeholder="Pick a team…" />
                </SelectTrigger>
                <SelectContent>
                  {myTeams.map(t => (
                    <SelectItem key={t.id} value={t.id} className="font-heading text-xs uppercase">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ════════════════════════ LEAGUE TAB ════════════════════════ */}
        <TabsContent value="league" className="space-y-5 mt-5">
          <LeagueView
            data={standingsQuery.data}
            isLoading={standingsQuery.isLoading}
            isError={standingsQuery.isError}
            refetch={standingsQuery.refetch}
            currentUserId={user?.id ?? null}
            selectedTeamId={selectedTeamId}
            onSelectMyTeam={(teamId) => {
              setSelectedTeamId(teamId);
              setTab("team");
            }}
          />
        </TabsContent>

        {/* ════════════════════════ YOUR TEAM TAB ════════════════════════ */}
        <TabsContent value="team" className="space-y-5 mt-5">
          {myTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card border border-border rounded-xl">
              <Shield className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground font-heading">You don't own any teams yet</p>
              <Button onClick={() => navigate("/onboarding")} size="sm" className="rounded-xl">
                Create your first team
              </Button>
            </div>
          ) : (
            <YourTeamView
              data={historyQuery.data}
              isLoading={!teamReady || historyQuery.isLoading}
              isError={historyQuery.isError}
              refetch={historyQuery.refetch}
              selectedDayIdx={selectedDayIdx}
              setSelectedDayIdx={setSelectedDayIdx}
              rosterRef={rosterRef}
              sortCol={sortCol} setSortCol={setSortCol}
              sortDir={sortDir} setSortDir={setSortDir}
              onTeamModal={setTeamModalTeam}
              onPlayerModal={setPlayerModalId}
            />
          )}
        </TabsContent>
      </Tabs>

      <TeamModal
        tricode={teamModalTeam}
        open={!!teamModalTeam}
        onOpenChange={(open) => { if (!open) setTeamModalTeam(null); }}
      />
      <PlayerModal
        playerId={playerModalId}
        open={playerModalId !== null}
        onOpenChange={(open) => { if (!open) setPlayerModalId(null); }}
      />
    </div>
  );
}

type StandSortKey = "rank" | "total_fp" | "current_week_fp" | "latest_day_fp";

// ══════════════════════════════ LEAGUE VIEW ══════════════════════════════
function LeagueView({
  data, isLoading, isError, refetch, currentUserId, selectedTeamId, onSelectMyTeam,
}: {
  data: ReturnType<typeof useLeagueStandings>["data"];
  isLoading: boolean; isError: boolean; refetch: () => void;
  currentUserId: string | null; selectedTeamId: string | null;
  onSelectMyTeam: (teamId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<StandSortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: StandSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: StandSortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-40 inline-block ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 inline-block ml-1 text-[hsl(var(--nba-yellow))]" />
      : <ArrowDown className="h-3 w-3 inline-block ml-1 text-[hsl(var(--nba-yellow))]" />;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse font-heading">Loading league…</div>;
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Trophy className="h-12 w-12 text-destructive/40" />
        <p className="text-destructive font-heading">Couldn't load league standings</p>
        <Button onClick={refetch} size="sm" className="rounded-xl"><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
      </div>
    );
  }

  const { teams, summary } = data;

  const filtered = teams.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.team_name.toLowerCase().includes(q) || (t.owner_label ?? "").toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortBy] as number;
    const bv = b[sortBy] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Crown className="h-4 w-4 text-[hsl(var(--nba-yellow))]" />}
          label="League Leader"
          value={summary.league_leader?.team_name ?? "—"}
          sub={summary.league_leader ? `${summary.league_leader.total_fp.toFixed(1)} FP · ${summary.league_leader.owner_label}` : ""}
        />
        <KpiCard
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          label="Best This Week"
          value={summary.best_this_week?.team_name ?? "—"}
          sub={summary.best_this_week ? `${summary.best_this_week.current_week_fp.toFixed(1)} FP · ${summary.best_this_week.owner_label}` : ""}
        />
        <KpiCard
          icon={<Medal className="h-4 w-4 text-emerald-400" />}
          label="Highest Single Week"
          value={summary.highest_single_week?.team_name ?? "—"}
          sub={summary.highest_single_week ? `${summary.highest_single_week.best_week_fp.toFixed(1)} FP · ${summary.highest_single_week.owner_label}` : ""}
        />
        <KpiCard
          icon={<Users className="h-4 w-4 text-primary" />}
          label="Total Teams"
          value={String(summary.total_teams)}
          sub="In Main League"
        />
      </div>

      {/* Standings table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/60 via-muted/30 to-transparent flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-2">
            <Crown className="h-4 w-4 text-[hsl(var(--nba-yellow))]" /> Standings
          </h2>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team or owner…"
                className="pl-8 h-9 w-56 rounded-xl text-xs"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as StandSortKey)}>
              <SelectTrigger className="w-44 h-9 rounded-xl text-xs font-heading uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank" className="text-xs font-heading uppercase">Sort: Rank</SelectItem>
                <SelectItem value="total_fp" className="text-xs font-heading uppercase">Sort: Total FP</SelectItem>
                <SelectItem value="current_week_fp" className="text-xs font-heading uppercase">Sort: This Week</SelectItem>
                <SelectItem value="latest_day_fp" className="text-xs font-heading uppercase">Sort: Last Day</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="h-9 rounded-xl px-2"
              title={sortDir === "asc" ? "Ascending" : "Descending"}
            >
              {sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-heading uppercase tracking-wider text-muted-foreground bg-muted/20">
                <th
                  className="px-3 py-2 text-left w-12 cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("rank")}
                >
                  #<SortIcon col="rank" />
                </th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("total_fp")}
                >
                  Total FP<SortIcon col="total_fp" />
                </th>
                <th
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("current_week_fp")}
                >
                  This Wk<SortIcon col="current_week_fp" />
                </th>
                <th
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("latest_day_fp")}
                >
                  Last Day<SortIcon col="latest_day_fp" />
                </th>
                <th className="px-3 py-2 text-right">Avg/GW</th>
                <th className="px-3 py-2 text-right">Best Wk</th>
                <th className="px-3 py-2 text-right">Worst Wk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground font-heading">
                  {teams.length === 0 ? "No teams yet" : "No teams match your search"}
                </td></tr>
              )}
              {sorted.map(t => {
                const isMine = t.owner_id === currentUserId;
                const isSelected = t.team_id === selectedTeamId;
                const clickable = isMine;
                return (
                  <tr
                    key={t.team_id}
                    className={`border-b border-border/40 transition-colors ${
                      isSelected ? "bg-[hsl(var(--nba-yellow))]/15" : isMine ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                    } ${clickable ? "cursor-pointer" : ""}`}
                    onClick={() => clickable && onSelectMyTeam(t.team_id)}
                    title={clickable ? "Open in Your Team tab" : undefined}
                  >
                    <td className="px-3 py-2 font-heading font-bold text-muted-foreground">
                      {t.rank === 1 ? <Crown className="h-4 w-4 text-[hsl(var(--nba-yellow))] inline-block" /> : t.rank}
                    </td>
                    <td className="px-3 py-2 font-heading font-bold">
                      {t.team_name}
                      {isMine && <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0 border-primary/40 text-primary">YOU</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{t.owner_label}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-[hsl(var(--nba-yellow))]">{t.total_fp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono">{t.current_week_fp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono">{t.latest_day_fp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{t.avg_fp_per_gw.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">{t.best_week_fp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-destructive">{t.worst_week_fp.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="group relative overflow-hidden bg-card border border-border rounded-xl p-3.5 transition-all duration-300 hover:border-[hsl(var(--nba-yellow))]/40 hover:shadow-[0_0_24px_hsl(var(--nba-yellow)/0.08)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-[hsl(var(--nba-yellow))]/8 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <div className="relative flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className="relative mt-1.5 font-heading font-black text-lg truncate uppercase tracking-tight" title={value}>{value}</div>
      {sub && <div className="relative text-[10px] text-muted-foreground font-mono truncate mt-0.5">{sub}</div>}
    </div>
  );
}

// ══════════════════════════════ YOUR TEAM VIEW ══════════════════════════════
function YourTeamView({
  data, isLoading, isError, refetch,
  selectedDayIdx, setSelectedDayIdx, rosterRef,
  sortCol, setSortCol, sortDir, setSortDir,
  onTeamModal, onPlayerModal,
}: any) {
  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse font-heading">Loading scoring…</div>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Trophy className="h-12 w-12 text-destructive/40" />
        <p className="text-destructive font-heading">Couldn't load scoring data</p>
        <Button onClick={refetch} size="sm" className="rounded-xl"><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
      </div>
    );
  }
  if (!data || data.game_days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card border border-border rounded-xl">
        <Trophy className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground font-heading">No scoring data available yet</p>
      </div>
    );
  }

  const { weeks, game_days, transactions } = data;
  const seasonTotal = weeks.reduce((s: number, w: any) => s + w.total_fp, 0);
  const currentGw = weeks.length > 0 ? weeks[weeks.length - 1].gw : 1;
  const txnDates = new Set(transactions.map((t: any) => t.created_at?.substring(0, 10)));

  const timelineData = game_days.map((gd: ScoringGameDay, i: number) => ({
    label: `W${gd.gw}D${gd.day}`,
    fp: gd.total_fp,
    index: i,
    hasTxn: txnDates.has(gd.game_date),
  }));

  const selectedDay: ScoringGameDay | null =
    selectedDayIdx != null ? game_days[selectedDayIdx] : game_days[game_days.length - 1];
  const selectedIdx = selectedDayIdx ?? game_days.length - 1;

  const navigateDay = (dir: -1 | 1) => {
    const next = selectedIdx + dir;
    if (next >= 0 && next < game_days.length) setSelectedDayIdx(next);
  };

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d: SortDir) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sortedWeeks = [...weeks].sort((a: any, b: any) => {
    let av: number, bv: number;
    switch (sortCol) {
      case "gw": av = a.gw; bv = b.gw; break;
      case "total_fp": av = a.total_fp; bv = b.total_fp; break;
      case "best": av = a.best_player?.fp ?? 0; bv = b.best_player?.fp ?? 0; break;
      case "worst": av = a.worst_player?.fp ?? 0; bv = b.worst_player?.fp ?? 0; break;
      case "captain_bonus": av = a.captain_bonus; bv = b.captain_bonus; break;
      default: av = a.gw; bv = b.gw;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });
  const thClass = (col: SortCol) =>
    `px-4 py-2 cursor-pointer select-none hover:text-foreground transition-colors ${sortCol === col ? "font-extrabold text-foreground" : ""}`;

  const PlayerPhoto = ({ photo, name }: { photo: string | null; name: string }) =>
    photo ? <img src={photo} alt={name} className="w-5 h-5 rounded-full object-cover border border-border" />
          : <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[7px] font-bold">{name.substring(0, 2).toUpperCase()}</div>;

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-muted-foreground font-heading uppercase">Season Total</span>
        <span className="text-xl font-heading font-bold text-[hsl(var(--nba-yellow))]">{seasonTotal.toFixed(1)} FP</span>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">FP Timeline</h2>
        </div>
        <div className="px-4 py-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={35} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line
                type="monotone" dataKey="fp" stroke="hsl(var(--nba-yellow))" strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.index === selectedIdx;
                  return (
                    <circle
                      key={payload.index} cx={cx} cy={cy}
                      r={isSelected ? 6 : payload.hasTxn ? 5 : 3}
                      fill={payload.hasTxn ? "hsl(var(--destructive))" : isSelected ? "hsl(var(--nba-yellow))" : "hsl(var(--primary))"}
                      stroke={isSelected ? "white" : "none"} strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: "pointer" }}
                      onClick={() => { setSelectedDayIdx(payload.index); rosterRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                    />
                  );
                }}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Game Day</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Roster Change</div>
        </div>
      </div>

      {/* Game day roster table */}
      {selectedDay && (
        <div ref={rosterRef} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
            <button onClick={() => navigateDay(-1)} disabled={selectedIdx <= 0} className="p-1 rounded-lg hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h2 className="text-base font-heading font-bold uppercase tracking-wider">GW{selectedDay.gw} Day {selectedDay.day}</h2>
              <span className="text-xs text-muted-foreground">{selectedDay.game_date}</span>
            </div>
            <button onClick={() => navigateDay(1)} disabled={selectedIdx >= game_days.length - 1} className="p-1 rounded-lg hover:bg-muted disabled:opacity-30">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Starting 5</span>
            </div>
            <div className="flex items-center gap-3">
              {selectedDay.players.filter((p: any) => p.is_starter).slice(0, 5).map((p: any) => (
                <div key={p.player_id} className="flex flex-col items-center cursor-pointer hover:opacity-80" onClick={() => onPlayerModal(p.player_id)}>
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">{p.name.substring(0, 2)}</div>
                  )}
                  <span className="text-[8px] font-heading font-bold mt-0.5 truncate max-w-[60px]">{p.name.split(" ").pop()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left w-8">Pos</th>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-center">Opp</th>
                  <th className="px-3 py-2 text-center">Res</th>
                  <th className="px-3 py-2 text-right">FP</th>
                  <th className="px-3 py-2 text-right">$</th>
                  <th className="px-3 py-2 text-right">V</th>
                  <th className="px-3 py-2 text-right">MP</th>
                  <th className="px-3 py-2 text-right">PS</th>
                  <th className="px-3 py-2 text-right">A</th>
                  <th className="px-3 py-2 text-right">R</th>
                  <th className="px-3 py-2 text-right">B</th>
                  <th className="px-3 py-2 text-right">S</th>
                </tr>
              </thead>
              <tbody>
                {selectedDay.players.map((p: any) => {
                  const isFc = p.fc_bc === "FC";
                  const oppLogo = getTeamLogo(p.opp);
                  const playerTeamLogo = getTeamLogo(p.team);
                  const isAway = p.home_away === "A";
                  return (
                    <tr key={p.player_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors group">
                      <td className="px-3 py-2">
                        <Badge variant={isFc ? "destructive" : "default"} className="text-[8px] px-1.5 py-0 rounded h-4">{p.fc_bc}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 relative">
                          <div className="cursor-pointer" onClick={() => onPlayerModal(p.player_id)}>
                            {p.photo ? (
                              <img src={p.photo} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-border transition-transform group-hover:scale-110" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">{p.name.substring(0, 2)}</div>
                            )}
                          </div>
                          <span className="text-sm font-heading font-bold cursor-pointer hover:underline" onClick={() => onPlayerModal(p.player_id)}>{p.name}</span>
                          {playerTeamLogo && (
                            <img src={playerTeamLogo} alt={p.team}
                              className="absolute right-0 h-10 w-10 opacity-10 group-hover:opacity-25 transition-all group-hover:scale-110 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); onTeamModal(p.team); }} />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-0.5">
                          {isAway && <span className="text-[9px] text-muted-foreground">@</span>}
                          {oppLogo ? (
                            <img src={oppLogo} alt={p.opp}
                              className="w-7 h-7 object-contain cursor-pointer transition-transform hover:scale-110"
                              onClick={(e) => { e.stopPropagation(); onTeamModal(p.opp); }} />
                          ) : <span className="text-xs font-mono">{p.opp}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.result_wl ? (
                          p.nba_game_url ? (
                            <a href={p.nba_game_url} target="_blank" rel="noopener noreferrer"
                              className={`text-xs font-bold inline-flex items-center gap-0.5 hover:underline ${p.result_wl === "W" ? "text-green-500" : "text-destructive"}`}>
                              {p.result_wl}<ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className={`text-xs font-bold ${p.result_wl === "W" ? "text-green-500" : "text-destructive"}`}>{p.result_wl}</span>
                          )
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[hsl(var(--nba-yellow))]">{p.fp}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{p.salary}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{p.value.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.mp}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.pts}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.ast}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.reb}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.blk}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.stl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly breakdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Weekly Breakdown</h2>
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                <th className={`${thClass("gw")} text-left`} onClick={() => toggleSort("gw")}>Week</th>
                <th className={`${thClass("total_fp")} text-right`} onClick={() => toggleSort("total_fp")}>Total FP</th>
                <th className={`${thClass("best")} text-left`} onClick={() => toggleSort("best")}>Best Player</th>
                <th className={`${thClass("worst")} text-left`} onClick={() => toggleSort("worst")}>Worst Player</th>
                <th className={`${thClass("captain_bonus")} text-right`} onClick={() => toggleSort("captain_bonus")}>Cpt Bonus</th>
              </tr>
            </thead>
            <tbody>
              {sortedWeeks.map((w: any) => (
                <tr key={w.gw} className={`border-b border-border/50 transition-colors ${w.gw === currentGw ? "bg-[hsl(var(--nba-yellow))]/10 font-bold" : "hover:bg-muted/30"}`}>
                  <td className="px-4 py-2 font-heading font-bold">
                    W{w.gw}
                    {w.gw === currentGw && <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0">CURRENT</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{w.total_fp.toFixed(1)}</td>
                  <td className="px-4 py-2">
                    {w.best_player && (
                      <div className="flex items-center gap-1.5 text-green-500 cursor-pointer hover:underline" onClick={() => onPlayerModal(w.best_player.player_id)}>
                        <PlayerPhoto photo={w.best_player.photo ?? null} name={w.best_player.name} />
                        <span>{w.best_player.name}</span>
                        <span className="text-muted-foreground font-mono">({w.best_player.fp})</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {w.worst_player && (
                      <div className="flex items-center gap-1.5 text-destructive cursor-pointer hover:underline" onClick={() => onPlayerModal(w.worst_player.player_id)}>
                        <PlayerPhoto photo={w.worst_player.photo ?? null} name={w.worst_player.name} />
                        <span>{w.worst_player.name}</span>
                        <span className="text-muted-foreground font-mono">({w.worst_player.fp})</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{w.captain_bonus}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-card">
              <tr className="bg-muted/50 font-bold border-t border-border">
                <td className="px-4 py-2 font-heading">TOTAL</td>
                <td className="px-4 py-2 text-right font-mono text-[hsl(var(--nba-yellow))]">{seasonTotal.toFixed(1)}</td>
                <td className="px-4 py-2" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
