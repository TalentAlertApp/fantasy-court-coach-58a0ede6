import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, X, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { Users, Wallet, ShieldHalf, Target, Check } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { getRowPositions } from "@/lib/court-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePreviewCollapsible } from "@/components/SchedulePreviewPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import courtBg from "@/assets/court-bg.png";
import crowdCheerSfx from "@/assets/audio/crowd-cheer.mp3";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlayers: PlayerListItem[];
  rosterIds: Set<number>;
  rosterTeams?: string[];
  onSelect: (player: PlayerListItem) => void;
  title?: string;
  bankRemaining?: number;
  swapPlayerSalary?: number;
  swapPlayerPosition?: string | null;
  /** When true, renders a basketball court preview on the right with the current picks */
  showCourtPreview?: boolean;
  picks?: PlayerListItem[];
  onRemovePick?: (id: number) => void;
  /** Roster is fully valid (10 players, 5 FC + 5 BC, ≤ cap, ≤ 2 per NBA team) */
  canConfirm?: boolean;
  /** Called when the user clicks the centered "Save Current Roster" CTA at 10/10 */
  onConfirm?: () => void;
}

const SFX_KEY = "nba_picker_sfx";

export default function PlayerPickerDialog({
  open, onOpenChange, allPlayers, rosterIds, rosterTeams = [], onSelect, title = "Pick a Player",
  bankRemaining, swapPlayerSalary, swapPlayerPosition,
  showCourtPreview = false, picks = [], onRemovePick,
  canConfirm = false, onConfirm,
}: PlayerPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [fcBcFilter, setFcBcFilter] = useState<"ALL" | "FC" | "BC">("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [lastPickId, setLastPickId] = useState<number | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PlayerListItem | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SFX_KEY) === "0";
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio(crowdCheerSfx);
    el.preload = "auto";
    el.volume = 0.45;
    audioRef.current = el;
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SFX_KEY, muted ? "0" : "1"); } catch { /* noop */ }
  }, [muted]);

  const playPickSfx = useCallback(() => {
    if (muted || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {/* ignore autoplay block */});
    } catch { /* noop */ }
  }, [muted]);

  const effectiveFilter = swapPlayerPosition ? (swapPlayerPosition as "FC" | "BC") : fcBcFilter;
  const showToggle = !swapPlayerPosition;

  const budgetAvailable = bankRemaining != null
    ? bankRemaining + (swapPlayerSalary ?? 0)
    : null;

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of rosterTeams) counts[t] = (counts[t] || 0) + 1;
    return counts;
  }, [rosterTeams]);

  const fcPicked = useMemo(() => picks.filter((p) => p.core.fc_bc === "FC").length, [picks]);
  const bcPicked = useMemo(() => picks.filter((p) => p.core.fc_bc === "BC").length, [picks]);

  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of allPlayers) if (p.core.team) set.add(p.core.team);
    return Array.from(set).sort();
  }, [allPlayers]);

  const teamFilterIsMaxed =
    teamFilter !== "ALL" && (teamCounts[teamFilter] || 0) >= 2;

  const available = useMemo(() => {
    let filtered = allPlayers.filter((p) => !rosterIds.has(p.core.id));
    if (effectiveFilter !== "ALL") {
      filtered = filtered.filter((p) => p.core.fc_bc === effectiveFilter);
    }
    if (teamFilter !== "ALL") {
      filtered = filtered.filter((p) => p.core.team === teamFilter);
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((p) =>
      p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
    );
  }, [allPlayers, rosterIds, search, effectiveFilter, teamFilter]);

  // Inline warning state — surfaces when a position group is full but roster not done
  const fcFull = fcPicked >= 5;
  const bcFull = bcPicked >= 5;
  const totalPicked = picks.length;
  let warningMessage: string | null = null;
  if (showCourtPreview && totalPicked < 10) {
    if (teamFilterIsMaxed) {
      warningMessage = `Max 2 reached for ${teamFilter} — pick from another team`;
    } else if (fcFull && !bcFull) {
      warningMessage =
        effectiveFilter === "FC"
          ? "FC filter active — all FC slots already filled. Switch to BC."
          : "FC slots full (5/5) — pick BC players to complete your roster";
    } else if (bcFull && !fcFull) {
      warningMessage =
        effectiveFilter === "BC"
          ? "BC filter active — all BC slots already filled. Switch to FC."
          : "BC slots full (5/5) — pick FC players to complete your roster";
    }
  }

  const handleSelect = (p: PlayerListItem) => {
    onSelect(p);
    if (showCourtPreview) {
      // Cinematic intro on the court
      setLastPickId(p.core.id);
      playPickSfx();
      window.setTimeout(() => setLastPickId((cur) => (cur === p.core.id ? null : cur)), 1400);
    } else {
      onOpenChange(false);
      setSearch("");
      setFcBcFilter("ALL");
      setTeamFilter("ALL");
    }
  };

  // 2-column grid layout when showCourtPreview is true — much larger to give the court room
  const dialogClass = showCourtPreview
    ? "max-w-[1280px] w-[96vw] h-[min(92vh,52rem)] rounded-lg overflow-hidden p-0 grid grid-cols-[400px_minmax(0,1fr)] gap-0"
    : "max-w-md h-[min(80vh,42rem)] rounded-lg overflow-hidden p-0 flex flex-col";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(""); setFcBcFilter("ALL"); setTeamFilter("ALL"); setLastPickId(null); } }}>
      <DialogContent className={dialogClass}>
        {/* LEFT — search + player list */}
        <div className={`flex flex-col min-h-0 p-4 ${showCourtPreview ? "border-r border-border" : ""}`}>
          <DialogHeader className="pr-10 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <DialogTitle className="font-heading">{title}</DialogTitle>
              {budgetAvailable != null && !showCourtPreview && (
                <Badge variant="outline" className="text-[10px] font-mono rounded-lg">
                  Budget: ${budgetAvailable.toFixed(1)}M
                </Badge>
              )}
              {showToggle && (
                <ToggleGroup type="single" value={fcBcFilter} onValueChange={(v) => v && setFcBcFilter(v as "ALL" | "FC" | "BC")}>
                  <ToggleGroupItem value="ALL" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 dark:data-[state=on]:bg-muted dark:data-[state=on]:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground">All</ToggleGroupItem>
                  <ToggleGroupItem value="FC" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground">FC</ToggleGroupItem>
                  <ToggleGroupItem value="BC" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">BC</ToggleGroupItem>
                </ToggleGroup>
              )}
              {!showToggle && (
                <Badge variant={swapPlayerPosition === "FC" ? "destructive" : "default"} className="text-[10px] rounded-lg">
                  {swapPlayerPosition} only
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_140px] gap-2 shrink-0 mt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search player or team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 rounded-lg"
              />
            </div>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="rounded-lg h-10 text-xs font-heading uppercase">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL" className="text-xs font-heading uppercase">All Teams</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs font-heading uppercase">
                    {t}{(teamCounts[t] || 0) > 0 ? ` · ${teamCounts[t]}/2` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {teamFilter !== "ALL" && (
            <div className="mt-2 flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full border border-border bg-muted/50 text-[10px] uppercase tracking-wider font-heading">
                {teamFilter}
                <button
                  type="button"
                  onClick={() => setTeamFilter("ALL")}
                  className="hover:text-destructive"
                  aria-label="Clear team filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              {showCourtPreview && totalPicked < 10 && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Still need {Math.max(0, 5 - fcPicked)} FC / {Math.max(0, 5 - bcPicked)} BC
                </span>
              )}
            </div>
          )}
          {warningMessage && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p className="text-[11px] uppercase tracking-wider font-heading leading-snug">{warningMessage}</p>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2 mt-2">
            <div className="space-y-0">
              {available.map((p) => {
                const teamLogo = getTeamLogo(p.core.team);
                const teamFull = (teamCounts[p.core.team] || 0) >= 2;
                const overBudget = budgetAvailable != null && p.core.salary > budgetAvailable;
                const groupFull =
                  showCourtPreview &&
                  ((p.core.fc_bc === "FC" && fcPicked >= 5) ||
                    (p.core.fc_bc === "BC" && bcPicked >= 5));
                const isDisabled = teamFull || overBudget || groupFull;
                const seasonFp = (p.season as any)?.fp ?? 0;
                return (
                  <button
                    key={p.core.id}
                    onClick={() => { if (isDisabled) return; handleSelect(p); }}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-2 py-2 border-b transition-colors text-left group relative overflow-hidden ${
                      isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    }`}
                    title={
                      groupFull
                        ? `${p.core.fc_bc} slots full (5/5)`
                        : teamFull
                        ? "Max 2 players per NBA team"
                        : overBudget
                        ? "Exceeds budget"
                        : undefined
                    }
                  >
                    {teamLogo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] group-hover:opacity-[0.18] transition-opacity duration-300">
                        <img src={teamLogo} alt="" className="w-14 h-14 transition-transform duration-300 group-hover:scale-125" />
                      </div>
                    )}
                    {p.core.photo ? (
                      <img src={p.core.photo} alt={p.core.name} className="w-9 h-9 rounded-full object-cover bg-muted relative z-10 transition-transform duration-200 group-hover:scale-110" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground relative z-10 transition-transform duration-200 group-hover:scale-110">
                        {p.core.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-heading font-semibold uppercase truncate">{p.core.name}</p>
                        <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 h-3.5 rounded-lg shrink-0">
                          {p.core.fc_bc}
                        </Badge>
                        {teamFull && (
                          <span className="text-[8px] text-destructive font-semibold shrink-0">MAX 2</span>
                        )}
                        {overBudget && !teamFull && (
                          <span className="text-[8px] text-destructive font-semibold shrink-0">OVER BUDGET</span>
                        )}
                        {groupFull && !teamFull && !overBudget && (
                          <span className="text-[8px] text-destructive font-semibold shrink-0">{p.core.fc_bc} FULL</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold">{p.core.team}</span>
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-sm font-mono font-semibold">${p.core.salary}</p>
                      <p className="text-[10px] text-muted-foreground">FP: {Number(seasonFp).toFixed(1)}</p>
                    </div>
                  </button>
                );
              })}
              {available.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 font-body">No players found</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — landscape court preview */}
        {showCourtPreview && (
          <CourtPreviewPanel
            picks={picks}
            bankRemaining={bankRemaining ?? 0}
            onRemove={(id) => {
              const player = picks.find((p) => p.core.id === id);
              if (player) setPendingRemove(player);
            }}
            rosterTeams={rosterTeams}
            lastPickId={lastPickId}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            canConfirm={canConfirm}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(v) => { if (!v) setPendingRemove(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading uppercase tracking-wider">
              Remove {pendingRemove?.core.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll free <span className="font-mono font-semibold">${pendingRemove?.core.salary}M</span> and one{" "}
              <span className="font-semibold">{pendingRemove?.core.fc_bc}</span> slot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemove) onRemovePick?.(pendingRemove.core.id);
                setPendingRemove(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function CourtPreviewPanel({
  picks,
  bankRemaining,
  onRemove,
  rosterTeams,
  lastPickId,
  muted,
  onToggleMute,
  canConfirm,
  onConfirm,
}: {
  picks: PlayerListItem[];
  bankRemaining: number;
  onRemove: (id: number) => void;
  rosterTeams: string[];
  lastPickId: number | null;
  muted: boolean;
  onToggleMute: () => void;
  canConfirm: boolean;
  onConfirm?: () => void;
}) {
  const fcs = picks.filter((p) => p.core.fc_bc === "FC").slice(0, 5);
  const bcs = picks.filter((p) => p.core.fc_bc === "BC").slice(0, 5);

  // Always render 5 FC slots top + 5 BC slots bottom — matches Starting 5 / TOTW
  const fcPositions = getRowPositions(5, "28%");
  const bcPositions = getRowPositions(5, "72%");

  const budgetClass =
    bankRemaining > 0 ? "text-emerald-500" : bankRemaining < 0 ? "text-destructive" : "text-foreground";

  const isFull = picks.length >= 10;
  const fcMaxed = fcs.length >= 5;
  const bcMaxed = bcs.length >= 5;
  const budgetOk = bankRemaining >= 0;

  return (
    <div className="flex flex-col min-h-0 p-3 bg-muted/40">
      {/* Premium glassmorphic chips */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <div className="grid grid-cols-4 gap-1.5 flex-1">
          {/* Picked */}
          <div
            className={`group relative h-10 px-3 rounded-xl flex items-center justify-between gap-2 backdrop-blur-md border transition-all ${
              isFull
                ? "bg-accent/25 border-accent text-accent shadow-[0_0_28px_-6px_hsl(var(--accent))] animate-[pulse_2.4s_ease-in-out_infinite]"
                : "bg-black/40 border-white/10 text-foreground/90"
            }`}
          >
            <Users className="h-3.5 w-3.5 opacity-80" />
            <span className="text-[9px] uppercase tracking-[0.25em] font-heading opacity-70">Picked</span>
            <span className="font-mono font-black text-sm tabular-nums ml-auto">{picks.length}<span className="opacity-50 text-[10px]">/10</span></span>
          </div>
          {/* Budget */}
          <div
            className={`group relative h-10 px-3 rounded-xl flex items-center justify-between gap-2 backdrop-blur-md border transition-all ${
              budgetOk
                ? "bg-black/40 border-emerald-500/40"
                : "bg-destructive/15 border-destructive/60 animate-[pulse_1.6s_ease-in-out_infinite]"
            }`}
          >
            <Wallet className={`h-3.5 w-3.5 ${budgetOk ? "text-emerald-500" : "text-destructive"}`} />
            <span className="text-[9px] uppercase tracking-[0.25em] font-heading opacity-70">Bank</span>
            <span className={`font-mono font-black text-sm tabular-nums ml-auto ${budgetClass}`}>${bankRemaining.toFixed(1)}M</span>
          </div>
          {/* FC */}
          <div
            className={`group relative h-10 px-3 rounded-xl flex items-center justify-between gap-2 backdrop-blur-md border transition-all ${
              fcMaxed
                ? "bg-destructive/25 border-destructive shadow-[0_0_24px_-8px_hsl(var(--destructive))]"
                : "bg-destructive/10 border-destructive/40 text-destructive"
            }`}
          >
            <ShieldHalf className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[9px] uppercase tracking-[0.25em] font-heading text-destructive/80">FC</span>
            <span className="font-mono font-black text-sm tabular-nums ml-auto text-destructive">{fcs.length}<span className="opacity-50 text-[10px]">/5</span></span>
          </div>
          {/* BC */}
          <div
            className={`group relative h-10 px-3 rounded-xl flex items-center justify-between gap-2 backdrop-blur-md border transition-all ${
              bcMaxed
                ? "bg-primary/25 border-primary shadow-[0_0_24px_-8px_hsl(var(--primary))]"
                : "bg-primary/10 border-primary/40 text-primary"
            }`}
          >
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] uppercase tracking-[0.25em] font-heading text-primary/80">BC</span>
            <span className="font-mono font-black text-sm tabular-nums ml-auto text-primary">{bcs.length}<span className="opacity-50 text-[10px]">/5</span></span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute crowd cheer" : "Mute crowd cheer"}
          title={muted ? "Sound off" : "Sound on"}
          className="h-10 w-10 inline-flex items-center justify-center rounded-xl backdrop-blur-md bg-black/40 border border-white/10 text-foreground/70 hover:text-foreground hover:bg-black/60 transition-colors shrink-0"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Landscape court — fills the remaining vertical space */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative w-full h-full rounded-lg overflow-hidden"
          style={{
            backgroundImage: `url(${courtBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span className="text-white/10 text-2xl font-heading font-bold uppercase tracking-[0.3em]">
              Your Squad
            </span>
          </div>

          {/* Cinematic dimmer when a player is mid-intro */}
          <AnimatePresence>
            {lastPickId !== null && (
              <motion.div
                key="dimmer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 bg-black/55 z-15 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* FC row (top) */}
          {fcPositions.map((pos, i) => (
            <CourtSlot
              key={`fc-${i}`}
              player={fcs[i] ?? null}
              position={pos}
              fallbackLabel="FC"
              onRemove={onRemove}
              isLastPick={!!fcs[i] && fcs[i].core.id === lastPickId}
            />
          ))}

          {/* BC row (bottom) */}
          {bcPositions.map((pos, i) => (
            <CourtSlot
              key={`bc-${i}`}
              player={bcs[i] ?? null}
              position={pos}
              fallbackLabel="BC"
              onRemove={onRemove}
              isLastPick={!!bcs[i] && bcs[i].core.id === lastPickId}
            />
          ))}

          {/* Completion CTA — appears once 10 players are picked */}
          <AnimatePresence>
            {isFull && lastPickId === null && (
              <motion.div
                key="confirm-cta"
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
              >
                <button
                  type="button"
                  onClick={() => onConfirm?.()}
                  disabled={!canConfirm || !onConfirm}
                  className={`pointer-events-auto group relative inline-flex items-center gap-3 h-16 px-10 rounded-full font-heading uppercase tracking-[0.3em] text-base transition-all ${
                    canConfirm
                      ? "bg-accent text-accent-foreground shadow-[0_0_60px_-10px_hsl(var(--accent))] hover:scale-105 hover:shadow-[0_0_80px_-10px_hsl(var(--accent))] animate-[pulse_2.4s_ease-in-out_infinite]"
                      : "bg-background/80 backdrop-blur-md border border-destructive/60 text-destructive cursor-not-allowed"
                  }`}
                  title={canConfirm ? "Save current roster" : "Need 5 FC + 5 BC and within budget"}
                >
                  <Check className="h-5 w-5" />
                  {canConfirm ? "Save Current Roster" : "Fix roster to save"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Schedule preview — collapsible */}
      <SchedulePreview rosterTeams={rosterTeams} />
    </div>
  );
}

function CourtSlot({
  player,
  position,
  fallbackLabel,
  onRemove,
  isLastPick,
}: {
  player: PlayerListItem | null;
  position: { top: string; left: string };
  fallbackLabel: string;
  onRemove: (id: number) => void;
  isLastPick: boolean;
}) {
  const isFc = fallbackLabel === "FC";
  const teamLogo = player ? getTeamLogo(player.core.team) : undefined;

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${isLastPick ? "z-30" : "z-10"}`}
      style={{ top: position.top, left: position.left, width: "17%" }}
    >
      {!player ? (
        <div className="aspect-square w-full rounded-full bg-black/30 border border-dashed border-white/30 flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-wider text-white/40">{fallbackLabel}</span>
        </div>
      ) : (
        <motion.div
          key={player.core.id}
          initial={isLastPick ? { scale: 0.4, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.6 }}
          className="relative w-full group"
          style={
            isLastPick
              ? { filter: "drop-shadow(0 0 28px hsl(var(--nba-yellow) / 0.85))" }
              : undefined
          }
        >
          {/* Spotlight halo for the freshly picked player */}
          {isLastPick && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0.6, 0], scale: [0.6, 1.6, 1.4, 1.2] }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--nba-yellow) / 0.55) 0%, hsl(var(--nba-yellow) / 0.25) 40%, transparent 70%)",
              }}
            />
          )}

          <div className="relative aspect-square w-full" title={player.core.team}>
            {player.core.photo ? (
              <img
                src={player.core.photo}
                alt={player.core.name}
                className="absolute inset-0 aspect-square w-full rounded-full object-cover bg-black/30 shadow-md transition-opacity duration-200 group-hover:opacity-0"
              />
            ) : (
              <div className="absolute inset-0 aspect-square w-full rounded-full bg-black/40 flex items-center justify-center text-[12px] font-heading font-bold text-white/80 transition-opacity duration-200 group-hover:opacity-0">
                {player.core.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {teamLogo && (
              <img
                src={teamLogo}
                alt={player.core.team}
                className="absolute inset-0 aspect-square w-full object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
              />
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(player.core.id); }}
            aria-label={`Remove ${player.core.name}`}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow opacity-90 hover:opacity-100 hover:scale-110 transition-all z-20"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="mt-1 text-xs text-center text-white font-heading font-bold truncate drop-shadow leading-tight">
            {(() => {
              const parts = player.core.name.trim().split(/\s+/);
              return parts.length === 1 ? parts[0].toUpperCase() : `${parts[0][0]}.${parts[parts.length - 1]}`.toUpperCase();
            })()}
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className={`inline-flex items-center justify-center px-1.5 h-4 rounded text-[10px] font-heading font-bold ${isFc ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
              {player.core.fc_bc}
            </span>
            <span className="text-[11px] text-white font-mono font-bold drop-shadow">${player.core.salary}M</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function SchedulePreview({ rosterTeams }: { rosterTeams: string[] }) {
  const initial = useMemo(() => getCurrentGameday(), []);
  const [gw, setGw] = useState<number>(initial.gw);
  const [open, setOpen] = useState(false);

  const { data: games = [], isLoading } = useScheduleWeekGames(gw);

  const daysWithGames = useMemo(() => {
    const set = new Set<number>();
    for (const g of games) set.add(g.day);
    return Array.from(set).sort((a, b) => a - b);
  }, [games]);

  const [day, setDay] = useState<number>(initial.day);
  useEffect(() => {
    if (daysWithGames.length === 0) return;
    if (!daysWithGames.includes(day)) setDay(daysWithGames[0]);
  }, [daysWithGames, day]);

  const dayGames = useMemo(
    () => games.filter((g) => g.day === day).sort((a, b) => (a.tipoff_utc ?? "").localeCompare(b.tipoff_utc ?? "")),
    [games, day]
  );

  const rosterTeamSet = useMemo(() => new Set(rosterTeams), [rosterTeams]);

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 shrink-0">
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 h-9 rounded-lg bg-black/40 border border-white/10 text-foreground/80 hover:text-foreground hover:bg-black/60 transition-colors">
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-heading">
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule · GW{gw}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-lg bg-black/30 border border-white/10 p-2.5">
        {/* GW selector */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => setGw((g) => Math.max(1, g - 1))}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/40 border border-white/10 hover:bg-black/60 disabled:opacity-30"
            disabled={gw <= 1}
            aria-label="Previous gameweek"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] uppercase tracking-[0.25em] font-heading text-foreground/80">GW {gw}</span>
          <button
            type="button"
            onClick={() => setGw((g) => g + 1)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/40 border border-white/10 hover:bg-black/60"
            aria-label="Next gameweek"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day chips */}
        {daysWithGames.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {daysWithGames.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`h-6 px-2 rounded-md text-[10px] uppercase tracking-wider font-heading transition-colors ${
                  d === day
                    ? "bg-accent text-accent-foreground"
                    : "bg-black/40 border border-white/10 text-foreground/60 hover:text-foreground hover:bg-black/60"
                }`}
              >
                D{d}
              </button>
            ))}
          </div>
        )}

        {/* Matchups */}
        {isLoading ? (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center">Loading…</p>
        ) : dayGames.length === 0 ? (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center">No games</p>
        ) : (
          <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto">
            {dayGames.map((g) => {
              const homeLogo = getTeamLogo(g.home_team);
              const awayLogo = getTeamLogo(g.away_team);
              const involved = rosterTeamSet.has(g.home_team) || rosterTeamSet.has(g.away_team);
              return (
                <div
                  key={g.game_id}
                  className={`flex items-center justify-between gap-2 px-2 h-7 rounded-md bg-black/30 ${
                    involved ? "border-l-2 border-l-[hsl(var(--nba-yellow))]" : "border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {awayLogo && <img src={awayLogo} alt={g.away_team} className="h-4 w-4 object-contain" />}
                    <span className="text-[10px] font-mono font-bold text-foreground/90">{g.away_team}</span>
                    <span className="text-[9px] text-muted-foreground">@</span>
                    {homeLogo && <img src={homeLogo} alt={g.home_team} className="h-4 w-4 object-contain" />}
                    <span className="text-[10px] font-mono font-bold text-foreground/90">{g.home_team}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{fmtTime(g.tipoff_utc)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
