import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, X, Volume2, VolumeX } from "lucide-react";
import { Users, Wallet, ShieldHalf, Target, Check } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { getRowPositions } from "@/lib/court-layout";
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
  const [lastPickId, setLastPickId] = useState<number | null>(null);
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

  const available = useMemo(() => {
    let filtered = allPlayers.filter((p) => !rosterIds.has(p.core.id));
    if (effectiveFilter !== "ALL") {
      filtered = filtered.filter((p) => p.core.fc_bc === effectiveFilter);
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((p) =>
      p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
    );
  }, [allPlayers, rosterIds, search, effectiveFilter]);

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
    }
  };

  // 2-column grid layout when showCourtPreview is true — much larger to give the court room
  const dialogClass = showCourtPreview
    ? "max-w-[1280px] w-[96vw] h-[min(92vh,52rem)] rounded-lg overflow-hidden p-0 grid grid-cols-[400px_minmax(0,1fr)] gap-0"
    : "max-w-md h-[min(80vh,42rem)] rounded-lg overflow-hidden p-0 flex flex-col";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(""); setFcBcFilter("ALL"); setLastPickId(null); } }}>
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
          <div className="relative shrink-0 mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 rounded-lg"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2 mt-2">
            <div className="space-y-0">
              {available.map((p) => {
                const teamLogo = getTeamLogo(p.core.team);
                const teamFull = (teamCounts[p.core.team] || 0) >= 2;
                const overBudget = budgetAvailable != null && p.core.salary > budgetAvailable;
                const isDisabled = teamFull || overBudget;
                const seasonFp = (p.season as any)?.fp ?? 0;
                return (
                  <button
                    key={p.core.id}
                    onClick={() => { if (isDisabled) return; handleSelect(p); }}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-2 py-2 border-b transition-colors text-left group relative overflow-hidden ${
                      isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    }`}
                    title={teamFull ? "Max 2 players per NBA team" : overBudget ? "Exceeds budget" : undefined}
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
            onRemove={(id) => onRemovePick?.(id)}
            lastPickId={lastPickId}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CourtPreviewPanel({
  picks,
  bankRemaining,
  onRemove,
  lastPickId,
  muted,
  onToggleMute,
}: {
  picks: PlayerListItem[];
  bankRemaining: number;
  onRemove: (id: number) => void;
  lastPickId: number | null;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const fcs = picks.filter((p) => p.core.fc_bc === "FC").slice(0, 5);
  const bcs = picks.filter((p) => p.core.fc_bc === "BC").slice(0, 5);

  // Always render 5 FC slots top + 5 BC slots bottom — matches Starting 5 / TOTW
  const fcPositions = getRowPositions(5, "28%");
  const bcPositions = getRowPositions(5, "72%");

  const budgetClass =
    bankRemaining > 0 ? "text-emerald-500" : bankRemaining < 0 ? "text-destructive" : "text-foreground";

  return (
    <div className="flex flex-col min-h-0 p-3 bg-muted/40">
      {/* Counters + mute toggle */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <div className="grid grid-cols-4 gap-1.5 text-[10px] uppercase tracking-wider font-heading flex-1">
          <span className="px-2 h-8 rounded-md bg-background/80 border text-center inline-flex items-center justify-center">
            Picked&nbsp;<span className="font-mono font-bold">{picks.length}/10</span>
          </span>
          <span className={`px-2 h-8 rounded-md bg-background/80 border text-center font-bold inline-flex items-center justify-center ${budgetClass}`}>
            ${bankRemaining.toFixed(1)}M
          </span>
          <span className="px-2 h-8 rounded-md bg-destructive/15 border border-destructive/30 text-center text-destructive inline-flex items-center justify-center">
            FC&nbsp;<span className="font-mono font-bold">{fcs.length}/5</span>
          </span>
          <span className="px-2 h-8 rounded-md bg-primary/15 border border-primary/30 text-center text-primary inline-flex items-center justify-center">
            BC&nbsp;<span className="font-mono font-bold">{bcs.length}/5</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute crowd cheer" : "Mute crowd cheer"}
          title={muted ? "Sound off" : "Sound on"}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
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
        </div>
      </div>
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

          {player.core.photo ? (
            <img
              src={player.core.photo}
              alt={player.core.name}
              className="aspect-square w-full rounded-full object-cover bg-black/30 shadow-md transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-square w-full rounded-full bg-black/40 flex items-center justify-center text-[12px] font-heading font-bold text-white/80">
              {player.core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(player.core.id); }}
            aria-label={`Remove ${player.core.name}`}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow opacity-90 hover:opacity-100 hover:scale-110 transition-all z-20"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="mt-0.5 text-[10px] text-center text-white font-heading font-bold truncate drop-shadow leading-tight">
            {(() => {
              const parts = player.core.name.trim().split(/\s+/);
              return parts.length === 1 ? parts[0].toUpperCase() : `${parts[0][0]}.${parts[parts.length - 1]}`.toUpperCase();
            })()}
          </p>
          <div className="mt-0.5 flex items-center justify-center gap-1">
            <span className={`inline-flex items-center justify-center px-1 h-3.5 rounded text-[8px] font-heading font-bold ${isFc ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
              {player.core.fc_bc}
            </span>
            <span className="text-[9px] text-white font-mono font-bold drop-shadow">${player.core.salary}M</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
