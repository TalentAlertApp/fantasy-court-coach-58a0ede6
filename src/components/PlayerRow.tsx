import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight, GripVertical, Star } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { formatTipoffLabel, type UpcomingGame } from "@/hooks/useUpcomingByTeam";
import { difficultyRingColor, slotTooltip } from "@/lib/ballers-iq/difficultyColor";
import type { BIQTeamDifficulty } from "@/lib/ballers-iq/types";
import { formatSalary, formatStat } from "@/lib/format-salary";
import { useLeague } from "@/contexts/LeagueContext";
import { normalizePlayerHealth } from "@/lib/health";
import HealthStatusIcon from "@/components/health/HealthStatusIcon";
import HealthTooltip from "@/components/health/HealthTooltip";
import React from "react";
import NationalityFlag from "@/components/NationalityFlag";
import { countryLabel } from "@/lib/nationality";
import { salaryDeltaColor, salaryDeltaTooltip } from "@/lib/salary-delta";
import PlayerContextBadges, { type PlayerBadge } from "@/components/transactions/PlayerContextBadges";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerRowProps {
  player: PlayerListItem;
  onClick?: () => void;
  onSwap?: () => void;
  /** When true, a clickable Captain star is shown after the player name. */
  isCaptain?: boolean;
  /** Toggles captain on/off for this player. */
  onSetCaptain?: () => void;
  actionButton?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /** One slot per gameday in the current gameweek. */
  weekSlots?: (UpcomingGame | null)[];
  difficultyMap?: Record<string, BIQTeamDifficulty>;
  onSlotClick?: (g: UpcomingGame) => void;
  gameLogs?: Record<string, { fp: number; mp: number; pts: number }>;
  /** Hide the College column (e.g. EuroLeague). Default true (show). */
  showCollege?: boolean;
  /** Optional market-status badges (matches /transactions). When provided,
   *  a "Market" column is rendered right after Health. */
  badges?: PlayerBadge[];
  showBadgesColumn?: boolean;
}

export default function PlayerRow({ player, onClick, onSwap, isCaptain, onSetCaptain, actionButton, draggable, onDragStart, onDragOver, onDrop, onDragEnd, weekSlots, difficultyMap, onSlotClick, gameLogs, showCollege = true, badges, showBadgesColumn }: PlayerRowProps) {
  const { core, last5, lastGame, computed } = player;
  const { isWnba } = useLeague();
  const teamLogo = getTeamLogo(core.team);
  const totalFp = (player.season as any)?.total_fp ?? ((player.season as any)?.fp ?? 0) * (player.season?.gp ?? 0);
  const health = normalizePlayerHealth(player);
  const d1 = (core as any).last_salary_delta as number | undefined;
  const d7 = (core as any).salary_delta_7d as number | undefined;
  const salaryToneCls = salaryDeltaColor(d1);
  const salaryTip = salaryDeltaTooltip(d1, d7);
  // Pre-season heuristic: no games played anywhere → dash out perf stats.
  const preseason = isWnba && Number((player.season as any)?.gp ?? 0) === 0
    && Number(last5?.fp5 ?? 0) === 0;

  const dobLabel = (() => {
    if (!core.dob) return "—";
    try {
      const d = new Date(core.dob);
      if (isNaN(d.getTime())) return "—";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(2);
      return `${dd}/${mm}/${yy}`;
    } catch { return "—"; }
  })();

  return (
    <TableRow
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-primary/5 group border-b border-border/40"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <TableCell className="px-2">
        <div className="flex items-center gap-2">
          {draggable && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing flex-shrink-0" />
          )}
          {core.photo ? (
            <img
              src={core.photo}
              alt={core.name}
              className="w-10 h-10 rounded-lg object-cover object-[center_15%] bg-muted ring-1 ring-border/60 group-hover:ring-primary/40 transition"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold uppercase leading-tight tracking-wide group-hover:text-primary transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
              <span>{core.name}</span>
              {isCaptain && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSetCaptain?.(); }}
                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--nba-yellow))] text-black shadow leading-none shrink-0 hover:opacity-80 transition-opacity"
                  title="Captain — click to remove"
                >
                  <Star className="h-2.5 w-2.5 fill-current" />
                </button>
              )}
            </p>
            <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5 flex-nowrap whitespace-nowrap mt-0.5">
              {teamLogo && <img src={teamLogo} alt={core.team} className="w-4 h-4" />}
              <span>{core.team}</span>
              {weekSlots && weekSlots.length > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  {weekSlots.map((day, i) => {
                    const diff = day ? difficultyMap?.[day.opponent] : undefined;
                    const isFinal = day ? /FINAL/i.test(String(day.status ?? "")) : false;
                    let ring = day ? difficultyRingColor(diff?.label) : "hsl(var(--border))";
                    let tip: string;
                    if (day && isFinal) {
                      const playerIsHome = core.team === day.homeTeam;
                      const myPts = playerIsHome ? (day.homePts ?? 0) : (day.awayPts ?? 0);
                      const oppPts = playerIsHome ? (day.awayPts ?? 0) : (day.homePts ?? 0);
                      const won = (myPts ?? 0) > (oppPts ?? 0);
                      ring = won ? "hsl(142 76% 45%)" : "hsl(0 84% 60%)";
                      const venue = day.isHome ? "vs" : "@";
                      const result = won ? "W" : "L";
                      const log = day.gameId ? gameLogs?.[day.gameId] : undefined;
                      const fpPart = log ? ` · FP ${log.fp.toFixed(1)}` : "";
                      tip = `${venue} ${day.opponent} — ${result} ${myPts}-${oppPts}${fpPart}`;
                    } else {
                      tip = slotTooltip(
                        day?.opponent ?? null,
                        !!day?.isHome,
                        day ? formatTipoffLabel(day.tipoffUtc) : undefined,
                        diff?.label,
                        diff?.score,
                      );
                    }
                    const oppLogo = day ? getTeamLogo(day.opponent) : null;
                    const clickable = !!day && !!onSlotClick;
                    return (
                      <div
                        key={i}
                        role={clickable ? "button" : undefined}
                        onClick={clickable ? (e) => { e.stopPropagation(); onSlotClick!(day!); } : undefined}
                        className={`w-5 h-5 relative z-10 group/slot rounded-full flex items-center justify-center bg-background/60 overflow-visible ${clickable ? "cursor-pointer hover:z-30" : ""}`}
                        style={{ border: `2px solid ${ring}` }}
                        title={tip}
                      >
                        {day ? (
                          oppLogo ? (
                            <img src={oppLogo} alt={day.opponent} className="w-3 h-3 object-contain transition-transform duration-200 origin-center group-hover/slot:scale-[2.2] group-hover/slot:-translate-y-0.5 group-hover/slot:drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                          ) : (
                            <span className="text-[6px] font-bold">{day.opponent}</span>
                          )
                        ) : (
                          <span className="text-[6px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-1.5 text-center w-[96px] text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {dobLabel} ({core.age || "—"})
      </TableCell>
      <TableCell className="px-1.5 text-center w-12 text-[11px] text-muted-foreground">{core.height ?? "—"}</TableCell>
      {showCollege && (
        <TableCell className="px-1.5 w-32 text-[11px] text-muted-foreground whitespace-nowrap truncate max-w-[128px]" title={core.college ?? undefined}>
          {core.college ?? "—"}
        </TableCell>
      )}
      <TableCell className="px-1.5 w-36 text-[11px] text-muted-foreground whitespace-nowrap truncate max-w-[144px]" title={countryLabel(core.nationality) ?? undefined}>
        {core.nationality ? (
          <span className="inline-flex items-center gap-1.5 truncate">
            <NationalityFlag country={core.nationality} size="xs" />
            <span className="truncate">{countryLabel(core.nationality)}</span>
          </span>
        ) : "—"}
      </TableCell>
      <TableCell className="px-1.5 text-center w-14">
        <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[9px] rounded-lg">
          {core.fc_bc}
        </Badge>
      </TableCell>
      <TableCell className="px-1.5 text-center w-12">
        {health.status ? (
          <HealthTooltip health={health}>
            <span className="inline-flex"><HealthStatusIcon health={health} size="sm" /></span>
          </HealthTooltip>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">—</span>
        )}
      </TableCell>
      {showBadgesColumn && (
        <TableCell className="px-1.5 text-center w-[110px]">
          {badges && badges.length > 0 ? (
            <PlayerContextBadges badges={badges} max={3} className="justify-center" />
          ) : (
            <span className="text-[11px] text-muted-foreground/50">—</span>
          )}
        </TableCell>
      )}
      <TableCell title={salaryTip} className={`px-1.5 text-right text-[11px] w-[68px] tabular-nums font-bold ${salaryToneCls || "text-muted-foreground"}`}>{formatSalary(core.salary)}</TableCell>
      <TableCell className="px-1.5 text-right text-[11px] text-muted-foreground w-14 tabular-nums">{formatStat(last5?.fp5, 1, preseason)}</TableCell>
      <TableCell className="px-1.5 text-right text-[11px] text-muted-foreground w-14 tabular-nums">{formatStat(computed?.value5, 1, preseason)}</TableCell>
      <TableCell className="px-1.5 text-right text-[11px] text-muted-foreground w-14 tabular-nums">{formatStat(lastGame?.fp, 1, preseason)}</TableCell>
      <TableCell className="px-1.5 text-right text-[11px] text-foreground font-bold w-14 tabular-nums">{formatStat(totalFp, 0, preseason)}</TableCell>
      <TableCell className="px-1.5 text-right w-8">
        {onSwap && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            title="Swap player"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {actionButton}
      </TableCell>
    </TableRow>
  );
}
