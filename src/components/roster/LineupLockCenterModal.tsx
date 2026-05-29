import { useMemo } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LockKeyhole, ShieldCheck, ShieldAlert, AlertTriangle, Crown, CalendarX,
  Users, ArrowLeftRight, Zap, Clock, Bandage, CheckCircle2, Sparkles,
  TrendingUp, Brain, CalendarDays, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerListItemSchema } from "@/lib/contracts";
import type { UpcomingByTeam, UpcomingGame } from "@/hooks/useUpcomingByTeam";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import { useLeague } from "@/contexts/LeagueContext";
import { useTeamDifficultyMap } from "@/hooks/useTeamDifficultyMap";
import { getLeagueLogo } from "@/lib/competitions";
import { getTeamLogo } from "@/lib/nba-teams";
import {
  normalizePlayerHealth, isHealthUnavailable, isHealthRisky, getHealthLabel,
} from "@/lib/health";
import { calculateCaptainEdge } from "@/lib/ballers-iq/playerIntelligence";
import { difficultyRingColor } from "@/lib/ballers-iq/difficultyColor";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

export interface LineupLockCenterModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teamName: string;
  gw: number;
  day: number;
  deadlineFormatted?: string | null;
  countdown?: string | null;
  rosterLocked?: boolean;
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId: number;
  upcomingByTeam?: UpcomingByTeam;
  allPlayers?: PlayerListItem[];
  rosterIds?: Set<number>;
  bankRemaining: number;
  freeTransfers: number;
  salaryCap: number;
  totalSalary: number;
  fcStarters: number;
  bcStarters: number;
  /** Wired actions (open relevant existing tools). */
  onApplyCaptain?: (playerId: number) => void;
  onOptimize?: () => void;
  onOpenCoach?: () => void;
  onOpenAdvisor?: () => void;
  onOpenSchedule?: () => void;
}

/* ----------------------------- small helpers ----------------------------- */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fp5Of = (p: any) => num(p?.last5?.fp5);
const seasonFpOf = (p: any) => num(p?.season?.fp);
const projFpOf = (p: any) => fp5Of(p) || seasonFpOf(p);
const value5Of = (p: any) => num(p?.computed?.value5 ?? p?.last5?.value5);

type AvailStatus = "CAPTAIN" | "OUT" | "GTD" | "NO GAME" | "ACTIVE" | "BENCH";

const STATUS_TONE: Record<AvailStatus, string> = {
  CAPTAIN: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  OUT: "text-red-400 border-red-500/40 bg-red-500/10",
  GTD: "text-orange-300 border-orange-400/40 bg-orange-400/10",
  "NO GAME": "text-zinc-300 border-zinc-400/30 bg-zinc-400/10",
  ACTIVE: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  BENCH: "text-sky-300 border-sky-400/30 bg-sky-400/10",
};

export default function LineupLockCenterModal(props: LineupLockCenterModalProps) {
  if (!props.open) return null;
  return <LineupLockCenterInner {...props} />;
}

function LineupLockCenterInner({
  open, onOpenChange, teamName, gw, day, deadlineFormatted, countdown, rosterLocked,
  starters, bench, captainId, upcomingByTeam, allPlayers, rosterIds,
  bankRemaining, freeTransfers, salaryCap, totalSalary, fcStarters, bcStarters,
  onApplyCaptain, onOptimize, onOpenCoach, onOpenAdvisor, onOpenSchedule,
}: LineupLockCenterModalProps) {
  const { league } = useLeague();
  const { data: diffMap } = useTeamDifficultyMap();

  const roster = useMemo(() => [...starters, ...bench], [starters, bench]);
  const hasRoster = roster.length > 0;

  const logoFor = (tri: string) => getTeamLogo(tri, league);

  // Game for a player on the *selected gameday*.
  const dayGameOf = (p: any): UpcomingGame | null => {
    const tri = String(p?.core?.team ?? "");
    const list = upcomingByTeam?.[tri] ?? upcomingByTeam?.[tri.toUpperCase()] ?? [];
    return list.find((g) => g.gw === gw && g.day === day) ?? null;
  };

  const statusOf = (p: any, isStarter: boolean): AvailStatus => {
    if (p?.core?.id === captainId && captainId > 0) return "CAPTAIN";
    const h = normalizePlayerHealth(p);
    if (isHealthUnavailable(h)) return "OUT";
    if (isHealthRisky(h)) return "GTD";
    if (!dayGameOf(p)) return "NO GAME";
    return isStarter ? "ACTIVE" : "BENCH";
  };

  /* --------------------------- derived metrics --------------------------- */

  const captain = useMemo(
    () => roster.find((p) => p.core.id === captainId && captainId > 0) ?? null,
    [roster, captainId],
  );

  const noGameStarters = useMemo(
    () => starters.filter((p) => !dayGameOf(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [starters, upcomingByTeam, gw, day],
  );

  const injuredRoster = useMemo(
    () => roster.filter((p) => {
      const h = normalizePlayerHealth(p);
      return isHealthUnavailable(h) || isHealthRisky(h);
    }),
    [roster],
  );

  const activeTodayCount = useMemo(
    () => roster.filter((p) => !!dayGameOf(p)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, upcomingByTeam, gw, day],
  );

  // Best captain candidate: roster player, has a game today, not OUT, highest projected FP.
  const bestCaptain = useMemo(() => {
    const eligible = roster
      .filter((p) => {
        const h = normalizePlayerHealth(p);
        return !isHealthUnavailable(h) && !!dayGameOf(p);
      })
      .sort((a, b) => projFpOf(b) - projFpOf(a));
    return eligible[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, upcomingByTeam, gw, day]);

  const captainConfidence = useMemo(() => {
    if (!captain) return null;
    const tri = String(captain.core.team ?? "").toUpperCase();
    const g = dayGameOf(captain);
    const oppTri = g ? (g.isHome ? g.opponent : g.opponent) : null;
    const oppDiff = oppTri ? diffMap?.[String(oppTri).toUpperCase()] : undefined;
    return calculateCaptainEdge(
      {
        id: captain.core.id, name: captain.core.name, team: tri,
        fp_pg5: fp5Of(captain), fp_pg_t: seasonFpOf(captain),
        mpg5: num((captain as any)?.last5?.mpg5),
        stocks5: num((captain as any)?.computed?.stocks5),
        injury: (captain.core as any)?.injury,
      } as any,
      { hasGame: !!g, matchupDifficulty: oppDiff?.score },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captain, diffMap, upcomingByTeam, gw, day]);

  const currentCaptainFp = captain ? projFpOf(captain) : 0;
  const bestCaptainFp = bestCaptain ? projFpOf(bestCaptain) : 0;
  const captainGain = captain
    ? Math.max(0, bestCaptainFp - currentCaptainFp)
    : bestCaptainFp;

  // Schedule exposure — group roster players by game on the selected day.
  const exposure = useMemo(() => {
    const map = new Map<string, { game: UpcomingGame; players: PlayerListItem[]; fp: number }>();
    for (const p of roster) {
      const g = dayGameOf(p);
      if (!g?.gameId) continue;
      const entry = map.get(g.gameId) ?? { game: g, players: [], fp: 0 };
      entry.players.push(p);
      entry.fp += projFpOf(p);
      map.set(g.gameId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.fp - a.fp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, upcomingByTeam, gw, day]);

  // Transfer windows (recommendations only — never auto-executed).
  const transferIdeas = useMemo(() => {
    const ids = rosterIds ?? new Set(roster.map((p) => p.core.id));
    const pool = (allPlayers ?? []).filter((p) => !ids.has(p.core.id));
    // Best Add: best value5 available player affordable within bank.
    const affordable = pool
      .filter((p) => num(p.core.salary) <= bankRemaining + 0.001 && projFpOf(p) > 0)
      .sort((a, b) => value5Of(b) - value5Of(a) || projFpOf(b) - projFpOf(a));
    const bestAdd = affordable[0] ?? null;
    // Salary trap to replace: roster starter with worst value5 (with a game).
    const trap = [...starters]
      .filter((p) => num(p.core.salary) >= 8)
      .sort((a, b) => value5Of(a) - value5Of(b))[0] ?? null;
    // Best swap: trap → best same-position affordable upgrade.
    let bestSwap: { out: PlayerListItem; in_: PlayerListItem; gain: number } | null = null;
    if (trap) {
      const budget = bankRemaining + num(trap.core.salary);
      const upgrade = pool
        .filter((p) => p.core.fc_bc === trap.core.fc_bc && num(p.core.salary) <= budget + 0.001 && projFpOf(p) > projFpOf(trap))
        .sort((a, b) => projFpOf(b) - projFpOf(a))[0];
      if (upgrade) bestSwap = { out: trap, in_: upgrade, gain: projFpOf(upgrade) - projFpOf(trap) };
    }
    const watchlist = injuredRoster[0] ?? null;
    return { bestAdd, bestSwap, watchlist, trap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers, rosterIds, roster, starters, bankRemaining, injuredRoster]);

  /* ------------------------------ lock status ----------------------------- */

  const rosterFull = starters.length === 5 && roster.length === 10;
  const validSplit = !rosterFull || (fcStarters === 2 && bcStarters === 3) || (fcStarters === 3 && bcStarters === 2);
  const starterOut = starters.some((p) => isHealthUnavailable(normalizePlayerHealth(p)));

  const isCritical = !captain || starterOut || !validSplit || (rosterFull && noGameStarters.length >= 3);
  const isWarning = !isCritical && (noGameStarters.length > 0 || injuredRoster.length > 0);
  const lockLevel: "READY" | "WARNING" | "CRITICAL" = isCritical ? "CRITICAL" : isWarning ? "WARNING" : "READY";

  const lockNotes = useMemo(() => {
    const notes: { tone: "good" | "warn" | "bad"; text: string }[] = [];
    if (!captain) notes.push({ tone: "bad", text: "No captain selected" });
    if (starterOut) notes.push({ tone: "bad", text: "Injured player in starting five" });
    if (!validSplit) notes.push({ tone: "bad", text: "Starting 5 breaks the FC/BC split" });
    if (noGameStarters.length > 0)
      notes.push({ tone: "warn", text: `${noGameStarters.length} starter${noGameStarters.length > 1 ? "s have" : " has"} no game today` });
    if (injuredRoster.length > 0)
      notes.push({ tone: "warn", text: `${injuredRoster.length} player${injuredRoster.length > 1 ? "s" : ""} flagged GTD/OUT` });
    notes.push({ tone: validSplit && rosterFull ? "good" : "warn", text: rosterFull ? "Roster rule compliant" : "Roster not yet complete (10 players)" });
    notes.push({ tone: "good", text: `Cap space: ${bankRemaining.toFixed(1)}M` });
    notes.push({ tone: freeTransfers > 0 ? "good" : "warn", text: `${freeTransfers} transfer${freeTransfers === 1 ? "" : "s"} left` });
    return notes;
  }, [captain, starterOut, validSplit, noGameStarters, injuredRoster, rosterFull, bankRemaining, freeTransfers]);

  const actionsCount =
    (captain ? 0 : 1) + (starterOut ? 1 : 0) + (validSplit ? 0 : 1) + (noGameStarters.length > 0 ? 1 : 0);

  /* --------------------------------- render -------------------------------- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden border-amber-400/25 bg-background [&>button]:!text-white [&>button]:!opacity-90 [&>button]:hover:!opacity-100 [&>button]:z-50">
        <DialogHeader className="sr-only">
          <DialogTitle>Lineup Lock Center</DialogTitle>
        </DialogHeader>

        <div className="relative flex h-full flex-col overflow-hidden text-foreground bg-[radial-gradient(ellipse_at_top,hsl(30_55%_24%/0.6),hsl(25_42%_14%)_72%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10),transparent_60%),rgba(0,0,0,0.78)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent shadow-[0_0_10px_rgba(252,211,77,0.4)]" />
          <img
            src={getLeagueLogo(league)}
            alt=""
            aria-hidden
            className="pointer-events-none select-none absolute -top-6 -right-8 h-44 w-44 object-contain opacity-[0.10] rotate-[8deg] z-[5]"
            style={{ WebkitMaskImage: "radial-gradient(circle at center, black 55%, transparent 78%)", maskImage: "radial-gradient(circle at center, black 55%, transparent 78%)" }}
          />

          {/* Header */}
          <div className="relative z-10 px-6 pt-4 pb-3 border-b border-amber-400/15 shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-600/10 border border-amber-400/30 flex items-center justify-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]">
                <LockKeyhole className="h-5 w-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/80 font-heading">
                  Pre-lock command center
                </div>
                <h2 className="font-heading font-black text-xl md:text-2xl uppercase tracking-wide bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
                  Lineup Lock Center
                </h2>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-300/30 bg-black/40 text-white text-[11px] font-heading uppercase tracking-[0.16em]">
                  {teamName}
                </span>
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-300/30 bg-black/40 text-white text-[11px] font-heading uppercase tracking-[0.16em]">
                  GW {gw}.{day}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-mono tabular-nums",
                  countdown === "LOCKED" || rosterLocked
                    ? "border-red-500/40 bg-red-500/15 text-red-300"
                    : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
                )}>
                  <Clock className="h-3.5 w-3.5" />
                  {rosterLocked ? "LOCKED" : countdown ? `LOCK IN ${countdown}` : (deadlineFormatted ?? "Lock deadline unavailable")}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {!hasRoster ? (
              <EmptyState
                icon={<Users className="h-8 w-8 text-amber-300/60" />}
                text="Build your roster first to unlock Lineup Lock Center."
              />
            ) : (
              <>
                {/* Top status strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatusCard
                    label="Lock Status"
                    icon={lockLevel === "READY" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    tone={lockLevel === "READY" ? "good" : lockLevel === "WARNING" ? "warn" : "bad"}
                    value={lockLevel}
                    sub={actionsCount > 0 ? `${actionsCount} action${actionsCount > 1 ? "s" : ""} recommended` : "No issues detected"}
                  />
                  <StatusCard
                    label="Players Active Today"
                    icon={<Users className="h-4 w-4" />}
                    tone={activeTodayCount >= 8 ? "good" : activeTodayCount >= 5 ? "warn" : "bad"}
                    value={`${activeTodayCount} / ${roster.length}`}
                    sub="Have a game on this gameday"
                  />
                  <StatusCard
                    label="No-Game Players"
                    icon={<CalendarX className="h-4 w-4" />}
                    tone={noGameStarters.length === 0 ? "good" : noGameStarters.length < 2 ? "warn" : "bad"}
                    value={String(roster.filter((p) => !dayGameOf(p)).length)}
                    sub={`${noGameStarters.length} in starting five`}
                  />
                  <StatusCard
                    label="Injury Flags"
                    icon={<Bandage className="h-4 w-4" />}
                    tone={injuredRoster.length === 0 ? "good" : "bad"}
                    value={String(injuredRoster.length)}
                    sub={injuredRoster.length ? injuredRoster.map((p) => p.core.name.split(" ").slice(-1)[0]).join(", ") : "All clear"}
                  />
                </div>

                {/* 3-column dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* LEFT */}
                  <div className="space-y-4">
                    <Panel title="Captain Check" icon={<Crown className="h-3.5 w-3.5 text-amber-300" />}>
                      {captain ? (
                        <div className="flex items-center gap-3">
                          <PlayerAvatar p={captain} logoFor={logoFor} />
                          <div className="min-w-0 flex-1">
                            <div className="font-heading font-bold text-sm truncate text-white">{captain.core.name}</div>
                            <CaptainContext p={captain} g={dayGameOf(captain)} />
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-black text-amber-300 text-lg tabular-nums">{projFpOf(captain).toFixed(1)}</div>
                            <div className="text-[9px] uppercase tracking-wider text-white/50">FP{fp5Of(captain) ? "5" : " season"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span className="font-heading uppercase text-xs tracking-wide font-bold">No captain selected</span>
                        </div>
                      )}

                      {captainConfidence && captain && (
                        <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
                          <span className="uppercase tracking-wider">Confidence</span>
                          <span className="font-heading font-bold text-amber-200">{captainConfidence.label} · {Math.round(captainConfidence.score)}</span>
                        </div>
                      )}

                      {bestCaptain && (!captain || bestCaptain.core.id !== captain.core.id) && (
                        <div className="mt-3 rounded-lg border border-amber-400/25 bg-black/30 p-2.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-amber-300/70 mb-1.5">Best alternative</div>
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar p={bestCaptain} logoFor={logoFor} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="font-heading font-bold text-xs truncate text-white">{bestCaptain.core.name}</div>
                              <div className="text-[10px] text-white/50">{projFpOf(bestCaptain).toFixed(1)} FP · +{captainGain.toFixed(1)} gain</div>
                            </div>
                            <button
                              type="button"
                              disabled={!onApplyCaptain || rosterLocked}
                              onClick={() => onApplyCaptain?.(bestCaptain.core.id)}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-wider text-amber-200 transition-all hover:bg-amber-400/25 hover:scale-[1.03] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Crown className="h-3 w-3" /> Apply
                            </button>
                          </div>
                        </div>
                      )}
                      {!bestCaptain && !captain && (
                        <p className="mt-2 text-[11px] text-white/50">No safe captain candidate found.</p>
                      )}
                    </Panel>

                    <Panel title="Multiplier Impact" icon={<TrendingUp className="h-3.5 w-3.5 text-amber-300" />}>
                      <div className="space-y-1.5 text-sm">
                        <ImpactRow label="Current" value={captain ? `${currentCaptainFp.toFixed(1)} FP` : "Missing"} tone={captain ? "neutral" : "bad"} />
                        <ImpactRow label="Best option" value={bestCaptain ? `${bestCaptainFp.toFixed(1)} FP` : "—"} tone="neutral" />
                        <ImpactRow
                          label={captain ? "Gain" : "Captain slot impact"}
                          value={`+${captainGain.toFixed(1)} FP`}
                          tone="good"
                          emphasize
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-white/40 leading-snug">
                        Captain scores 2× FP. Figures use last-5 FP (or season FP when no recent sample).
                      </p>
                    </Panel>
                  </div>

                  {/* CENTER */}
                  <div className="space-y-4">
                    <Panel title="Roster Availability" icon={<Users className="h-3.5 w-3.5 text-amber-300" />}>
                      <div className="space-y-1">
                        {starters.map((p, i) => (
                          <RosterRow key={p.core.id} p={p} slot={`S${i + 1}`} status={statusOf(p, true)} g={dayGameOf(p)} logoFor={logoFor} />
                        ))}
                        {bench.length > 0 && <div className="h-px bg-amber-400/10 my-1.5" />}
                        {bench.map((p, i) => (
                          <RosterRow key={p.core.id} p={p} slot={`B${i + 1}`} status={statusOf(p, false)} g={dayGameOf(p)} logoFor={logoFor} />
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Schedule Exposure" icon={<CalendarDays className="h-3.5 w-3.5 text-amber-300" />}>
                      {exposure.length === 0 ? (
                        <p className="text-[11px] text-white/50">Schedule context unavailable for this gameday.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {exposure.map((e) => (
                            <div key={e.game.gameId} className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-black/25 px-2.5 py-1.5">
                              <GameLogos g={e.game} logoFor={logoFor} />
                              <div className="min-w-0 flex-1">
                                <div className="font-heading font-bold text-[11px] text-white truncate">
                                  {e.game.isHome ? `${e.game.homeTeam} vs ${e.game.awayTeam}` : `${e.game.awayTeam} @ ${e.game.homeTeam}`}
                                </div>
                                <div className="text-[9px] text-white/45">{e.players.length} player{e.players.length > 1 ? "s" : ""}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-amber-200 text-xs tabular-nums">{e.fp.toFixed(1)}</div>
                                <div className="text-[8px] uppercase tracking-wider text-white/40">FP exp.</div>
                              </div>
                            </div>
                          ))}
                          {roster.filter((p) => !dayGameOf(p)).length > 0 && (
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 px-1 pt-1">
                              <CalendarX className="h-3 w-3" /> {roster.filter((p) => !dayGameOf(p)).length} no-game slot(s)
                            </div>
                          )}
                        </div>
                      )}
                    </Panel>
                  </div>

                  {/* RIGHT */}
                  <div className="space-y-4">
                    <Panel title="Transfer Windows" icon={<ArrowLeftRight className="h-3.5 w-3.5 text-amber-300" />}>
                      {(transferIdeas.bestAdd || transferIdeas.bestSwap || transferIdeas.watchlist) ? (
                        <div className="space-y-2">
                          {transferIdeas.bestSwap && (
                            <TransferIdea
                              tag="Best swap"
                              tone="good"
                              title={`${transferIdeas.bestSwap.out.core.name.split(" ").slice(-1)[0]} → ${transferIdeas.bestSwap.in_.core.name}`}
                              sub={`Projected +${transferIdeas.bestSwap.gain.toFixed(1)} FP`}
                            />
                          )}
                          {transferIdeas.bestAdd && (
                            <TransferIdea
                              tag="Best add"
                              tone="neutral"
                              title={transferIdeas.bestAdd.core.name}
                              sub={`Projected ${projFpOf(transferIdeas.bestAdd).toFixed(1)} FP · ${num(transferIdeas.bestAdd.core.salary).toFixed(1)}M`}
                            />
                          )}
                          {transferIdeas.watchlist && (
                            <TransferIdea
                              tag="Injury cover"
                              tone="bad"
                              title={transferIdeas.watchlist.core.name}
                              sub={getHealthLabel(normalizePlayerHealth(transferIdeas.watchlist))}
                            />
                          )}
                          <button
                            type="button"
                            disabled={!onOpenCoach}
                            onClick={onOpenCoach}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/25 bg-black/30 px-3 py-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-white/80 transition-all hover:bg-amber-400/10 hover:text-amber-200 disabled:opacity-40"
                          >
                            Open trade tools <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/50">No urgent transfer moves detected.</p>
                      )}
                    </Panel>

                    <Panel title="Quick Actions" icon={<Zap className="h-3.5 w-3.5 text-amber-300" />}>
                      <div className="grid grid-cols-1 gap-2">
                        <QuickAction icon={<Crown className="h-3.5 w-3.5" />} label="Open Captain Call" onClick={onOpenCoach} />
                        <QuickAction icon={<Bandage className="h-3.5 w-3.5" />} label="Open Health Desk" onClick={onOpenAdvisor} />
                        <QuickAction icon={<Brain className="h-3.5 w-3.5" />} label="Open Market Watch" onClick={onOpenAdvisor} />
                        <QuickAction icon={<Zap className="h-3.5 w-3.5" />} label="Optimize Lineup" onClick={onOptimize} />
                      </div>
                    </Panel>

                    <Panel title="Lock Notes" icon={<Sparkles className="h-3.5 w-3.5 text-amber-300" />}>
                      <ul className="space-y-1">
                        {lockNotes.map((n, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug">
                            <span className={cn(
                              "mt-0.5 shrink-0",
                              n.tone === "good" ? "text-emerald-400" : n.tone === "warn" ? "text-amber-400" : "text-red-400",
                            )}>
                              {n.tone === "good" ? <CheckCircle2 className="h-3 w-3" /> : n.tone === "warn" ? <AlertTriangle className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                            </span>
                            <span className="text-white/75">{n.text}</span>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom status bar */}
          {hasRoster && (
            <div className="relative z-10 shrink-0 border-t border-amber-400/15 bg-black/40 px-5 py-2.5 flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] font-heading uppercase tracking-[0.14em]">
              <span className={cn("inline-flex items-center gap-1.5", validSplit && rosterFull ? "text-emerald-300" : "text-amber-300")}>
                {validSplit && rosterFull ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {validSplit && rosterFull ? "Rule Compliant" : "Rule Issue"}
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/80">Cap Space <span className="text-amber-200">{bankRemaining.toFixed(1)}M</span></span>
              <span className="text-white/40">·</span>
              <span className="text-white/80">{freeTransfers} Transfer{freeTransfers === 1 ? "" : "s"} Left</span>
              <span className="text-white/40">·</span>
              <span className="text-white/80">Salary <span className="text-amber-200">{totalSalary.toFixed(1)}</span>/{salaryCap}M</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-emerald-300/80">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
                Live
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-amber-400/15 bg-black/30 backdrop-blur-sm p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <h3 className="font-heading font-bold text-[11px] uppercase tracking-[0.2em] text-amber-200/90">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function StatusCard({ label, icon, value, sub, tone }: {
  label: string; icon: React.ReactNode; value: string; sub: string; tone: "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good" ? "border-emerald-400/30 from-emerald-400/10" :
    tone === "warn" ? "border-amber-400/30 from-amber-400/10" :
    "border-red-500/30 from-red-500/10";
  const valCls =
    tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-red-300";
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br to-black/40 p-3", toneCls)}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-white/55 mb-1.5">
        <span className={valCls}>{icon}</span>
        {label}
      </div>
      <div className={cn("font-heading font-black text-lg leading-none", valCls)}>{value}</div>
      <div className="text-[10px] text-white/45 mt-1 truncate">{sub}</div>
    </div>
  );
}

function PlayerAvatar({ p, logoFor, size = "md" }: { p: any; logoFor: (t: string) => string | undefined; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const logo = logoFor(p.core.team);
  return (
    <div className={cn("relative shrink-0 rounded-lg overflow-hidden bg-black/40 border border-amber-400/20", dim)}>
      {p.core.photo ? (
        <img src={p.core.photo} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[10px] font-heading">{p.core.team}</div>
      )}
      {logo && <img src={logo} alt="" className="absolute bottom-0 right-0 h-3.5 w-3.5 object-contain drop-shadow" />}
    </div>
  );
}

function CaptainContext({ p, g }: { p: any; g: UpcomingGame | null }) {
  if (!g) return <div className="text-[10px] text-zinc-400">{p.core.team} · No game today</div>;
  const opp = g.isHome ? `vs ${g.opponent}` : `@ ${g.opponent}`;
  return (
    <div className="text-[10px] text-white/55 truncate">
      {p.core.team} {opp}{g.tipoffUtc ? ` · ${formatTipoffLabel(g.tipoffUtc)}` : ""}
    </div>
  );
}

function RosterRow({ p, slot, status, g, logoFor }: {
  p: any; slot: string; status: AvailStatus; g: UpcomingGame | null; logoFor: (t: string) => string | undefined;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-amber-400/5">
      <span className="w-6 shrink-0 text-[9px] font-mono text-white/35 text-center">{slot}</span>
      <PlayerAvatar p={p} logoFor={logoFor} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="font-heading font-bold text-[11px] text-white truncate flex items-center gap-1">
          {p.core.name}
          <span className={cn(
            "text-[8px] font-bold px-1 rounded",
            p.core.fc_bc === "FC" ? "text-red-300 bg-red-500/15" : "text-amber-300 bg-amber-400/15",
          )}>{p.core.fc_bc}</span>
        </div>
        <div className="text-[9px] text-white/45 truncate">
          {p.core.team}{g ? (g.isHome ? ` vs ${g.opponent}` : ` @ ${g.opponent}`) : " · —"}
        </div>
      </div>
      <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-heading font-bold uppercase tracking-wider", STATUS_TONE[status])}>
        {status === "CAPTAIN" && <Crown className="h-2.5 w-2.5" />}
        {status}
      </span>
    </div>
  );
}

function GameLogos({ g, logoFor }: { g: UpcomingGame; logoFor: (t: string) => string | undefined }) {
  const a = logoFor(g.awayTeam ?? "");
  const h = logoFor(g.homeTeam ?? "");
  return (
    <div className="flex items-center -space-x-1 shrink-0">
      {a ? <img src={a} alt="" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5" />}
      {h ? <img src={h} alt="" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5" />}
    </div>
  );
}

function ImpactRow({ label, value, tone, emphasize }: {
  label: string; value: string; tone: "neutral" | "good" | "bad"; emphasize?: boolean;
}) {
  const valCls = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div className={cn("flex items-center justify-between", emphasize && "pt-1.5 border-t border-amber-400/10")}>
      <span className="text-[11px] uppercase tracking-wider text-white/55">{label}</span>
      <span className={cn("font-mono font-bold tabular-nums", valCls, emphasize && "text-base")}>{value}</span>
    </div>
  );
}

function TransferIdea({ tag, title, sub, tone }: { tag: string; title: string; sub: string; tone: "good" | "neutral" | "bad" }) {
  const tagCls = tone === "good" ? "text-emerald-300 bg-emerald-400/10" : tone === "bad" ? "text-red-300 bg-red-500/10" : "text-amber-300 bg-amber-400/10";
  return (
    <div className="rounded-lg border border-amber-400/15 bg-black/25 p-2">
      <span className={cn("inline-block text-[8px] font-heading font-bold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded mb-1", tagCls)}>{tag}</span>
      <div className="font-heading font-bold text-[11px] text-white truncate">{title}</div>
      <div className="text-[10px] text-white/50">{sub}</div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className="w-full inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-black/30 px-3 py-2 text-[11px] font-heading font-bold uppercase tracking-wider text-white/80 transition-all hover:bg-amber-400/10 hover:text-amber-200 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-amber-300">{icon}</span>
      {label}
      <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
    </button>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      {icon}
      <p className="font-heading uppercase tracking-wide text-sm text-white/60 max-w-xs">{text}</p>
    </div>
  );
}