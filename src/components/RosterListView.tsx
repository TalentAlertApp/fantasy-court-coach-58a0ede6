import { z } from "zod";
import { getLeagueLogo } from "@/lib/competitions";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PlayerRow from "./PlayerRow";
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useUpcomingByTeam, getTeamGameweekSlots, type UpcomingGame } from "@/hooks/useUpcomingByTeam";
import { useTeamDifficultyMap } from "@/hooks/useTeamDifficultyMap";
import { getCurrentGameday } from "@/lib/deadlines";
import { useLeagueDeadlines, getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import { useLeague } from "@/contexts/LeagueContext";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useWishlist } from "@/hooks/useWishlist";
import { normalizePlayerHealth } from "@/lib/health";
import {
  computePlayerBadges,
  quantile,
  type BadgePoolStats,
  type PlayerBadge,
} from "@/components/transactions/PlayerContextBadges";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterListViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId?: number;
  onSetCaptain?: (id: number) => void;
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
  onDnDSwap?: (fromId: number, toId: number) => void;
  onSlotClick?: (g: UpcomingGame) => void;
  gameLogsByPlayer?: Record<number, Record<string, { fp: number; mp: number; pts: number }>>;
}

export default function RosterListView({ starters, bench, captainId, onSetCaptain, onPlayerClick, onSwap, onDnDSwap, onSlotClick, gameLogsByPlayer }: RosterListViewProps) {
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const { data: upcomingByTeam } = useUpcomingByTeam();
  const { data: difficultyMap } = useTeamDifficultyMap();
  const { deadlines } = useLeagueDeadlines();
  const currentGw = (deadlines.length > 0 ? getCurrentGamedayFrom(deadlines)?.gw : undefined) ?? getCurrentGameday().gw;
  const { league } = useLeague();
  const leagueLogo = getLeagueLogo(league);
  const showCollege = league !== "euroleague";

  // ── Market-status badges (same logic as /transactions) ────────────────
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const { wishlistIds } = useWishlist();
  const wishlistSet = useMemo(() => new Set<number>(wishlistIds ?? []), [wishlistIds]);

  const upcomingCtxByTeam = useMemo(() => {
    const out = new Map<string, { thisGw: number; next7: number }>();
    if (!upcomingByTeam) return out;
    const now = Date.now();
    const week = now + 7 * 86400_000;
    for (const [tri, games] of Object.entries(upcomingByTeam)) {
      let thisGw = 0;
      let next7 = 0;
      for (const g of games as any[]) {
        const ts = g.tipoffUtc ? new Date(g.tipoffUtc).getTime() : NaN;
        if (!Number.isFinite(ts)) continue;
        if (g.gw === currentGw && ts >= now - 6 * 3600_000) thisGw++;
        if (ts >= now - 3 * 3600_000 && ts <= week) next7++;
      }
      out.set(tri.toUpperCase(), { thisGw, next7 });
    }
    return out;
  }, [upcomingByTeam, currentGw]);

  const poolStats: BadgePoolStats = useMemo(() => {
    const pool: PlayerListItem[] = (playersData?.items as PlayerListItem[] | undefined) ?? [...starters, ...bench];
    const v5: number[] = [];
    const sal: number[] = [];
    const fp5: number[] = [];
    for (const p of pool) {
      const v = (p as any).computed?.value5 ?? (p as any).computed?.value ?? 0;
      if (v > 0) v5.push(v);
      if (p.core.salary > 0) sal.push(p.core.salary);
      const f = (p as any).last5?.fp5 ?? 0;
      if (f > 0) fp5.push(f);
    }
    return {
      value5Q75: quantile(v5, 0.75),
      salaryMedian: quantile(sal, 0.5),
      fp5P90: quantile(fp5, 0.9),
    };
  }, [playersData, starters, bench]);

  const badgesForPlayer = (p: PlayerListItem): PlayerBadge[] => {
    const upcoming = upcomingCtxByTeam.get((p.core.team ?? "").toUpperCase()) ?? null;
    return computePlayerBadges(
      {
        salary: p.core.salary,
        fc_bc: p.core.fc_bc as "FC" | "BC",
        team: p.core.team,
        fpSeason: (p.season as any)?.fp ?? 0,
        fpLast5: (p as any).last5?.fp5 ?? 0,
        mpgSeason: (p.season as any)?.mpg ?? 0,
        mpgLast5: (p as any).last5?.mpg5 ?? 0,
        value: (p as any).computed?.value ?? 0,
        value5: (p as any).computed?.value5 ?? 0,
        health: normalizePlayerHealth(p),
      },
      {
        pool: poolStats,
        upcoming,
        isOwned: true,
        isInWishlist: wishlistSet.has(p.core.id),
        rosterNeedsFc: false,
        rosterNeedsBc: false,
      },
    );
  };

  const handleDragStart = (e: React.DragEvent, playerId: number) => {
    e.dataTransfer.setData("text/plain", String(playerId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, playerId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(playerId);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = Number(e.dataTransfer.getData("text/plain"));
    if (sourceId && sourceId !== targetId && onDnDSwap) {
      onDnDSwap(sourceId, targetId);
    }
  };

  const handleDragEnd = () => setDragOverId(null);

  const header = (
    <TableHeader>
      <TableRow className="hover:bg-transparent border-b-2 border-border/60">
        <TableHead className="px-2 font-heading uppercase tracking-wider text-[10px]">Player</TableHead>
        <TableHead className="px-1.5 text-center w-[96px] font-heading uppercase tracking-wider text-[10px]" title="Date of Birth (Age)">DOB (Age)</TableHead>
        <TableHead className="px-1.5 text-center w-12 font-heading uppercase tracking-wider text-[10px]">HT</TableHead>
        {showCollege && (
          <TableHead className="px-1.5 w-32 font-heading uppercase tracking-wider text-[10px]">College</TableHead>
        )}
        <TableHead className="px-1.5 w-36 font-heading uppercase tracking-wider text-[10px]">Nation</TableHead>
        <TableHead className="px-1.5 text-center w-14 font-heading uppercase tracking-wider text-[10px]">FC/BC</TableHead>
        <TableHead className="px-1.5 text-center w-12 font-heading uppercase tracking-wider text-[10px]" title="Health status">Health</TableHead>
        <TableHead className="px-1.5 text-center w-[110px] font-heading uppercase tracking-wider text-[10px]" title="Market status — same icons as /transactions">Market</TableHead>
        <TableHead className="px-1.5 text-right w-[68px] font-heading uppercase tracking-wider text-[10px]">Salary</TableHead>
        <TableHead className="px-1.5 text-right w-14 font-heading uppercase tracking-wider text-[10px]">FP5</TableHead>
        <TableHead className="px-1.5 text-right w-14 font-heading uppercase tracking-wider text-[10px]">Value5</TableHead>
        <TableHead className="px-1.5 text-right w-14 font-heading uppercase tracking-wider text-[10px]">Last FP</TableHead>
        <TableHead className="px-1.5 text-right w-14 font-heading uppercase tracking-wider text-[10px]">Total FP</TableHead>
        <TableHead className="px-1.5 text-right w-8"></TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderRow = (p: PlayerListItem) => (
    <PlayerRow
      key={p.core.id}
      player={p}
      isCaptain={captainId != null && captainId > 0 && p.core.id === captainId}
      onSetCaptain={onSetCaptain ? () => onSetCaptain(p.core.id) : undefined}
      onClick={() => onPlayerClick(p.core.id)}
      onSwap={onSwap ? () => onSwap(p.core.id) : undefined}
      draggable
      onDragStart={(e) => handleDragStart(e, p.core.id)}
      onDragOver={(e) => handleDragOver(e, p.core.id)}
      onDrop={(e) => handleDrop(e, p.core.id)}
      onDragEnd={handleDragEnd}
      weekSlots={getTeamGameweekSlots(upcomingByTeam, p.core.team, currentGw, deadlines)}
      difficultyMap={difficultyMap}
      onSlotClick={onSlotClick}
      gameLogs={gameLogsByPlayer?.[p.core.id]}
      showCollege={showCollege}
      showBadgesColumn
      badges={badgesForPlayer(p)}
    />
  );

  return (
    <div className="relative space-y-4">
      {/* Fixed centered league watermark — portalled to <body> so no transformed ancestor can constrain it */}
      {typeof document !== "undefined" && createPortal(
        <img
          src={leagueLogo}
          alt=""
          aria-hidden
          className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14vw] max-w-[220px] opacity-[0.05] z-0 select-none"
        />,
        document.body,
      )}
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.25)]">
        <div className="section-bar rounded-none">STARTING 5</div>
        <div className="overflow-x-auto premium-scroll">
          <Table className={showCollege ? "min-w-[1190px]" : "min-w-[1090px]"}>{header}
            <TableBody>{starters.map(renderRow)}</TableBody>
          </Table>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.25)]">
        <div className="section-bar rounded-none">BENCH</div>
        <div className="overflow-x-auto premium-scroll">
          <Table className={showCollege ? "min-w-[1190px]" : "min-w-[1090px]"}>{header}
            <TableBody>{bench.map(renderRow)}</TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
