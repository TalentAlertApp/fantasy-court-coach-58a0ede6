import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useTeam } from "@/contexts/TeamContext";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { saveRoster, autoPickRoster } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PlayerListItemSchema } from "@/lib/contracts";
import { getCurrentGameday, getGamedaysRemaining, formatDeadline } from "@/lib/deadlines";
import RosterCourtView from "@/components/RosterCourtView";
import RosterListView from "@/components/RosterListView";
import RosterSidebar from "@/components/RosterSidebar";
import { useUpcomingByTeam } from "@/hooks/useUpcomingByTeam";

import OptimizeDialog from "@/components/OptimizeDialog";
import PlayerModal from "@/components/PlayerModal";
import PlayerPickerDialog from "@/components/PlayerPickerDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { optimizeLineup, type OptimizerPlayer, type OptimizerResult } from "@/lib/optimizer";
import { LayoutGrid, List, Zap, Clock, RotateCcw, Plus, Star, Sparkles, RefreshCw, Bot, Heart, CalendarDays, X } from "lucide-react";
import AICoachModal from "@/components/AICoachModal";
import WishlistModal from "@/components/WishlistModal";
import DraftPicker from "@/components/onboarding/DraftPicker";
import { SchedulePreviewBody } from "@/components/SchedulePreviewPanel";
import BallersIQPanel from "@/components/ballers-iq/BallersIQPanel";
import BallersIQCard from "@/components/ballers-iq/BallersIQCard";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { getBallersIQInsights } from "@/lib/ballers-iq";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

function useCountdown(deadlineUtc: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadlineUtc) return null;
  const diff = new Date(deadlineUtc).getTime() - now;
  if (diff <= 0) return "LOCKED";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function RosterPage() {
  const queryClient = useQueryClient();
  const { selectedTeamId, teams, isReady: teamReady, isError: teamError } = useTeam();
  const { data: rosterData, isLoading: rosterLoading, isError: rosterIsError, isSuccess: rosterSuccess, refetch: refetchRoster } = useRosterQuery();
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 1000 });
  const { data: upcomingByTeam } = useUpcomingByTeam();

  const [viewMode, setViewMode] = useState<"court" | "list">("court");
  const [captainId, setCaptainId] = useState<number>(0);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<OptimizerResult | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [swapPlayerId, setSwapPlayerId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [chipCaptain, setChipCaptain] = useState(false);
  const [chipAllStar, setChipAllStar] = useState(false);
  const [chipWildcard, setChipWildcard] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const roster = rosterData?.roster;
  const allPlayers = playersData?.items ?? [];
  const teamName = teams.find((t) => t.id === selectedTeamId)?.name ?? "My Team";

  // Safety net: if any roster player_id is not in the loaded players list
  // (e.g. they fall outside the page limit), fetch them directly so the
  // roster never appears partially empty.
  const rosterPlayerIds = useMemo(() => [
    ...(roster?.starters ?? []),
    ...(roster?.bench ?? []),
  ].filter((id) => id > 0), [roster?.starters, roster?.bench]);

  const missingIds = useMemo(() => {
    const known = new Set(allPlayers.map((p) => p.core.id));
    return rosterPlayerIds.filter((id) => !known.has(id));
  }, [allPlayers, rosterPlayerIds]);

  const { data: missingPlayersData } = useQuery({
    queryKey: ["roster-missing-players", missingIds.sort().join(",")],
    enabled: missingIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("players")
        .select("*")
        .in("id", missingIds);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const allPlayersWithFallback = useMemo(() => {
    if (!missingPlayersData || missingPlayersData.length === 0) return allPlayers;
    const extras = missingPlayersData.map((p: any) => ({
      core: {
        id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc,
        photo: p.photo, salary: Number(p.salary) || 0, jersey: p.jersey,
        pos: p.pos, height: p.height, weight: p.weight, age: p.age,
        injury: p.injury, note: p.note,
      },
      season: { gp: p.gp, mpg: p.mpg, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, fp_pg: p.fp_pg_t, value: p.value_t },
      last5: { mpg5: p.mpg5, pts5: p.pts5, reb5: p.reb5, ast5: p.ast5, stl5: p.stl5, blk5: p.blk5, fp5: p.fp_pg5, value5: p.value5, stocks5: p.stocks5, delta_mpg: p.delta_mpg, delta_fp: p.delta_fp },
    }));
    return [...allPlayers, ...extras] as any;
  }, [allPlayers, missingPlayersData]);

  const currentGameday = useMemo(() => getCurrentGameday(), []);
  const gamedaysRemaining = useMemo(() => getGamedaysRemaining(), []);
  const deadlineFormatted = useMemo(() => formatDeadline(currentGameday.deadline_utc), [currentGameday]);
  const countdown = useCountdown(currentGameday.deadline_utc);

  const resolvePlayer = useCallback(
    (id: number) => allPlayersWithFallback.find((p: any) => p.core.id === id),
    [allPlayersWithFallback]
  );

  const starters = useMemo(
    () => (roster?.starters ?? []).map(resolvePlayer).filter(Boolean) as PlayerListItem[],
    [roster?.starters, resolvePlayer]
  );

  const bench = useMemo(
    () => (roster?.bench ?? []).map(resolvePlayer).filter(Boolean) as PlayerListItem[],
    [roster?.bench, resolvePlayer]
  );

  const rosterIds = useMemo(() => new Set([
    ...(roster?.starters ?? []),
    ...(roster?.bench ?? []),
  ].filter((id) => id > 0)), [roster?.starters, roster?.bench]);

  const rosterTeams = useMemo(() => 
    [...starters, ...bench].map((p) => p.core.team),
    [starters, bench]
  );

  const fcStarters = starters.filter((p) => p.core.fc_bc === "FC").length;
  const bcStarters = starters.filter((p) => p.core.fc_bc === "BC").length;
  const totalSalary = [...starters, ...bench].reduce((s, p) => s + p.core.salary, 0);

  useMemo(() => {
    if (captainId === 0 && roster?.captain_id) setCaptainId(roster.captain_id);
  }, [roster?.captain_id, captainId]);

  const saveMutation = useMutation({
    mutationFn: (body: Parameters<typeof saveRoster>[0]) =>
      saveRoster(body, selectedTeamId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Lineup saved!" });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!roster) return;
    const starterIds = [...starters.map((p) => p.core.id), ...Array(Math.max(0, 5 - starters.length)).fill(0)].slice(0, 5);
    const benchIds = [...bench.map((p) => p.core.id), ...Array(Math.max(0, 5 - bench.length)).fill(0)].slice(0, 5);
    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: starterIds,
      bench: benchIds,
      captain_id: captainId || starters[0]?.core.id || 0,
    });
  };

  const handleReset = () => {
    if (!roster) return;
    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: [0, 0, 0, 0, 0],
      bench: [0, 0, 0, 0, 0],
      captain_id: 0,
    });
    setCaptainId(0);
  };

  const handleAddPlayer = () => {
    setSwapPlayerId(null);
    setPickerOpen(true);
  };

  const handleAddSelect = (newPlayer: PlayerListItem) => {
    if (!roster) return;
    const currentStarters = [...(roster.starters ?? [])].filter(id => id > 0);
    const currentBench = [...(roster.bench ?? [])].filter(id => id > 0);
    const totalPlayers = currentStarters.length + currentBench.length;
    if (totalPlayers >= 10) return;

    if (currentStarters.length < 5) {
      currentStarters.push(newPlayer.core.id);
    } else {
      currentBench.push(newPlayer.core.id);
    }

    const starterIds = [...currentStarters, ...Array(Math.max(0, 5 - currentStarters.length)).fill(0)].slice(0, 5);
    const benchIds = [...currentBench, ...Array(Math.max(0, 5 - currentBench.length)).fill(0)].slice(0, 5);

    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: starterIds,
      bench: benchIds,
      captain_id: captainId || currentStarters[0] || 0,
    });
  };

  const handleOptimize = () => {
    const toOpt = (p: PlayerListItem): OptimizerPlayer => ({
      id: p.core.id, name: p.core.name, team: p.core.team,
      fc_bc: p.core.fc_bc, salary: p.core.salary, fp5: p.last5.fp5,
    });
    const result = optimizeLineup(
      starters.map(toOpt), bench.map(toOpt),
      roster?.constraints ?? { salary_cap: 100, starter_fc_min: 2, starter_bc_min: 2 }
    );
    setOptimizerResult(result);
    setOptimizeOpen(true);
  };

  const handleApplyOptimization = () => {
    if (!optimizerResult || !roster) return;
    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: optimizerResult.newStarters,
      bench: optimizerResult.newBench,
      captain_id: captainId,
    });
    setOptimizeOpen(false);
  };

  const handleSwapRequest = (playerId: number) => {
    setSwapPlayerId(playerId);
    setPickerOpen(true);
  };

  // For budget enforcement in picker
  const swapPlayer = swapPlayerId ? allPlayers.find((p) => p.core.id === swapPlayerId) : null;
  const swapPlayerSalary = swapPlayer?.core.salary ?? 0;
  const swapPlayerPosition = swapPlayer?.core.fc_bc ?? null;
  const totalPlayers = starters.length + bench.length;

  const handleSwapSelect = (newPlayer: PlayerListItem) => {
    if (!roster || swapPlayerId === null) return;
    const starterIdx = (roster.starters ?? []).indexOf(swapPlayerId);
    const benchIdx = (roster.bench ?? []).indexOf(swapPlayerId);
    const newStarters = [...(roster.starters ?? [])];
    const newBench = [...(roster.bench ?? [])];

    if (starterIdx >= 0) newStarters[starterIdx] = newPlayer.core.id;
    else if (benchIdx >= 0) newBench[benchIdx] = newPlayer.core.id;

    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: newStarters, bench: newBench,
      captain_id: captainId === swapPlayerId ? newPlayer.core.id : captainId,
    });
    setSwapPlayerId(null);
  };

  const handleDnDSwap = (fromId: number, toId: number) => {
    if (!roster) return;
    const newStarters = [...(roster.starters ?? [])];
    const newBench = [...(roster.bench ?? [])];

    const fromStarterIdx = newStarters.indexOf(fromId);
    const fromBenchIdx = newBench.indexOf(fromId);
    const toStarterIdx = newStarters.indexOf(toId);
    const toBenchIdx = newBench.indexOf(toId);

    if (fromStarterIdx >= 0 && toStarterIdx >= 0) {
      newStarters[fromStarterIdx] = toId;
      newStarters[toStarterIdx] = fromId;
    } else if (fromBenchIdx >= 0 && toBenchIdx >= 0) {
      newBench[fromBenchIdx] = toId;
      newBench[toBenchIdx] = fromId;
    } else if (fromStarterIdx >= 0 && toBenchIdx >= 0) {
      newStarters[fromStarterIdx] = toId;
      newBench[toBenchIdx] = fromId;
    } else if (fromBenchIdx >= 0 && toStarterIdx >= 0) {
      newBench[fromBenchIdx] = toId;
      newStarters[toStarterIdx] = fromId;
    }

    const newCaptain = captainId === fromId ? toId : captainId === toId ? fromId : captainId;

    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: newStarters, bench: newBench,
      captain_id: newCaptain,
    });
  };

  // Query to check if a captain is already set for this GW on another day
  const { data: weeklyCaptainData } = useQuery({
    queryKey: ["weekly-captain", selectedTeamId, currentGameday.gw],
    queryFn: async () => {
      if (!selectedTeamId) return null;
      const { data, error } = await supabase
        .from("roster")
        .select("day")
        .eq("team_id", selectedTeamId)
        .eq("gw", currentGameday.gw)
        .eq("is_captain", true)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!selectedTeamId,
    staleTime: 10_000,
  });

  const handleSetCaptain = (playerId: number) => {
    if (!roster) return;
    // Enforce once-per-week captain rule
    if (weeklyCaptainData && weeklyCaptainData.day !== currentGameday.day) {
      toast({
        title: "Captain already set",
        description: `You already have a captain for Day ${weeklyCaptainData.day} this week. Only one captain per gameweek is allowed.`,
        variant: "destructive",
      });
      return;
    }
    setCaptainId(playerId);
    const starterIds = [...(roster.starters ?? [])];
    const benchIds = [...(roster.bench ?? [])];
    saveMutation.mutate({
      gw: currentGameday.gw, day: currentGameday.day,
      starters: starterIds, bench: benchIds,
      captain_id: playerId,
    });
  };

  // Bootstrap: teams haven't resolved yet — never show "empty roster" here.
  const isBootstrapping = !teamReady || rosterLoading || playersLoading;
  // Only show empty state when the roster query actually succeeded for a real team.
  const isRosterEmpty = teamReady && rosterSuccess && rosterPlayerIds.length === 0;
  // Genuine transport failure (after team is ready) — surface a retry card.
  const isRosterErrored = teamReady && rosterIsError;
  const [autoPicking, setAutoPicking] = useState(false);
  const handleAutoPick = async () => {
    setAutoPicking(true);
    try {
      await autoPickRoster(
        { gw: currentGameday.gw, day: currentGameday.day, strategy: "value5" },
        selectedTeamId ?? undefined
      );
      await queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Roster auto-picked!" });
    } catch (e: any) {
      toast({ title: "Auto-pick failed", description: e.message, variant: "destructive" });
    } finally {
      setAutoPicking(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Full-width Header Banner ── */}
      <div className="bg-primary mb-3 px-5 py-3 rounded-xl shrink-0">
        <p className="text-destructive font-heading text-[11px] font-bold uppercase tracking-widest mb-0.5">
          {teamName}
        </p>
        <h1 className="text-primary-foreground font-heading text-2xl font-bold tracking-wider">
          GAMEWEEK {currentGameday.gw} — DAY {currentGameday.day}
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span className="text-primary-foreground/80 text-xs font-body">
              Deadline: <span className="font-semibold text-primary-foreground">{deadlineFormatted}</span>
            </span>
          </div>
          {countdown && (
            <Badge className={`rounded-lg text-[10px] font-mono ${countdown === "LOCKED" ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"}`}>
              {countdown}
            </Badge>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setAiCoachOpen(true)}
              aria-label="Open Ballers.IQ"
              title="Open Ballers.IQ"
              className="group relative h-10 w-[148px] rounded-xl overflow-hidden ring-1 ring-amber-400/40 hover:ring-amber-400/80 shadow-[0_4px_18px_-8px_hsl(45_90%_55%/0.55)] hover:shadow-[0_6px_28px_-8px_hsl(45_90%_55%/0.85)] transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/20 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <BallersIQBrand
                variant="badge"
                size="lg"
                className="!h-10 w-full object-cover"
              />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWishlistOpen(true)}
              className="rounded-xl font-heading uppercase text-xs"
            >
              <Heart className="h-3.5 w-3.5 mr-1" />Wishlist
            </Button>
          </div>
        </div>
      </div>

      {isBootstrapping ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : isRosterErrored ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-destructive/40 rounded-2xl p-8 text-center shadow-lg">
            <h2 className="font-heading text-xl font-bold uppercase tracking-wider mb-2 text-destructive">
              Couldn't load roster
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              The roster request failed. This is usually a transient network issue — your data is safe.
            </p>
            <Button onClick={() => refetchRoster()} className="rounded-xl font-heading uppercase text-xs">
              <RefreshCw className="h-4 w-4 mr-1" />Retry
            </Button>
          </div>
        </div>
      ) : isRosterEmpty ? (
        createPortal(
          <div
            className="fixed inset-0 z-40 overflow-auto bg-background text-foreground"
            style={{
              backgroundImage: `
                radial-gradient(ellipse at 20% 10%, hsl(var(--primary) / 0.18), transparent 55%),
                radial-gradient(ellipse at 85% 90%, hsl(var(--accent) / 0.12), transparent 55%),
                radial-gradient(ellipse at 50% 50%, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
              `,
            }}
          >
            {/* subtle grid overlay — matches /welcome shell */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="relative">
              <DraftPicker
                teamName={teamName}
                onFinish={() => {
                  queryClient.invalidateQueries({ queryKey: ["roster-current"] });
                  refetchRoster();
                }}
              />
            </div>
          </div>,
          document.body,
        )
      ) : (
        <>
          {/* ── Toolbar Row ── */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "court" | "list")}>
                <ToggleGroupItem value="court" className="font-heading text-xs uppercase rounded-xl">
                  <LayoutGrid className="h-4 w-4 mr-1" />Court
                </ToggleGroupItem>
                <ToggleGroupItem value="list" className="font-heading text-xs uppercase rounded-xl">
                  <List className="h-4 w-4 mr-1" />List
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="flex items-center gap-2 ml-3">
                <Badge variant="destructive" className="rounded-xl text-xs px-2.5 py-0.5 font-heading">FC:{fcStarters}</Badge>
                <Badge className="rounded-xl text-xs px-2.5 py-0.5 font-heading">BC:{bcStarters}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setScheduleOpen((v) => !v)}
                variant={scheduleOpen ? "default" : "outline"}
                size="sm"
                className={`rounded-xl font-heading uppercase text-xs ${scheduleOpen ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
                title="Toggle schedule preview"
              >
                <CalendarDays className="h-3.5 w-3.5 mr-1" />Schedule
              </Button>
              <Button
                onClick={() => setChipCaptain(!chipCaptain)}
                variant={chipCaptain ? "default" : "outline"}
                size="sm"
                className={`rounded-xl font-heading uppercase text-xs ${chipCaptain ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
                title="Activate Captain chip — doubles captain's FP"
              >
                <Star className="h-3.5 w-3.5 mr-1" />Captain
              </Button>
              <Button
                onClick={() => setChipAllStar(!chipAllStar)}
                variant={chipAllStar ? "default" : "outline"}
                size="sm"
                className={`rounded-xl font-heading uppercase text-xs ${chipAllStar ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
                title="Activate All-Star chip — boost all starters"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />All-Star
              </Button>
              <Button
                onClick={() => setChipWildcard(!chipWildcard)}
                variant={chipWildcard ? "default" : "outline"}
                size="sm"
                className={`rounded-xl font-heading uppercase text-xs ${chipWildcard ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
                title="Activate Wildcard chip — unlimited free transfers"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Wildcard
              </Button>

              {starters.length + bench.length < 10 && (
                <Button onClick={handleAddPlayer} variant="outline" size="sm" className="rounded-xl font-heading uppercase text-xs">
                  <Plus className="h-4 w-4 mr-1" />Add Player
                </Button>
              )}
              <Button
                onClick={handleOptimize}
                variant="outline"
                size="sm"
                className="rounded-xl font-heading uppercase text-xs hover:bg-yellow-400 hover:text-black dark:hover:bg-orange-500 dark:hover:text-white"
                title="Auto-optimize lineup for maximum FP"
              >
                <Zap className="h-4 w-4 mr-1" />Optimize
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl font-heading uppercase text-xs text-destructive border-destructive/30 hover:bg-destructive/10" title="Remove all players from roster">
                    <RotateCcw className="h-4 w-4 mr-1" />Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Roster?</AlertDialogTitle>
                    <AlertDialogDescription>This will remove all 10 players from your roster. You'll need to re-select them.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground">Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* ── Layout ── */}
          <div className="min-w-0 flex-1 relative">
            {/* Schedule preview — absolute overlay, never pushes the court */}
            {scheduleOpen && (
              <div className="absolute left-0 right-0 top-0 z-30 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-3 max-h-[520px] overflow-hidden animate-accordion-down">
                <button
                  type="button"
                  onClick={() => setScheduleOpen(false)}
                  className="absolute top-2 right-2 z-10 h-6 w-6 inline-flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Close schedule"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <SchedulePreviewBody rosterTeams={rosterTeams} variant="panel" />
              </div>
            )}
            {viewMode === "court" ? (
              <RosterCourtView
                starters={starters}
                bench={bench}
                captainId={captainId}
                onPlayerClick={setSelectedPlayerId}
                onSwap={handleSwapRequest}
                onSetCaptain={handleSetCaptain}
                onDnDSwap={handleDnDSwap}
                upcomingByTeam={upcomingByTeam}
                sidebarProps={{
                  gw: currentGameday.gw,
                  day: currentGameday.day,
                  teamId: selectedTeamId ?? undefined,
                  bankRemaining: roster?.bank_remaining ?? 0,
                  freeTransfers: roster?.free_transfers_remaining ?? 0,
                  fcStarters,
                  bcStarters,
                  totalSalary,
                }}
              />
            ) : (
              <>
                <RosterListView starters={starters} bench={bench} onPlayerClick={setSelectedPlayerId} onSwap={handleSwapRequest} onDnDSwap={handleDnDSwap} />
                <div className="mt-4">
                  <RosterSidebar
                    gw={currentGameday.gw}
                    day={currentGameday.day}
                    teamId={selectedTeamId ?? undefined}
                    bankRemaining={roster?.bank_remaining ?? 0}
                    freeTransfers={roster?.free_transfers_remaining ?? 0}
                    fcStarters={fcStarters}
                    bcStarters={bcStarters}
                    totalSalary={totalSalary}
                  />
                </div>
              </>
            )}

            {/* Ballers.IQ Lineup Advisor — visible in BOTH court & list views */}
            {(() => {
              if (!starters.length && !bench.length) return null;
              const biqPlayers = [...starters, ...bench].map((p) => ({
                id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc,
                salary: p.core.salary,
                fp_pg5: (p as any).last5?.fp5, fp_pg_t: (p as any).season?.fp,
                value5: (p as any).last5?.value5, mpg: (p as any).season?.mpg,
                mpg5: (p as any).last5?.mpg5,
                stl5: (p as any).last5?.stl5, blk5: (p as any).last5?.blk5, ast5: (p as any).last5?.ast5,
                delta_fp: (p as any).last5?.delta_fp, delta_mpg: (p as any).last5?.delta_mpg,
                injury: (p.core as any)?.injury,
              }));
              const biqRoster = [
                ...starters.map((p, i) => ({ player_id: p.core.id, slot: `S${i + 1}`, is_captain: p.core.id === captainId })),
                ...bench.map((p, i) => ({ player_id: p.core.id, slot: `B${i + 1}`, is_captain: false })),
              ];
              const biq = getBallersIQInsights("lineup", { players: biqPlayers, roster: biqRoster });
              return biq.insights.length ? (
                <BallersIQPanel title="Lineup Advisor" summary={biq.summary} className="mt-4">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {biq.insights.map((ins, i) => <BallersIQCard key={i} insight={ins} />)}
                  </div>
                </BallersIQPanel>
              ) : null;
            })()}
          </div>

          <OptimizeDialog open={optimizeOpen} onOpenChange={setOptimizeOpen} result={optimizerResult} onApply={handleApplyOptimization} applying={saveMutation.isPending} />
          <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
          <AICoachModal open={aiCoachOpen} onOpenChange={setAiCoachOpen} />
          <PlayerPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            allPlayers={allPlayers}
            rosterIds={rosterIds}
            rosterTeams={rosterTeams}
            onSelect={swapPlayerId ? handleSwapSelect : handleAddSelect}
            title={swapPlayerId ? "Swap Player" : "Add Player"}
            bankRemaining={roster?.bank_remaining ?? 100}
            swapPlayerSalary={swapPlayerId ? swapPlayerSalary : undefined}
            swapPlayerPosition={swapPlayerId && totalPlayers >= 10 ? swapPlayerPosition : null}
          />
          <WishlistModal open={wishlistOpen} onOpenChange={setWishlistOpen} onPlayerClick={setSelectedPlayerId} />
        </>
      )}
    </div>
  );
}
