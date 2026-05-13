import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Plus, KeyRound, Crown, LayoutDashboard, Settings as SettingsIcon, UserPlus, Users, Loader2, AlertCircle, CheckCircle2, Search, Globe, LayoutGrid, List as ListIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { FantasyLeague, ScoringRule } from "@/hooks/useFantasyLeagues";
import { MAIN_LEAGUE_ID, MAIN_LEAGUE_NBA_ID, MAIN_LEAGUE_WNBA_ID, isMainLeague } from "@/hooks/useFantasyLeagues";
import { usePublicLeagues, type PublicLeague } from "@/hooks/usePublicLeagues";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import courtBg from "@/assets/court-bg.png";

function formulaString(rules: ScoringRule[]): string {
  const parts = rules
    .filter((r) => r.is_active && r.applies_to === "player" && r.rule_type === "multiplier")
    .sort((a, b) => Number(a.weight) - Number(b.weight))
    .map((r) => `${r.stat_key.toUpperCase()}×${r.weight}`);
  return parts.length ? parts.join(" ") : "—";
}

function deadlineLabel(t?: string | null): string {
  switch (t) {
    case "first_game_of_day": return "First game of day";
    case "per_player_game_lock": return "Per-player game lock";
    case "fixed_weekly": return "Fixed weekly";
    case "manual": return "Manual";
    default: return "—";
  }
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    status === "draft"  ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                          "bg-muted/40 text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-heading uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  );
}

function LeagueCard({ league, isMine, isMain, onOpen, onCreateTeam, onSettings }: {
  league: FantasyLeague;
  isMine: boolean;
  isMain: boolean;
  onOpen: () => void;
  onCreateTeam: () => void;
  onSettings: () => void;
}) {
  const logo = league.sport === "wnba" ? wnbaLogo : nbaLogo;
  const chips = league.chipRules;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-accent/40 transition-colors">
      <img
        src={courtBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.10] select-none"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-card/95 via-card/85 to-card/95"
      />
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-auto opacity-[0.12] rotate-12 select-none blur-[0.5px]"
      />
      {isMine && !isMain && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-heading uppercase tracking-[0.18em] text-accent">
          <Crown className="h-3 w-3" /> Commissioner
        </span>
      )}
      {isMain && (
        <span className="absolute top-3 right-3 inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
          Main · System
        </span>
      )}

      <div className="relative z-10 space-y-3">
        <div>
          <h3 className="text-lg font-heading font-bold uppercase tracking-wider">{league.name}</h3>
          {league.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{league.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-heading uppercase tracking-wider text-[9px] gap-1">
            <Users className="h-3 w-3" /> {league.memberCount} teams · {league.myTeamCount} mine
          </Badge>
          <StatusPill status={league.status} />
          <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
            {league.sport}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Scoring</div>
          <div className="text-xs font-mono text-foreground/90 truncate">{formulaString(league.scoringRules)}</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Deadline</div>
          <span className="inline-flex items-center rounded-md border border-border bg-background/40 px-2 py-0.5 text-[10px]">
            {deadlineLabel(league.deadlineRules?.deadline_type)}
          </span>
        </div>

        {chips && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Chips</div>
            <div className="flex flex-wrap gap-1">
              {chips.captain_enabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 text-[10px]">
                  👑 Captain {chips.captain_multiplier}×
                </span>
              )}
              {chips.wildcard_enabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 px-2 py-0.5 text-[10px]">
                  🃏 Wildcard ×{chips.wildcard_count}
                </span>
              )}
              {chips.all_star_enabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 text-[10px]">
                  ⭐ All-Star {chips.all_star_multiplier}×
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <Button size="icon" onClick={onOpen} className="h-8 w-8" aria-label="Open league" title="Open league">
            <LayoutDashboard className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={onCreateTeam} className="h-8 w-8" aria-label="Create team" title="Create team">
            <UserPlus className="h-4 w-4" />
          </Button>
          {isMine && !isMain && league.join_code && (
            <CopyCodeButton code={league.join_code} />
          )}
          {isMine && !isMain && (
            <Button size="icon" variant="outline" onClick={onSettings} className="h-8 w-8" aria-label="Settings" title="Settings">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyCodeButton({ code, compact }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Invite code copied: ${code}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy code");
    }
  }
  const sz = compact ? "h-7 w-7" : "h-8 w-8";
  const ic = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleCopy}
      className={sz}
      aria-label={`Copy invite code ${code}`}
      title={`Copy invite code (${code})`}
    >
      {copied ? <CheckCircle2 className={`${ic} text-emerald-400`} /> : <Copy className={ic} />}
    </Button>
  );
}

export default function LeaguesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fantasyLeagues, setSelectedLeagueId, isLoading } = useFantasyLeague();
  const qc = useQueryClient();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");

  async function handleJoinSubmit() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError(null);
    try {
      const { data, error } = await supabase.functions.invoke("leagues-join", {
        body: { join_code: code },
      });
      let env = data as { ok?: boolean; data?: { league_id: string; league_name: string }; error?: { code?: string; message?: string } } | null;
      if (error) {
        try {
          const ctx = await (error as unknown as { context?: { json?: () => Promise<any> } }).context?.json?.();
          if (ctx) env = ctx;
        } catch { /* noop */ }
      }
      // Treat "already member" as success — surface a friendly toast and switch
      // the user into that league instead of bubbling up an error.
      if (env?.error?.code === "ALREADY_MEMBER") {
        await qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
        toast.success("You're already a member of this league.");
        setJoinOpen(false);
        setJoinCode("");
        return;
      }
      if (!env?.ok || !env.data) {
        setJoinError(env?.error?.message ?? error?.message ?? "Unable to join this league.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      setSelectedLeagueId(env.data.league_id);
      toast.success(`Joined ${env.data.league_name}! Create a team to join the competition.`);
      setJoinOpen(false);
      setJoinCode("");
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Join failed");
    } finally {
      setJoining(false);
    }
  }

  const sortedLeagues = useMemo(() => {
    const nbaMain = fantasyLeagues.find((l) => l.id === MAIN_LEAGUE_NBA_ID);
    const wnbaMain = fantasyLeagues.find((l) => l.id === MAIN_LEAGUE_WNBA_ID);
    const rest = fantasyLeagues
      .filter((l) => !isMainLeague(l.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [nbaMain, wnbaMain, ...rest].filter(Boolean) as typeof fantasyLeagues;
  }, [fantasyLeagues]);

  const myCustom = sortedLeagues.filter((l) => !isMainLeague(l.id));
  const mineCount = sortedLeagues.length;

  const handleOpen = (id: string) => {
    setSelectedLeagueId(id);
    navigate("/scoring");
  };
  const handleCreateTeam = (id: string) => {
    const target = fantasyLeagues.find((l) => l.id === id);
    setSelectedLeagueId(id);
    const sport = target?.sport === "wnba" ? "wnba" : "nba";
    navigate(`/?newTeam=1&sport=${sport}&league_id=${encodeURIComponent(id)}`);
  };
  const handleSettings = (id: string) => navigate(`/leagues/${id}/settings`);

  const myLeagueIds = useMemo(() => new Set(fantasyLeagues.map((l) => l.id)), [fantasyLeagues]);

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-card via-card/80 to-card px-5 py-4">
        <Swords
          aria-hidden
          className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-24 w-24 opacity-[0.08] rotate-12 select-none text-accent"
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Swords aria-hidden className="h-7 w-7 text-accent shrink-0" />
            <div>
            <h1 className="text-2xl font-heading font-bold uppercase tracking-wider">My Leagues</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] font-heading mt-1">
              Fantasy competitions
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={joinOpen} onOpenChange={(v) => { setJoinOpen(v); if (!v) { setJoinError(null); setJoinCode(""); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="font-heading uppercase tracking-wider text-[10px]">
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Join with code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase tracking-wider">Join a League</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="INVITE CODE"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") handleJoinSubmit(); }}
                    className="font-mono uppercase tracking-[0.3em]"
                    maxLength={8}
                    autoFocus
                  />
                  {joinError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{joinError}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter the 8-character invite code shared by the commissioner.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setJoinOpen(false)} disabled={joining}>Cancel</Button>
                  <Button onClick={handleJoinSubmit} disabled={joining || joinCode.trim().length === 0}>
                    {joining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Join
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={() => navigate("/leagues/create")} className="font-heading uppercase tracking-wider text-[10px]">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create League
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="mine" className="w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="mine" className="font-heading uppercase tracking-wider text-[10px]">
              <Swords className="h-3.5 w-3.5 mr-1" /> My Leagues
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent/20 text-accent px-1 text-[9px] font-mono">{mineCount}</span>
            </TabsTrigger>
            <TabsTrigger value="discover" className="font-heading uppercase tracking-wider text-[10px]">
              <Globe className="h-3.5 w-3.5 mr-1" /> Discover
            </TabsTrigger>
          </TabsList>
          <div className="inline-flex items-center rounded-md border border-border bg-card/60 p-0.5">
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
              className="h-7 px-2 font-heading uppercase tracking-wider text-[9px]"
              aria-label="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
              className="h-7 px-2 font-heading uppercase tracking-wider text-[9px]"
              aria-label="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <TabsContent value="mine" className="mt-4">
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading leagues…
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedLeagues.map((l) => (
                <LeagueCard
                  key={l.id}
                  league={l}
                  isMain={isMainLeague(l.id)}
                  isMine={!!user && l.owner_id === user.id}
                  onOpen={() => handleOpen(l.id)}
                  onCreateTeam={() => handleCreateTeam(l.id)}
                  onSettings={() => handleSettings(l.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {sortedLeagues.map((l) => (
                <LeagueListRow
                  key={l.id}
                  league={l}
                  isMain={isMainLeague(l.id)}
                  isMine={!!user && l.owner_id === user.id}
                  onOpen={() => handleOpen(l.id)}
                  onCreateTeam={() => handleCreateTeam(l.id)}
                  onSettings={() => handleSettings(l.id)}
                />
              ))}
            </div>
          )}

          {myCustom.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center space-y-3">
              <h2 className="text-lg font-heading uppercase tracking-wider font-bold">Create your first league</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Set your own scoring, deadlines and chip rules. Invite friends with a join code.
              </p>
              <Button onClick={() => navigate("/leagues/create")} className="font-heading uppercase tracking-wider text-[10px]">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create League
              </Button>
            </div>
          )}
        </>
      )}
        </TabsContent>

        <TabsContent value="discover" className="mt-4">
          <DiscoverPanel
            myLeagueIds={myLeagueIds}
            view={view}
            onOpen={(id) => { setSelectedLeagueId(id); navigate("/scoring"); }}
            onJoined={(id) => { setSelectedLeagueId(id); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DiscoverPanel({
  myLeagueIds,
  view,
  onOpen,
  onJoined,
}: {
  myLeagueIds: Set<string>;
  view: "list" | "cards";
  onOpen: (id: string) => void;
  onJoined: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [sport, setSport] = useState<"all" | "nba" | "wnba">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"active" | "newest" | "most_teams">("active");
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<PublicLeague[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = usePublicLeagues({
    sport: sport === "all" ? null : sport,
    search,
    page,
    sort,
  });

  // reset accumulator on filter change
  useEffect(() => {
    setAccumulated([]);
    setPage(1);
  }, [sport, search, sort]);

  // append items as pages load
  useEffect(() => {
    if (!data?.items) return;
    setAccumulated((prev) => {
      if (page === 1) return data.items;
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...data.items.filter((i) => !ids.has(i.id))];
    });
  }, [data, page]);

  function applySearch() {
    setSearch(searchInput.trim());
  }

  async function handleJoin(league: PublicLeague) {
    if (!league.join_code) {
      toast.error("This league has no join code.");
      return;
    }
    setJoiningId(league.id);
    try {
      const { data: res, error } = await supabase.functions.invoke("leagues-join", {
        body: { join_code: league.join_code },
      });
      let env = res as { ok?: boolean; data?: { league_id: string; league_name: string }; error?: { code?: string; message?: string } } | null;
      if (error) {
        try {
          const ctx = await (error as unknown as { context?: { json?: () => Promise<any> } }).context?.json?.();
          if (ctx) env = ctx;
        } catch { /* noop */ }
      }
      if (env?.error?.code === "ALREADY_MEMBER") {
        await qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
        toast.success("You're already a member of this league.");
        onJoined(league.id);
        return;
      }
      if (!env?.ok || !env.data) {
        toast.error(env?.error?.message ?? "Unable to join.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      toast.success(`Joined ${env.data.league_name}!`);
      onJoined(env.data.league_id);
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3">
        <div className="flex items-center gap-3 pl-1 pr-2">
          {(["all", "nba", "wnba"] as const).map((s) => {
            const active = sport === s;
            const baseCls = "shrink-0 cursor-pointer transition-all duration-200 select-none";
            const dimCls = active ? "opacity-100 scale-110" : "opacity-50 hover:opacity-90 scale-90";
            if (s === "all") {
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
                  aria-label="All sports"
                  title="All sports"
                  className={`${baseCls} ${dimCls} flex items-center justify-center`}
                >
                  <Globe className={`${active ? "h-7 w-7 text-accent" : "h-5 w-5 text-muted-foreground"}`} />
                </button>
              );
            }
            const src = s === "wnba" ? wnbaLogo : nbaLogo;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                aria-label={s.toUpperCase()}
                title={s.toUpperCase()}
                className={`${baseCls} ${dimCls}`}
              >
                <img
                  src={src}
                  alt={s.toUpperCase()}
                  className={`${active ? "h-9" : "h-6"} w-auto object-contain transition-all duration-200`}
                />
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leagues by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
            className="pl-8 h-9"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={applySearch} className="font-heading uppercase tracking-wider text-[10px]">
          Search
        </Button>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active first</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_teams">Most teams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end -mt-1">
        <span className="text-[10px] uppercase tracking-[0.18em] font-heading text-muted-foreground">
          {accumulated.length}{data?.has_more ? "+" : ""} {accumulated.length === 1 ? "league" : "leagues"}
        </span>
      </div>

      {isLoading && accumulated.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading public leagues…
        </div>
      ) : accumulated.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center space-y-2">
          <h2 className="text-base font-heading uppercase tracking-wider font-bold">No public leagues yet</h2>
          <p className="text-sm text-muted-foreground">Create one and set visibility to Public!</p>
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accumulated.map((l) => (
                <PublicLeagueCard
                  key={l.id}
                  league={l}
                  isMember={myLeagueIds.has(l.id)}
                  joining={joiningId === l.id}
                  onJoin={() => handleJoin(l)}
                  onOpen={() => onOpen(l.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {accumulated.map((l) => (
                <PublicLeagueListRow
                  key={l.id}
                  league={l}
                  isMember={myLeagueIds.has(l.id)}
                  joining={joiningId === l.id}
                  onJoin={() => handleJoin(l)}
                  onOpen={() => onOpen(l.id)}
                />
              ))}
            </div>
          )}
          {data?.has_more && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="font-heading uppercase tracking-wider text-[10px]"
              >
                {isFetching ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PublicLeagueCard({
  league, isMember, joining, onJoin, onOpen,
}: {
  league: PublicLeague;
  isMember: boolean;
  joining: boolean;
  onJoin: () => void;
  onOpen: () => void;
}) {
  const logo = league.sport === "wnba" ? wnbaLogo : nbaLogo;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card/90 to-card p-5 hover:border-accent/40 transition-colors">
      <img src={logo} alt="" aria-hidden className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-auto opacity-[0.08] rotate-12 select-none blur-[0.5px]" />
      <div className="relative z-10 space-y-3">
        <div>
          <h3 className="text-lg font-heading font-bold uppercase tracking-wider">{league.name}</h3>
          {league.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{league.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-heading uppercase tracking-wider text-[9px] gap-1">
            <Users className="h-3 w-3" /> {league.team_count} teams
          </Badge>
          <StatusPill status={league.status} />
          <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
            {league.sport}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Scoring</div>
          <div className="text-xs font-mono text-foreground/90 truncate">{league.scoring_formula_short}</div>
        </div>
        {league.deadline_type && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Deadline</div>
            <span className="inline-flex items-center rounded-md border border-border bg-background/40 px-2 py-0.5 text-[10px]">
              {league.deadline_type.replace(/_/g, " ")}
            </span>
          </div>
        )}
        {league.chips_enabled.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Chips</div>
            <div className="flex flex-wrap gap-1">
              {league.chips_enabled.includes("captain") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 text-[10px]">👑 Captain</span>
              )}
              {league.chips_enabled.includes("wildcard") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 px-2 py-0.5 text-[10px]">🃏 Wildcard</span>
              )}
              {league.chips_enabled.includes("all_star") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 text-[10px]">⭐ All-Star</span>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {isMember ? (
            <Button size="sm" onClick={onOpen} className="font-heading uppercase tracking-wider text-[10px]">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Open
            </Button>
          ) : (
            <Button size="sm" onClick={onJoin} disabled={joining} className="font-heading uppercase tracking-wider text-[10px]">
              {joining ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              Join
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LeagueListRow({ league, isMine, isMain, onOpen, onCreateTeam, onSettings }: {
  league: FantasyLeague;
  isMine: boolean;
  isMain: boolean;
  onOpen: () => void;
  onCreateTeam: () => void;
  onSettings: () => void;
}) {
  const logo = league.sport === "wnba" ? wnbaLogo : nbaLogo;
  return (
    <div className="relative overflow-hidden flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 transition-colors">
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-14 w-auto opacity-[0.06] select-none"
      />
      <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
        <img src={logo} alt="" className="h-6 w-6 object-contain shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider truncate">{league.name}</h3>
            {isMine && !isMain && (
              <Crown className="h-3 w-3 text-accent shrink-0" aria-label="Commissioner" />
            )}
            {isMain && (
              <span className="text-[8.5px] font-heading uppercase tracking-[0.18em] text-muted-foreground border border-border rounded-full px-1.5">Main</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-heading uppercase tracking-wider mt-0.5">
            <span>{league.sport}</span>
            <span>·</span>
            <span>{league.memberCount} teams</span>
            <span>·</span>
            <span>{league.myTeamCount} mine</span>
            <StatusPill status={league.status} />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 shrink-0">
        <Button size="sm" onClick={onOpen} className="h-7 font-heading uppercase tracking-wider text-[9px]">
          <Sparkles className="h-3 w-3 mr-1" /> Open
        </Button>
        <Button size="sm" variant="secondary" onClick={onCreateTeam} className="h-7 font-heading uppercase tracking-wider text-[9px]">
          <UserPlus className="h-3 w-3 mr-1" /> Team
        </Button>
        {isMine && !isMain && (
          <Button size="sm" variant="outline" onClick={onSettings} className="h-7 font-heading uppercase tracking-wider text-[9px]" aria-label="Settings">
            <SettingsIcon className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PublicLeagueListRow({ league, isMember, joining, onJoin, onOpen }: {
  league: PublicLeague;
  isMember: boolean;
  joining: boolean;
  onJoin: () => void;
  onOpen: () => void;
}) {
  const logo = league.sport === "wnba" ? wnbaLogo : nbaLogo;
  return (
    <div className="relative overflow-hidden flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 transition-colors">
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-14 w-auto opacity-[0.06] select-none"
      />
      <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
        <img src={logo} alt="" className="h-6 w-6 object-contain shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider truncate">{league.name}</h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-heading uppercase tracking-wider mt-0.5">
            <span>{league.sport}</span>
            <span>·</span>
            <span>{league.team_count} teams</span>
            <StatusPill status={league.status} />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 shrink-0">
        {isMember ? (
          <Button size="sm" onClick={onOpen} className="h-7 font-heading uppercase tracking-wider text-[9px]">
            <Sparkles className="h-3 w-3 mr-1" /> Open
          </Button>
        ) : (
          <Button size="sm" onClick={onJoin} disabled={joining} className="h-7 font-heading uppercase tracking-wider text-[9px]">
            {joining ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <UserPlus className="h-3 w-3 mr-1" />}
            Join
          </Button>
        )}
      </div>
    </div>
  );
}