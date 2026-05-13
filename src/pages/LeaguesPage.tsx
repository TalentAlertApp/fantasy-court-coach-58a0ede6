import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Plus, KeyRound, Crown, Sparkles, Settings as SettingsIcon, UserPlus, Users, Loader2, AlertCircle, CheckCircle2, Search, Globe } from "lucide-react";
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
import { MAIN_LEAGUE_ID } from "@/hooks/useFantasyLeagues";
import { usePublicLeagues, type PublicLeague } from "@/hooks/usePublicLeagues";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

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
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card/90 to-card p-5 hover:border-accent/40 transition-colors">
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-auto opacity-[0.08] rotate-12 select-none blur-[0.5px]"
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

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={onOpen} className="font-heading uppercase tracking-wider text-[10px]">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Open
          </Button>
          <Button size="sm" variant="secondary" onClick={onCreateTeam} className="font-heading uppercase tracking-wider text-[10px]">
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Create Team
          </Button>
          {isMine && !isMain && (
            <Button size="sm" variant="outline" onClick={onSettings} className="font-heading uppercase tracking-wider text-[10px]">
              <SettingsIcon className="h-3.5 w-3.5 mr-1" /> Settings
            </Button>
          )}
        </div>
      </div>
    </div>
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
    const main = fantasyLeagues.find((l) => l.id === MAIN_LEAGUE_ID);
    const rest = fantasyLeagues
      .filter((l) => l.id !== MAIN_LEAGUE_ID)
      .sort((a, b) => a.name.localeCompare(b.name));
    return main ? [main, ...rest] : rest;
  }, [fantasyLeagues]);

  const myCustom = sortedLeagues.filter((l) => l.id !== MAIN_LEAGUE_ID);

  const handleOpen = (id: string) => {
    setSelectedLeagueId(id);
    navigate("/scoring");
  };
  const handleCreateTeam = (id: string) => {
    navigate("/welcome", { state: { leagueId: id } });
  };
  const handleSettings = (id: string) => navigate(`/leagues/${id}/settings`);

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-card via-card/80 to-card px-5 py-4">
        <Trophy
          aria-hidden
          className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-24 w-24 opacity-[0.08] rotate-12 select-none text-accent"
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold uppercase tracking-wider">My Leagues</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] font-heading mt-1">
              Fantasy competitions
            </p>
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

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading leagues…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedLeagues.map((l) => (
              <LeagueCard
                key={l.id}
                league={l}
                isMain={l.id === MAIN_LEAGUE_ID}
                isMine={!!user && l.owner_id === user.id}
                onOpen={() => handleOpen(l.id)}
                onCreateTeam={() => handleCreateTeam(l.id)}
                onSettings={() => handleSettings(l.id)}
              />
            ))}
          </div>

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
    </div>
  );
}