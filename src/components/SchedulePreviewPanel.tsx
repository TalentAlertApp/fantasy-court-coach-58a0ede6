import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { getCurrentGameday } from "@/lib/deadlines";
import { getTeamLogo } from "@/lib/nba-teams";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
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

  const { standingsByTeam, last5ByTeam, divisionRankByTeam } = useStandingsContext();
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
              onClick={() => setDay(d)}
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
        <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto">
          {dayGames.map((g) => {
            const homeLogo = getTeamLogo(g.home_team);
            const awayLogo = getTeamLogo(g.away_team);
            const homeInvolved = rosterTeamSet.has(g.home_team);
            const awayInvolved = rosterTeamSet.has(g.away_team);
            const involved = homeInvolved || awayInvolved;
            return (
              <div
                key={g.game_id}
                className={`flex items-center justify-between gap-2 px-2 h-7 rounded-md ${rowBg} border-l-2 ${
                  involved ? "border-l-[hsl(var(--nba-yellow))]" : "border-l-transparent"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {awayLogo && (
                    <img src={awayLogo} alt={g.away_team} className="h-4 w-4 object-contain" />
                  )}
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      awayInvolved ? "text-[hsl(var(--nba-yellow))]" : "text-foreground/90"
                    }`}
                  >
                    {g.away_team}
                  </span>
                  <span className="text-[9px] text-muted-foreground">@</span>
                  {homeLogo && (
                    <img src={homeLogo} alt={g.home_team} className="h-4 w-4 object-contain" />
                  )}
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      homeInvolved ? "text-[hsl(var(--nba-yellow))]" : "text-foreground/90"
                    }`}
                  >
                    {g.home_team}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {fmtTime(g.tipoff_utc)}
                </span>
              </div>
            );
          })}
        </div>
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