import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { getCurrentGameday } from "@/lib/deadlines";
import { getTeamLogo, getTeamByTricode } from "@/lib/nba-teams";
import { getVenue } from "@/lib/nba-venues";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import type { Last5Detail } from "@/hooks/useStandingsContext";
import { NBA_TEAMS } from "@/lib/nba-teams";

interface BodyProps {
  rosterTeams: string[];
  defaultGw?: number;
  /** Visual variant — "dark" matches the player picker's court panel, "panel" matches page surfaces. */
  variant?: "dark" | "panel";
}

/** Headless body — GW selector + day chips + matchup list. No collapsible wrapper. */
export function SchedulePreviewBody({ rosterTeams, defaultGw, variant = "panel" }: BodyProps) {
  const initial = useMemo(() => getCurrentGameday(), []);
  const [gw, setGw] = useState<number>(defaultGw ?? initial.gw);

  const { data: games = [], isLoading } = useScheduleWeekGames(gw);

  const daysWithGames = useMemo(() => {
    const set = new Set<number>();
    for (const g of games) set.add(g.day);
    return Array.from(set).sort((a, b) => a - b);
  }, [games]);

  const [day, setDay] = useState<number>(initial.day);
  // Track GW transitions so we only auto-snap the day on GW change or first
  // load — never overriding a user's manual day-chip click.
  const lastGwRef = useRef<number>(gw);
  const snappedRef = useRef<boolean>(false);
  useEffect(() => {
    if (daysWithGames.length === 0) {
      // Empty week — reset so the next non-empty refill snaps fresh.
      snappedRef.current = false;
      return;
    }
    const gwChanged = lastGwRef.current !== gw;
    if (snappedRef.current && !gwChanged) return;
    const target = gw === initial.gw ? initial.day : 1;
    let next: number;
    if (daysWithGames.includes(target)) {
      next = target;
    } else {
      const ahead = daysWithGames.find((d) => d >= target);
      next = ahead ?? daysWithGames[0];
    }
    setDay(next);
    lastGwRef.current = gw;
    snappedRef.current = true;
  }, [daysWithGames, gw, initial.gw, initial.day]);

  const dayGames = useMemo(
    () =>
      games
        .filter((g) => g.day === day)
        .sort((a, b) => (a.tipoff_utc ?? "").localeCompare(b.tipoff_utc ?? "")),
    [games, day]
  );

  const rosterTeamSet = useMemo(() => new Set(rosterTeams), [rosterTeams]);

  const { standingsByTeam, last5ByTeam, last5DetailByTeam, divisionRankByTeam } = useStandingsContext();
  const primaryByTeam = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of NBA_TEAMS) m[t.tricode] = t.primaryColor;
    return m;
  }, []);

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const dark = variant === "dark";
  const containerCls = dark
    ? "rounded-lg bg-black/30 border border-white/10 p-2.5"
    : "rounded-lg bg-card/40 border border-border p-2.5";
  const navBtnCls = dark
    ? "h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/40 border border-white/10 hover:bg-black/60 disabled:opacity-30"
    : "h-7 w-7 inline-flex items-center justify-center rounded-md bg-muted border border-border hover:bg-muted/70 disabled:opacity-30";
  const chipInactive = dark
    ? "bg-black/40 border border-white/10 text-foreground/60 hover:text-foreground hover:bg-black/60"
    : "bg-muted border border-border text-foreground/60 hover:text-foreground hover:bg-muted/70";
  const rowBg = dark ? "bg-black/30" : "bg-muted/40";

  return (
    <div className={containerCls}>
      {/* GW selector */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => setGw((g) => Math.max(1, g - 1))}
          className={navBtnCls}
          disabled={gw <= 1}
          aria-label="Previous gameweek"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] uppercase tracking-[0.25em] font-heading text-foreground/80">
          GW {gw}
        </span>
        <button
          type="button"
          onClick={() => setGw((g) => g + 1)}
          className={navBtnCls}
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
              onClick={() => {
                snappedRef.current = true;
                setDay(d);
              }}
              className={`h-6 px-2 rounded-md text-[10px] uppercase tracking-wider font-heading transition-colors ${
                d === day ? "bg-accent text-accent-foreground" : chipInactive
              }`}
            >
              D{d}
            </button>
          ))}
        </div>
      )}

      {/* Matchups */}
      {isLoading ? (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center">
          Loading…
        </p>
      ) : dayGames.length === 0 ? (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center">
          No games
        </p>
      ) : (
        <TooltipProvider delayDuration={120}>
          <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {dayGames.map((g) => (
              <MatchupCard
                key={g.game_id}
                game={g}
                rowBg={rowBg}
                rosterTeamSet={rosterTeamSet}
                standingsByTeam={standingsByTeam}
                last5ByTeam={last5ByTeam}
                last5DetailByTeam={last5DetailByTeam}
                divisionRankByTeam={divisionRankByTeam}
                primaryByTeam={primaryByTeam}
                fmtTime={fmtTime}
              />
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

interface CollapsibleProps extends BodyProps {
  /** Optional controlled open state; if omitted, manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** Collapsible variant used inside the player picker — includes a trigger button. */
export function SchedulePreviewCollapsible({
  rosterTeams,
  defaultGw,
  variant = "dark",
  open: openProp,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    if (openProp === undefined) setInternalOpen(v);
  };

  const initial = useMemo(() => getCurrentGameday(), []);
  const triggerGw = defaultGw ?? initial.gw;

  const dark = variant === "dark";
  const triggerCls = dark
    ? "w-full flex items-center justify-between gap-2 px-3 h-9 rounded-lg bg-black/40 border border-white/10 text-foreground/80 hover:text-foreground hover:bg-black/60 transition-colors"
    : "w-full flex items-center justify-between gap-2 px-3 h-9 rounded-lg bg-card/40 border border-border text-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={`shrink-0 ${className ?? ""}`}>
      <CollapsibleTrigger className={triggerCls}>
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-heading">
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule · GW{triggerGw}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <SchedulePreviewBody rosterTeams={rosterTeams} defaultGw={defaultGw} variant={variant} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/* -----------------------------------------------------------------------
 * MatchupCard — premium 2-row card with full-height team-badge watermarks
 * --------------------------------------------------------------------- */

interface GameLite {
  game_id: string;
  home_team: string;
  away_team: string;
  tipoff_utc: string | null;
}

interface MatchupCardProps {
  game: GameLite;
  rowBg: string;
  rosterTeamSet: Set<string>;
  standingsByTeam: Record<string, any>;
  last5ByTeam: Record<string, ("W" | "L")[]>;
  last5DetailByTeam: Record<string, Last5Detail[]>;
  divisionRankByTeam: Record<string, { rank: number; divLabel: string; ordinal: string }>;
  primaryByTeam: Record<string, string>;
  fmtTime: (iso: string | null) => string;
}

function fmtPct(pct: number) {
  return pct > 0 ? `.${String(Math.round(pct * 1000)).padStart(3, "0")}` : ".000";
}

function fmtGameDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function ResultDots({
  details,
  align = "start",
  ownTri,
}: {
  details: Last5Detail[];
  align?: "start" | "end";
  ownTri: string;
}) {
  const padded: (Last5Detail | null)[] = [];
  // oldest → newest, left to right; pad placeholders on the LEFT so the
  // most-recent result always sits flush at the same edge.
  const empties = Math.max(0, 5 - details.length);
  for (let i = 0; i < empties; i++) padded.push(null);
  for (const d of details) padded.push(d);

  return (
    <div className={`flex items-center gap-0.5 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {padded.map((d, i) => {
        if (!d) {
          return (
            <span
              key={i}
              className="h-3 w-3 rounded-full bg-muted-foreground/10 ring-1 ring-inset ring-muted-foreground/20"
            />
          );
        }
        const dot = (
          <span
            className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] font-mono font-black leading-none cursor-help transition-all duration-200 hover:scale-125 ${
              d.result === "W"
                ? "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/70 shadow-[0_0_8px_hsl(142_70%_50%/0.45)]"
                : "bg-red-500/25 text-red-300 ring-1 ring-red-400/70 shadow-[0_0_8px_hsl(0_70%_55%/0.45)]"
            }`}
          >
            {d.result}
          </span>
        );
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>{dot}</TooltipTrigger>
            <TooltipContent
              side="top"
              align="center"
              sideOffset={6}
              collisionPadding={16}
              avoidCollisions
              className="z-[60] whitespace-nowrap text-[10px] font-mono py-1.5 px-2.5 border-border/60 bg-popover/95 backdrop-blur-md shadow-xl"
            >
              <span className={`font-bold ${d.result === "W" ? "text-emerald-400" : "text-red-400"}`}>
                {d.result} {d.ownPts}-{d.oppPts}
              </span>{" "}
              <span className="text-muted-foreground">vs {d.opp}</span>
              <span className="ml-1 text-muted-foreground/70">· {fmtGameDate(d.date)}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function MatchupCard({
  game: g,
  rowBg,
  rosterTeamSet,
  standingsByTeam,
  last5DetailByTeam,
  divisionRankByTeam,
  primaryByTeam,
  fmtTime,
}: MatchupCardProps) {
  const homeLogo = getTeamLogo(g.home_team);
  const awayLogo = getTeamLogo(g.away_team);
  const homeInvolved = rosterTeamSet.has(g.home_team);
  const awayInvolved = rosterTeamSet.has(g.away_team);
  const involved = homeInvolved || awayInvolved;

  const homeStanding = standingsByTeam[g.home_team];
  const awayStanding = standingsByTeam[g.away_team];
  const homeDetail = last5DetailByTeam[g.home_team] ?? [];
  const awayDetail = last5DetailByTeam[g.away_team] ?? [];
  const homeRank = divisionRankByTeam[g.home_team];
  const awayRank = divisionRankByTeam[g.away_team];
  const awayPrimary = primaryByTeam[g.away_team];
  const homePrimary = primaryByTeam[g.home_team];
  const venue = getVenue(g.home_team);
  const awayName = getTeamByTricode(g.away_team)?.name ?? g.away_team;
  const homeName = getTeamByTricode(g.home_team)?.name ?? g.home_team;

  return (
    <div
      className={`group relative overflow-hidden rounded-lg ${rowBg} border-l-2 ${
        involved ? "border-l-[hsl(var(--nba-yellow))]" : "border-l-transparent"
      } shadow-sm hover:shadow-lg transition-shadow duration-300`}
    >
      {/* Venue arena image — full-card background, very subtle */}
      {venue?.image && (
        <img
          src={venue.image}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.18] group-hover:opacity-[0.28] transition-opacity duration-500"
        />
      )}
      {/* Readability gradient over venue */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/85 via-card/55 to-card/85" />

      {/* Center watermarks — away badge sits left of @, home badge sits right of @ */}
      <div className="absolute inset-y-0 left-0 right-0 pointer-events-none flex items-center justify-center gap-[14%]">
        {awayLogo && (
          <img
            src={awayLogo}
            alt=""
            aria-hidden
            className="h-[160%] w-auto opacity-[0.16] transition-all duration-500 ease-out group-hover:opacity-[0.42] group-hover:scale-110"
            style={{ filter: awayPrimary ? `drop-shadow(0 0 14px ${awayPrimary}66)` : undefined }}
          />
        )}
        {homeLogo && (
          <img
            src={homeLogo}
            alt=""
            aria-hidden
            className="h-[160%] w-auto opacity-[0.16] transition-all duration-500 ease-out group-hover:opacity-[0.42] group-hover:scale-110"
            style={{ filter: homePrimary ? `drop-shadow(0 0 14px ${homePrimary}66)` : undefined }}
          />
        )}
      </div>

      {/* Content — 2 rows, mirrored about center */}
      <div className="relative z-10 px-3 py-2 flex flex-col gap-1">
        {/* Row 1 — matchup header (full team names) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Away cluster */}
          <div className="flex items-center gap-2 min-w-0 justify-start">
            <span
              className={`text-[12px] font-heading font-black uppercase tracking-wide truncate ${
                awayInvolved ? "text-[hsl(var(--nba-yellow))]" : "text-foreground"
              }`}
              title={awayName}
            >
              {awayName}
            </span>
            {awayRank && (
              <span className="text-[8.5px] uppercase font-heading tracking-wider px-1.5 py-0.5 rounded-full bg-foreground/5 border border-foreground/10 text-foreground/70 whitespace-nowrap shrink-0">
                {awayRank.ordinal} {awayRank.divLabel}
              </span>
            )}
          </div>

          {/* Center anchor — @ + tip-off time */}
          <div className="flex flex-col items-center leading-none gap-0.5 px-2 shrink-0">
            <span className="text-[10px] text-muted-foreground/80 font-bold">@</span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
              {fmtTime(g.tipoff_utc)}
            </span>
          </div>

          {/* Home cluster (mirrored) */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            {homeRank && (
              <span className="text-[8.5px] uppercase font-heading tracking-wider px-1.5 py-0.5 rounded-full bg-foreground/5 border border-foreground/10 text-foreground/70 whitespace-nowrap shrink-0">
                {homeRank.ordinal} {homeRank.divLabel}
              </span>
            )}
            <span
              className={`text-[12px] font-heading font-black uppercase tracking-wide truncate text-right ${
                homeInvolved ? "text-[hsl(var(--nba-yellow))]" : "text-foreground"
              }`}
              title={homeName}
            >
              {homeName}
            </span>
          </div>
        </div>

        {/* Row 2 — premium stats line: form pills + record chips */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Away stats */}
          <div className="flex items-center gap-2 justify-start min-w-0">
            <ResultDots details={awayDetail} align="start" ownTri={g.away_team} />
            {awayStanding && awayStanding.gp > 0 ? (
              <span className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.04] border border-foreground/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
                <span className="font-bold text-foreground/90">{awayStanding.w}-{awayStanding.l}</span>
                <span className="text-muted-foreground/70 text-[9px]">{fmtPct(awayStanding.pct)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/40 text-[10px] font-mono">—</span>
            )}
            {awayStanding && (awayStanding.awayW + awayStanding.awayL) > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono tabular-nums text-muted-foreground/80 whitespace-nowrap">
                <span className="text-[8.5px] uppercase font-heading tracking-wider text-muted-foreground/60">A</span>
                {awayStanding.awayW}-{awayStanding.awayL}
              </span>
            )}
          </div>

          <span className="h-3 w-px bg-foreground/10" aria-hidden />

          {/* Home stats (mirrored) */}
          <div className="flex items-center gap-2 justify-end min-w-0">
            {homeStanding && (homeStanding.homeW + homeStanding.homeL) > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono tabular-nums text-muted-foreground/80 whitespace-nowrap">
                <span className="text-[8.5px] uppercase font-heading tracking-wider text-muted-foreground/60">H</span>
                {homeStanding.homeW}-{homeStanding.homeL}
              </span>
            )}
            {homeStanding && homeStanding.gp > 0 ? (
              <span className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.04] border border-foreground/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
                <span className="font-bold text-foreground/90">{homeStanding.w}-{homeStanding.l}</span>
                <span className="text-muted-foreground/70 text-[9px]">{fmtPct(homeStanding.pct)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/40 text-[10px] font-mono">—</span>
            )}
            <ResultDots details={homeDetail} align="end" ownTri={g.home_team} />
          </div>
        </div>
      </div>
    </div>
  );
}