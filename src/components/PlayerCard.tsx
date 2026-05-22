import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight, GripVertical, Star } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import type { UpcomingGame } from "@/hooks/useUpcomingByTeam";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import { difficultyRingColor, slotTooltip } from "@/lib/ballers-iq/difficultyColor";
import type { BIQTeamDifficulty } from "@/lib/ballers-iq/types";
import { normalizePlayerHealth, isHealthUnavailable, isHealthRisky } from "@/lib/health";
import HealthStatusIcon from "@/components/health/HealthStatusIcon";
import HealthTooltip from "@/components/health/HealthTooltip";
import React from "react";
import { salaryDeltaColor, salaryDeltaTooltip } from "@/lib/salary-delta";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerCardProps {
  player: PlayerListItem;
  isCaptain?: boolean;
  onClick?: () => void;
  onSetCaptain?: () => void;
  onSwap?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  variant?: "court" | "bench";
  compact?: boolean;
  upcoming?: (UpcomingGame | null)[];
  difficultyMap?: Record<string, BIQTeamDifficulty>;
  onSlotClick?: (g: UpcomingGame) => void;
  /** Per-game performance (fp/mp/pts) for THIS player, keyed by game_id. */
  gameLogs?: Record<string, { fp: number; mp: number; pts: number }>;
}

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  const firstInitial = parts[0][0];
  const lastName = parts[parts.length - 1];
  return `${firstInitial}.${lastName}`.toUpperCase();
}

/**
 * Circular opponent slot. Inner = team logo; outer ring colored by difficulty
 * of the opponent (red = elite, orange = tough, blue = neutral, green = easy).
 */
function OpponentSlot({
  day, ringColor, title, size = "md", onSlotClick,
}: {
  day: UpcomingGame | null;
  ringColor?: string;
  title?: string;
  size?: "sm" | "md";
  onSlotClick?: (g: UpcomingGame) => void;
}) {
  const dim = size === "md" ? "w-7 h-7" : "w-5 h-5";
  const inner = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  const ring = ringColor ?? "hsl(var(--border))";
  const logo = day ? getTeamLogo(day.opponent) : null;
  const clickable = !!day && !!onSlotClick;
  return (
    <div
      role={clickable ? "button" : undefined}
      onClick={clickable ? (e) => { e.stopPropagation(); onSlotClick!(day!); } : undefined}
      className={`${dim} relative z-10 group/slot rounded-full flex items-center justify-center bg-background/60 backdrop-blur-sm overflow-visible ${clickable ? "cursor-pointer hover:z-30" : ""}`}
      style={{ border: `2px solid ${ring}`, boxShadow: day ? `0 0 0 1px hsl(var(--background))` : undefined }}
      title={title}
    >
      {day ? (
        logo ? (
          <img src={logo} alt={day.opponent} className={`${inner} object-contain transition-transform duration-200 origin-center group-hover/slot:scale-[1.9] group-hover/slot:-translate-y-0.5 group-hover/slot:drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]`} />
        ) : (
          <span className="text-[7px] font-bold text-foreground">{day.opponent}</span>
        )
      ) : (
        <span className="text-[7px] text-muted-foreground/40">—</span>
      )}
    </div>
  );
}

export default function PlayerCard({
  player, isCaptain, onClick, onSetCaptain, onSwap, draggable,
  onDragStart, onDragOver, onDrop, onDragEnd, variant, compact, upcoming, difficultyMap, onSlotClick, gameLogs,
}: PlayerCardProps) {
  const { core } = player;
  const isFc = core.fc_bc === "FC";
  const accentColor = isFc ? "border-destructive" : "border-primary";
  const teamLogo = getTeamLogo(core.team);
  const v5 = (player.computed as any)?.value5;
  const d1 = (core as any).last_salary_delta as number | undefined;
  const d7 = (core as any).salary_delta_7d as number | undefined;
  const salaryToneCls = salaryDeltaColor(d1);
  const salaryTip = salaryDeltaTooltip(d1, d7);

  // Normalized health → drives compact indicator + subtle card-tone signal.
  const health = normalizePlayerHealth(player);
  const isOut = isHealthUnavailable(health);
  const isRisky = isHealthRisky(health);

  // Slots = one per gameday in the current GW (already pre-bucketed by parent).
  const slots = upcoming ?? [];

  const slotFor = (day: UpcomingGame | null) => {
    if (!day) {
      return { ringColor: "hsl(var(--border))", title: slotTooltip(null, false) };
    }
    const isFinal = /FINAL/i.test(String(day.status ?? ""));
    if (isFinal) {
      const playerIsHome = core.team === day.homeTeam;
      const myPts = playerIsHome ? (day.homePts ?? 0) : (day.awayPts ?? 0);
      const oppPts = playerIsHome ? (day.awayPts ?? 0) : (day.homePts ?? 0);
      const won = (myPts ?? 0) > (oppPts ?? 0);
      const ringColor = won ? "hsl(142 76% 45%)" : "hsl(0 84% 60%)";
      const venue = day.isHome ? "vs" : "@";
      const result = won ? "W" : "L";
      const log = day.gameId ? gameLogs?.[day.gameId] : undefined;
      const fpPart = log ? ` · FP ${log.fp.toFixed(1)}` : "";
      const title = `${venue} ${day.opponent} — ${result} ${myPts}-${oppPts}${fpPart}`;
      return { ringColor, title };
    }
    const diff = difficultyMap?.[day.opponent];
    return {
      ringColor: difficultyRingColor(diff?.label),
      title: slotTooltip(day.opponent, day.isHome, formatTipoffLabel(day.tipoffUtc), diff?.label, diff?.score),
    };
  };

  const resolvedVariant = variant ?? "court";

  // ─── BENCH VARIANT ───
  if (resolvedVariant === "bench") {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`bg-card/95 backdrop-blur-sm border-l-2 ${accentColor} rounded-xl cursor-pointer hover:ring-1 hover:ring-accent/50 hover:shadow-lg transition-all duration-200 relative group overflow-hidden ${
          isOut ? "ring-1 ring-red-500/40" : isRisky ? "ring-1 ring-amber-400/30" : ""
        }`}
      >
        {isCaptain && <span className="absolute top-0 right-1 text-xs z-10" title="Captain">⭐</span>}
        {onSetCaptain && !isCaptain && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetCaptain(); }}
            className="absolute top-0 right-5 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(var(--nba-yellow))]/80 text-black rounded-lg p-0.5 hover:bg-[hsl(var(--nba-yellow))] z-10"
            title="Set as captain"
          >
            <Star className="h-2.5 w-2.5" />
          </button>
        )}

        {draggable && (
          <div className="absolute top-1 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-10">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {onSwap && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-lg p-0.5 hover:bg-accent/80 z-10"
            title="Swap player"
          >
            <ArrowLeftRight className="h-2.5 w-2.5" />
          </button>
        )}

        <div className="flex items-stretch">
          {teamLogo && (
            <div className="w-12 shrink-0 flex items-center justify-center bg-muted/30 rounded-l-xl">
              <img src={teamLogo} alt={core.team} className="w-9 h-9 transition-transform group-hover:scale-110" />
            </div>
          )}
          <div className="flex-1 px-2 py-1.5 min-w-0">
            <p className="text-sm font-heading font-bold leading-tight flex items-center gap-1 min-w-0">
              <span className="truncate">{formatShortName(core.name)}</span>
              {health.status && (
                <HealthTooltip health={health} side="left">
                  <span className="inline-flex shrink-0"><HealthStatusIcon health={health} size="xs" /></span>
                </HealthTooltip>
              )}
            </p>

            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={isFc ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg h-3.5 shrink-0">
                {core.fc_bc}
              </Badge>
              <span title={salaryTip} className={`rounded-md bg-card/80 border border-border/40 px-1.5 h-3.5 inline-flex items-center text-[10px] font-mono shrink-0 font-bold ${salaryToneCls || "text-foreground"}`}>
                ${core.salary}
              </span>
              {v5 != null && (
                <span className="rounded-md bg-card/80 border border-border/40 px-1.5 h-3.5 inline-flex items-center text-[10px] font-mono text-foreground shrink-0">
                  {Number(v5).toFixed(1)}
                </span>
              )}

              {upcoming && slots.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {slots.map((day, i) => {
                    const meta = slotFor(day);
                    return <OpponentSlot key={i} day={day} ringColor={meta.ringColor} title={meta.title} size="sm" onSlotClick={onSlotClick} />;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── COURT VARIANT — CINEMATIC ───
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-pointer group relative flex flex-col items-center ${
        isOut ? "drop-shadow-[0_0_10px_rgba(239,68,68,0.35)]" : ""
      }`}
      style={{ minWidth: 0 }}
    >
      {/* Top-center action cluster — Captain (left) + Swap (right) for consistent UX */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
        {isCaptain ? (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[hsl(var(--nba-yellow))] text-black shadow-lg text-base leading-none" title="Captain">
            ⭐
          </span>
        ) : onSetCaptain ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSetCaptain(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center h-7 w-7 rounded-full bg-[hsl(var(--nba-yellow))]/80 text-black hover:bg-[hsl(var(--nba-yellow))] shadow-lg"
            title="Set as captain"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onSwap && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/70 text-white hover:bg-black/90 shadow-lg"
            title="Swap player"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {draggable && (
        <div className="absolute top-0 left-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-20">
          <GripVertical className="h-4 w-4 text-white/70" />
        </div>
      )}

      {/* Team logo watermark behind player */}
      {/* Photo — large, cinematic, NO circle border */}
      <div className="relative z-10">
        {core.photo ? (
          <img
            src={core.photo}
            alt={core.name}
            className={`w-28 h-28 md:w-36 md:h-36 rounded-full object-cover object-[center_15%] bg-black/20 shadow-2xl transition-transform duration-300 group-hover:scale-110 ${
              isOut ? "ring-2 ring-red-500/70" : isRisky ? "ring-2 ring-amber-400/60" : ""
            }`}
          />
        ) : (
          <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-black/40 flex items-center justify-center text-2xl font-heading font-bold text-white/80 ${
            isOut ? "ring-2 ring-red-500/70" : isRisky ? "ring-2 ring-amber-400/60" : ""
          }`}>
            {core.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        {teamLogo && (
          <img
            src={teamLogo}
            alt={core.team}
            className="absolute -top-0.5 -right-0.5 w-7 h-7 object-contain drop-shadow-md pointer-events-none"
          />
        )}
      </div>

      {/* Name — bold, cinematic, larger */}
      <p className="text-sm md:text-base font-heading font-bold text-center text-white drop-shadow-lg leading-tight mt-1.5 max-w-full z-10 inline-flex items-center justify-center gap-1">
        <span className="truncate">{formatShortName(core.name)}</span>
        {health.status && (
          <HealthTooltip health={health} side="bottom">
            <span className="inline-flex shrink-0"><HealthStatusIcon health={health} size="sm" /></span>
          </HealthTooltip>
        )}
      </p>

      {/* FC/BC badge + salary + V5 — pill containers matching /transactions style */}
      <div className="flex items-center justify-center gap-1.5 mt-1 z-10">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[9px] px-1.5 py-0 rounded h-4 shadow-md">
          {core.fc_bc}
        </Badge>
        <span title={salaryTip} className={`rounded-md bg-card/80 border border-border/40 px-1.5 h-4 inline-flex items-center text-xs font-mono font-bold ${salaryToneCls || "text-foreground"}`}>
          ${core.salary}
        </span>
        {v5 != null && (
          <span className="rounded-md bg-card/80 border border-border/40 px-1.5 h-4 inline-flex items-center text-xs font-mono text-foreground">
            {Number(v5).toFixed(1)}
          </span>
        )}
      </div>

      {/* Gameweek opponent slots — one per gameday */}
      {upcoming && slots.length > 0 && (
        <div className="flex items-center justify-center gap-1 mt-2 z-10">
          {slots.map((day, i) => {
            const meta = slotFor(day);
            return <OpponentSlot key={i} day={day} ringColor={meta.ringColor} title={meta.title} size="md" onSlotClick={onSlotClick} />;
          })}
        </div>
      )}
    </div>
  );
}
