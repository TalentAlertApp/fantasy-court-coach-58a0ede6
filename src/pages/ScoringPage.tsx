import { useState, useRef, useMemo, useEffect } from "react";
import { Trophy, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Crown, Flame, Medal, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, Shield, Activity, Repeat, TrendingUp, TrendingDown, X, UserPlus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useScoringHistory, type ScoringGameDay } from "@/hooks/useScoringHistory";
import { useLeagueStandings } from "@/hooks/useLeagueStandings";
import { useTransactionsPulse, type PulseRow } from "@/hooks/useTransactionsPulse";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { isMainLeague } from "@/hooks/useFantasyLeagues";
import { useLeague } from "@/contexts/LeagueContext";
import { getTeamLogo } from "@/lib/nba-teams";
import TeamModal from "@/components/TeamModal";
import PlayerModal from "@/components/PlayerModal";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import BallersIQRecapBlock from "@/components/ballers-iq/BallersIQRecapBlock";
import { getBallersIQInsights } from "@/lib/ballers-iq";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import {
  normalizePlayerHealth,
  isHealthUnavailable,
  isHealthRisky,
  getHealthLabel,
  type PlayerHealth,
} from "@/lib/health";
import { HealthStatusIcon } from "@/components/health";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import AICoachModal from "@/components/AICoachModal";
import LeagueLogoBadge from "@/components/LeagueLogoBadge";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type SortCol = "gw" | "total_fp" | "best" | "worst" | "captain_bonus";
type SortDir = "asc" | "desc";
type TabValue = "league" | "team" | "pulse";

const TAB_LS_KEY = "nba_scoring_tab";

export default function ScoringPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teams: userTeams, teamsInSelectedLeague, selectedTeamId, setSelectedTeamId, isReady: teamReady } = useTeam();
  const { fantasyLeagues, selectedLeague, selectedLeagueId, setSelectedLeagueId } = useFantasyLeague();
  const { league: activeLeagueCode } = useLeague();
  const selectedTeam = userTeams.find((t: any) => t.id === selectedTeamId) ?? null;
  const headerLogo = getLeagueLogo(activeLeagueCode);

  const [tab, setTab] = useState<TabValue>(() => {
    if (typeof window === "undefined") return "league";
    return (localStorage.getItem(TAB_LS_KEY) as TabValue) || "league";
  });
  useEffect(() => { try { localStorage.setItem(TAB_LS_KEY, tab); } catch {} }, [tab]);

  const standingsQuery = useLeagueStandings(selectedLeagueId);
  const historyQuery = useScoringHistory(selectedLeagueId);
  const queryClient = useQueryClient();
  const [attaching, setAttaching] = useState(false);

  // Find a same-sport team the user owns elsewhere (to offer "Attach to league")
  const sameSportOtherTeam = useMemo(() => {
    const sport = selectedLeague?.sport ?? "nba";
    return (userTeams ?? []).find((t: any) => (t.league_code ?? "nba") === sport) ?? null;
  }, [userTeams, selectedLeague?.sport]);

  async function attachExistingTeam(teamId: string) {
    if (!selectedLeagueId) return;
    setAttaching(true);
    try {
      const { data, error } = await supabase.functions.invoke("leagues-manage/attach-team", {
        body: { league_id: selectedLeagueId, team_id: teamId },
      });
      const env = data as { ok?: boolean; data?: any; error?: { message?: string } } | null;
      if (error || !env?.ok) throw new Error(env?.error?.message ?? error?.message ?? "Failed to attach team");
      toast.success(`Team added to ${selectedLeague?.name ?? "league"}`);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["league-standings"] });
      await queryClient.invalidateQueries({ queryKey: ["scoring-history"] });
      if (env.data?.team_id) setSelectedTeamId(env.data.team_id);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not attach team");
    } finally {
      setAttaching(false);
    }
  }
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [teamModalTeam, setTeamModalTeam] = useState<string | null>(null);
  const [playerModalId, setPlayerModalId] = useState<number | null>(null);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const rosterRef = useRef<HTMLDivElement>(null);
  const [sortCol, setSortCol] = useState<SortCol>("gw");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Scope team selector to teams in the currently-selected fantasy league.
  const myTeams = teamsInSelectedLeague;

  // Auto-switch to the "team" tab once the user gains a team in this league
  // (e.g. after returning from onboarding via the empty-state CTA). Guarded
  // so we do this only once per league change, never fighting the user's
  // subsequent tab clicks.
  const lastAutoSwitchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!teamReady) return;
    const key = `${selectedLeagueId}`;
    if (myTeams.length > 0 && lastAutoSwitchRef.current !== key && tab !== "team") {
      lastAutoSwitchRef.current = key;
      setTab("team");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamReady, myTeams.length, selectedLeagueId]);

  // When the selected league changes, ensure the selectedTeamId belongs to it.
  useEffect(() => {
    if (!teamReady) return;
    if (myTeams.length === 0) return;
    if (!selectedTeamId || !myTeams.some((t: any) => t.id === selectedTeamId)) {
      setSelectedTeamId(myTeams[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId, myTeams.length, teamReady]);

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto flex flex-col h-full min-h-0">
      {/* Header — premium NBA bar with court-line gradient */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-card via-card/80 to-card px-5 py-4">
        <img
          src={headerLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 h-28 w-auto opacity-[0.10] rotate-12 select-none blur-[0.5px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 0% 50%, hsl(var(--nba-yellow) / 0.18), transparent 40%), radial-gradient(circle at 100% 50%, hsl(var(--primary) / 0.18), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Activity aria-hidden className="h-7 w-7 text-[hsl(var(--nba-yellow))] shrink-0" />
          <div>
            <h1 className="text-2xl font-heading font-black uppercase tracking-wider leading-none">Scoring</h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-heading mt-1">
              League standings · Team performance
            </p>
          </div>
        </div>
      </div>

      {/* League selector */}
      <FantasyLeagueSelector
        leagues={fantasyLeagues}
        selectedLeague={selectedLeague}
        onSelect={setSelectedLeagueId}
        teamCounts={Object.fromEntries(
          (fantasyLeagues ?? []).map((l) => [
            l.id,
            // Sport-aware count to match the sidebar team switcher and the
            // server-side standings filter. Custom leagues match by league_id;
            // system Main Leagues match by sport (since teams attached to a
            // single sport may carry the sport's league_id rather than the
            // fantasy main-league pseudo id).
            isMainLeague(l.id)
              ? userTeams.filter((t: any) => (t.league_code ?? "nba") === l.sport).length
              : userTeams.filter((t: any) => t.league_id === l.id).length,
          ]),
        )}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="flex-1 min-h-0 flex flex-col">
        {/* Tab bar + (when on Your Team) inline team selector at far right */}
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList className="grid grid-cols-3 w-full max-w-xl bg-card border border-border h-10 p-1 rounded-xl">
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
            <TabsTrigger
              value="pulse"
              className="font-heading uppercase text-xs tracking-wider gap-2 rounded-lg data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-400 data-[state=active]:shadow-none"
            >
              <Repeat className="h-3.5 w-3.5" /> Tx Pulse
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
                  {myTeams.map((t: any) => {
                    const code = t.league_code === "wnba" ? "wnba" : "nba";
                    const lgLogo = getLeagueLogo(code);
                    return (
                      <SelectItem key={t.id} value={t.id} className="font-heading text-xs uppercase">
                        <span className="relative flex items-center pr-7 min-w-[180px]">
                          <span className="truncate">{t.name}</span>
                          <img
                            src={lgLogo}
                            alt=""
                            aria-hidden
                            className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 h-7 w-7 object-contain opacity-25 rotate-12 select-none"
                          />
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ════════════════════════ LEAGUE TAB ════════════════════════ */}
        <TabsContent value="league" className="space-y-5 mt-5 flex-1 min-h-0 flex flex-col data-[state=inactive]:hidden">
          <LeagueView
            data={standingsQuery.data}
            isLoading={standingsQuery.isLoading}
            isError={standingsQuery.isError}
            refetch={standingsQuery.refetch}
            currentUserId={user?.id ?? null}
            selectedTeamId={selectedTeamId}
            leagueName={selectedLeague?.name ?? null}
            onSelectMyTeam={(teamId) => {
              setSelectedTeamId(teamId);
              setTab("team");
            }}
          />
        </TabsContent>

        {/* ════════════════════════ YOUR TEAM TAB ════════════════════════ */}
        <TabsContent value="team" className="space-y-5 mt-5 flex-1 min-h-0 overflow-auto">
          {!teamReady ? (
            <div className="h-64 rounded-xl bg-card border border-border animate-pulse" />
          ) : myTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card border border-border rounded-xl">
              <Shield className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground font-heading">
                You don't have a team in {selectedLeague?.name ?? "this league"} yet.
              </p>
              <div className="flex flex-col items-center gap-2">
                {sameSportOtherTeam && (
                  <Button
                    onClick={() => attachExistingTeam(sameSportOtherTeam.id)}
                    disabled={attaching}
                    size="sm"
                    className="rounded-xl"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add "{sameSportOtherTeam.name}" to {selectedLeague?.name ?? "this league"}
                  </Button>
                )}
                <Button
                  onClick={() => navigate("/welcome", { state: { leagueId: selectedLeagueId, sport: selectedLeague?.sport ?? "nba", returnTo: "/scoring" } })}
                  size="sm"
                  variant={sameSportOtherTeam ? "outline" : "default"}
                  className="rounded-xl"
                >
                  Create a new team in {selectedLeague?.sport === "wnba" ? "WNBA" : "NBA"}
                </Button>
              </div>
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
              onOpenAICoach={() => setAiCoachOpen(true)}
            />
          )}
        </TabsContent>

        {/* ════════════════════════ TRANSACTIONS PULSE TAB ════════════════════════ */}
        <TabsContent value="pulse" className="space-y-5 mt-5 flex-1 min-h-0 overflow-auto">
          <TransactionsPulseView
            onPlayerModal={setPlayerModalId}
            onTeamModal={setTeamModalTeam}
          />
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
      <AICoachModal open={aiCoachOpen} onOpenChange={setAiCoachOpen} />
    </div>
  );
}

// ══════════════════════════════ BALLERS.IQ RECAP BLOCK ══════════════════════════════
function ScoringRecapBlock({ selectedDay }: { selectedDay: any }) {
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const all = playersData?.items ?? [];

  const dayPlayerIds: number[] = (selectedDay?.players ?? []).map((p: any) => p.player_id);
  if (!dayPlayerIds.length) return null;

  const captainId: number | null = (selectedDay?.players ?? []).find((p: any) => p.is_captain)?.player_id ?? null;

  const players = all
    .filter((p: any) => dayPlayerIds.includes(p.core.id))
    .map((p: any) => ({
      id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc,
      salary: p.core.salary,
      fp_pg5: p.last5?.fp5, fp_pg_t: p.season?.fp,
      value5: p.last5?.value5,
      mpg: p.season?.mpg, mpg5: p.last5?.mpg5,
      stl5: p.last5?.stl5, blk5: p.last5?.blk5, ast5: p.last5?.ast5,
      delta_fp: p.last5?.delta_fp, delta_mpg: p.last5?.delta_mpg,
      injury: p.core?.injury,
    }));
  if (!players.length) return null;

  const roster = (selectedDay?.players ?? []).map((p: any, i: number) => ({
    player_id: p.player_id,
    slot: p.is_starter ? `S${i + 1}` : `B${i + 1}`,
    is_captain: p.player_id === captainId,
  }));

  const dayPlayers = (selectedDay?.players ?? []).map((p: any) => ({
    player_id: p.player_id,
    fp: p.fp,
    mp: p.mp,
    salary: p.salary,
    is_starter: p.is_starter,
    is_captain: p.player_id === captainId,
    captain_bonus: p.player_id === captainId ? Number(p.fp) || 0 : 0,
    result_wl: p.result_wl,
    opp: p.opp,
  }));

  const recap = { total_fp: selectedDay?.total_fp ?? 0, dayPlayers };
  const data = getBallersIQInsights("recap", { players, roster, recap });
  if (!data.insights.length && !data.summary) return null;
  return <BallersIQRecapBlock data={data} pageSize={3} />;
}

type StandSortKey = "rank" | "total_fp" | "current_week_fp" | "latest_day_fp";

// ══════════════════════════════ LEAGUE VIEW ══════════════════════════════
function LeagueView({
  data, isLoading, isError, refetch, currentUserId, selectedTeamId, onSelectMyTeam, leagueName,
}: {
  data: ReturnType<typeof useLeagueStandings>["data"];
  isLoading: boolean; isError: boolean; refetch: () => void;
  currentUserId: string | null; selectedTeamId: string | null;
  onSelectMyTeam: (teamId: string) => void;
  leagueName: string | null;
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
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
          sub={`In ${leagueName ?? "this league"}`}
        />
      </div>

      {/* Standings table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/60 via-muted/30 to-transparent flex items-center justify-between gap-3 flex-wrap shrink-0">
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
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground [&>th]:bg-card [&>th]:border-b [&>th]:border-border">
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
  onTeamModal, onPlayerModal, onOpenAICoach,
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

  // Health lookup for subtle DNP / availability context (no scoring change).
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const healthByPlayerId = useMemo(() => {
    const map = new Map<number, PlayerHealth>();
    for (const p of (playersData?.items ?? []) as any[]) {
      const h = normalizePlayerHealth(p?.core);
      if (h.status) map.set(p.core.id, h);
    }
    return map;
  }, [playersData]);

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

  const [recapOpen, setRecapOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Build a roster-of-the-season (unique players who appeared on any game day) for the picker.
  const allPlayersInRoster = useMemo(() => {
    const map = new Map<number, { id: number; name: string; team: string; photo: string | null; fc_bc: "FC" | "BC" }>();
    for (const gd of game_days as ScoringGameDay[]) {
      for (const p of gd.players ?? []) {
        if (!map.has(p.player_id)) {
          map.set(p.player_id, { id: p.player_id, name: p.name, team: p.team, photo: p.photo, fc_bc: p.fc_bc });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [game_days]);

  // Per-day FP map keyed by `playerKey_<id>` so we can layer extra Lines on the chart.
  const enrichedTimeline = useMemo(() => {
    return (game_days as ScoringGameDay[]).map((gd, i) => {
      const row: any = {
        label: `W${gd.gw}D${gd.day}`,
        fp: gd.total_fp,
        index: i,
        hasTxn: txnDates.has(gd.game_date),
      };
      for (const pid of selectedPlayerIds) {
        const p = (gd.players ?? []).find((pl) => pl.player_id === pid);
        row[`p_${pid}`] = p ? p.fp : null;
      }
      return row;
    });
  }, [game_days, selectedPlayerIds, txnDates]);

  // Stable color palette (HSL) for player overlays.
  const PLAYER_COLORS = [
    "hsl(0 84% 60%)", "hsl(142 76% 45%)", "hsl(220 90% 60%)", "hsl(280 75% 60%)",
    "hsl(25 95% 55%)", "hsl(180 70% 45%)", "hsl(330 80% 60%)", "hsl(50 95% 50%)",
    "hsl(160 70% 45%)", "hsl(200 85% 55%)",
  ];

  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
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

      {/* Ballers.IQ Recap Story — compact, inline, above the timeline */}
      {/* Timeline */}
      <div className="relative bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">FP Timeline</h2>

          {/* Roster picker (multi-select, max 10) */}
          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
            {selectedPlayerIds.map((pid, i) => {
              const p = allPlayersInRoster.find((pp) => pp.id === pid);
              if (!p) return null;
              return (
                <span
                  key={pid}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 pl-1 pr-1.5 py-0.5 text-[10px] font-heading uppercase"
                  style={{ borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                >
                  <PlayerPhoto photo={p.photo} name={p.name} />
                  <span className="font-bold">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => togglePlayer(pid)}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    aria-label={`Remove ${p.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={selectedPlayerIds.length >= 10}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-dashed border-border/60 hover:border-primary/60 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  title={selectedPlayerIds.length >= 10 ? "Maximum 10 players" : "Add player to chart"}
                >
                  <UserPlus className="h-3 w-3" />
                  Players ({selectedPlayerIds.length}/10)
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-3" align="end">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground">FP Timeline · Players</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{selectedPlayerIds.length}/10</div>
                </div>
                <div
                  className="space-y-1"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {allPlayersInRoster.map((p) => {
                    const checked = selectedPlayerIds.includes(p.id);
                    const disabled = !checked && selectedPlayerIds.length >= 10;
                    const teamLogo = getTeamLogo(p.team);
                    const ringColor = checked ? "hsl(142 76% 45%)" : "hsl(var(--border))";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => togglePlayer(p.id)}
                        className={`relative w-full overflow-hidden flex items-center gap-2 rounded-lg border bg-card/70 px-2 py-1 text-left transition-all ${
                          checked
                            ? "border-emerald-500/60 bg-emerald-500/[0.06] shadow-[0_4px_16px_-8px_hsl(142_76%_45%/0.5)]"
                            : "border-border/50 hover:border-primary/40 hover:bg-accent/30"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div
                          className="shrink-0 rounded-full p-[1px] transition-all"
                          style={{ background: ringColor }}
                        >
                          {p.photo ? (
                            <img src={p.photo} alt={p.name} className="w-7 h-7 rounded-full object-cover object-top bg-background" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                              {p.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                          <div className="text-xs font-heading font-bold uppercase truncate">{p.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">{p.team}</span>
                            <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 rounded h-3.5">
                              {p.fc_bc}
                            </Badge>
                          </div>
                        </div>
                        {teamLogo && (
                          <img
                            src={teamLogo}
                            alt=""
                            aria-hidden
                            className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 h-10 w-10 object-contain opacity-[0.22] rotate-12 blur-[0.5px] select-none"
                          />
                        )}
                      </button>
                    );
                  })}
                  {allPlayersInRoster.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">No players</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <button
            type="button"
            onClick={() => setRecapOpen((v) => !v)}
            aria-pressed={recapOpen}
            title="Toggle Ballers.IQ Recap"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border transition-colors text-[10px] font-heading uppercase tracking-[0.18em] ${recapOpen ? "border-amber-400/70 text-foreground bg-amber-400/10" : "border-amber-400/30 text-muted-foreground hover:text-foreground hover:border-amber-400/70"}`}
          >
            <BallersIQBrand variant="emblem" forceTheme="light" transparent className="dark:hidden h-3.5 w-3.5" />
            <BallersIQBrand variant="emblem" forceTheme="dark" transparent className="hidden dark:block h-3.5 w-3.5" />
            Ballers.IQ
          </button>
        </div>
        <div className="relative px-4 py-4 h-52">
          {recapOpen && selectedDay && (
            <div className="absolute inset-x-2 top-2 z-20">
              <div className="relative rounded-2xl bg-card shadow-2xl">
                <button
                  type="button"
                  onClick={() => setRecapOpen(false)}
                  aria-label="Close recap"
                  className="absolute -top-1 -right-1 z-30 h-6 w-6 inline-flex items-center justify-center rounded-full border border-amber-400/40 bg-card/90 text-muted-foreground hover:text-foreground hover:border-amber-400/70 backdrop-blur-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <ScoringRecapBlock selectedDay={selectedDay} />
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={enrichedTimeline}>
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
              {selectedPlayerIds.map((pid, i) => {
                const p = allPlayersInRoster.find((pp) => pp.id === pid);
                const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
                return (
                  <Line
                    key={pid}
                    type="monotone"
                    dataKey={`p_${pid}`}
                    name={p?.name ?? `#${pid}`}
                    stroke={color}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: color }}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                );
              })}
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
        <>
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
                  const h = healthByPlayerId.get(p.player_id) ?? null;
                  const fpNum = Number(p.fp) || 0;
                  const mpNum = Number(p.mp) || 0;
                  const isDNP = fpNum === 0 && mpNum === 0;
                  const dnpNote =
                    isDNP && h
                      ? isHealthUnavailable(h)
                        ? `DNP — OUT${h.injury_type ? ` (${h.injury_type})` : ""}`
                        : isHealthRisky(h)
                        ? `DNP — Injury report (${getHealthLabel(h)})`
                        : null
                      : null;
                  const rowTint = isDNP && h && isHealthUnavailable(h)
                    ? "bg-red-500/[0.04]"
                    : isDNP && h && isHealthRisky(h)
                    ? "bg-amber-400/[0.04]"
                    : "";
                  return (
                    <tr key={p.player_id} className={`border-b border-border/30 hover:bg-muted/30 transition-colors group ${rowTint}`}>
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
                          <div className="flex flex-col min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-sm font-heading font-bold cursor-pointer hover:underline" onClick={() => onPlayerModal(p.player_id)}>{p.name}</span>
                              {h && <HealthStatusIcon health={h} size="xs" title={`${getHealthLabel(h)}${h.injury_type ? ` — ${h.injury_type}` : ""}`} />}
                            </span>
                            {dnpNote && (
                              <span
                                className={`text-[9px] font-heading uppercase tracking-wider ${
                                  isHealthUnavailable(h) ? "text-red-500/90" : "text-amber-400/90"
                                }`}
                                title={getHealthLabel(h)}
                              >
                                {dnpNote}
                              </span>
                            )}
                          </div>
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
        </>
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

// ══════════════════════════════ TRANSACTIONS PULSE VIEW ══════════════════════════════
function TransactionsPulseView({
  onPlayerModal,
  onTeamModal,
}: {
  onPlayerModal: (id: number) => void;
  onTeamModal: (tricode: string) => void;
}) {
  const { data, isLoading, isError, refetch } = useTransactionsPulse();

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse font-heading">Loading transactions…</div>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Repeat className="h-12 w-12 text-destructive/40" />
        <p className="text-destructive font-heading">Couldn't load transaction pulse</p>
        <Button onClick={() => refetch()} size="sm" className="rounded-xl"><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
      </div>
    );
  }

  const picked = data?.picked ?? [];
  const waived = data?.waived ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PulseTable
        title="Most Picked"
        subtitle="Across all fantasy users"
        icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
        accent="text-emerald-400"
        rows={picked}
        countLabel="PICKS"
        emptyLabel="No pickups recorded yet"
        onPlayerModal={onPlayerModal}
        onTeamModal={onTeamModal}
      />
      <PulseTable
        title="Most Waived"
        subtitle="Across all fantasy users"
        icon={<TrendingDown className="h-4 w-4 text-destructive" />}
        accent="text-destructive"
        rows={waived}
        countLabel="DROPS"
        emptyLabel="No drops recorded yet"
        onPlayerModal={onPlayerModal}
        onTeamModal={onTeamModal}
      />
    </div>
  );
}

function PulseTable({
  title, subtitle, icon, accent, rows, countLabel, emptyLabel, onPlayerModal, onTeamModal,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  rows: PulseRow[];
  countLabel: string;
  emptyLabel: string;
  onPlayerModal: (id: number) => void;
  onTeamModal: (tricode: string) => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-muted/60 via-muted/40 to-transparent border-b border-border">
        {icon}
        <span className="text-xs font-heading font-bold uppercase tracking-wider truncate">{title}</span>
        <span className="text-[10px] text-muted-foreground ml-auto truncate font-heading uppercase tracking-wider">{subtitle}</span>
      </div>
      <div className="max-h-[560px] overflow-y-auto divide-y divide-border/40">
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}
        {rows.map((r, i) => {
          const logo = getTeamLogo(r.team);
          const isFc = r.fc_bc === "FC";
          return (
            <div
              key={r.player_id}
              className="relative overflow-hidden flex items-center gap-2.5 px-3 py-2 hover:bg-accent/30 transition-colors group"
            >
              {logo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTeamModal(r.team); }}
                  aria-label={r.team}
                  className="pointer-events-auto absolute -top-4 -right-4 w-20 h-20 z-0 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity rotate-12"
                  tabIndex={-1}
                >
                  <img src={logo} alt="" className="w-full h-full object-contain select-none" draggable={false} />
                </button>
              )}
              <span className="relative z-10 text-[10px] font-mono font-bold text-muted-foreground w-5 shrink-0 tabular-nums text-right">{i + 1}</span>
              <div className="relative z-10 shrink-0">
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-9 h-9 rounded-full object-cover bg-muted ring-1 ring-border" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted ring-1 ring-border" />
                )}
              </div>
              <div className="relative z-10 flex items-center gap-1.5 min-w-0 flex-1">
                <Badge
                  variant={isFc ? "destructive" : "default"}
                  className="text-[8px] px-1 py-0 rounded font-heading shrink-0 min-w-[20px] justify-center"
                >
                  {r.fc_bc}
                </Badge>
                <button
                  className="truncate text-sm font-semibold hover:text-primary hover:underline text-left"
                  onClick={() => onPlayerModal(r.player_id)}
                >
                  {r.name}
                </button>
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center min-w-[56px] px-2 py-1 rounded-md bg-muted/40 border border-border/50 shrink-0">
                <span className="text-[8px] font-heading uppercase tracking-wider text-muted-foreground leading-none">{countLabel}</span>
                <span className={`font-mono tabular-nums text-[14px] leading-tight mt-0.5 font-bold ${accent}`}>{r.count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════ FANTASY LEAGUE SELECTOR ══════════════════════════════
function FantasyLeagueSelector({
  leagues,
  selectedLeague,
  onSelect,
  teamCounts,
}: {
  leagues: Array<{ id: string; name: string; sport: "nba" | "wnba" | "euroleague" }>;
  selectedLeague: { id: string; name: string; sport: "nba" | "wnba" | "euroleague" } | null;
  onSelect: (id: string) => void;
  teamCounts: Record<string, number>;
}) {
  if (!selectedLeague) return null;
  const logoFor = (sport: "nba" | "wnba" | "euroleague") => (getLeagueLogo(sport));
  const onlyOne = leagues.length <= 1;

  if (onlyOne) {
    return (
      <div className="flex items-center gap-2 px-1">
        <img src={logoFor(selectedLeague.sport)} alt="" className="h-5 w-5 object-contain" />
        <span className="font-heading uppercase text-xs tracking-[0.2em] text-foreground/80">
          {selectedLeague.name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <Select value={selectedLeague.id} onValueChange={onSelect}>
        <SelectTrigger className="h-9 w-auto min-w-[220px] rounded-lg bg-card border-border font-heading text-xs uppercase tracking-[0.15em]">
          <SelectValue>
            <span className="flex items-center gap-2">
              <img src={logoFor(selectedLeague.sport)} alt="" className="h-4 w-4 object-contain" />
              <span className="truncate">{selectedLeague.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {leagues.map((l) => (
            <SelectItem key={l.id} value={l.id} className="font-heading text-xs uppercase">
              <span className="flex items-center gap-2 pr-2">
                <img src={logoFor(l.sport)} alt="" className="h-4 w-4 object-contain" />
                <span className="truncate">{l.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tracking-[0.15em]">
                  {teamCounts[l.id] ?? 0} {teamCounts[l.id] === 1 ? "team" : "teams"}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
