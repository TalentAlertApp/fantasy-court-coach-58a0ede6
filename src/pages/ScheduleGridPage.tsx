import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { DEADLINES } from "@/lib/deadlines";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import TeamModal from "@/components/TeamModal";

function buildWeekDayToDate(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of DEADLINES) {
    const dt = new Date(d.deadline_utc);
    map[`${d.gw}-${d.day}`] = dt.toISOString().slice(0, 10);
  }
  return map;
}
const WEEK_DAY_TO_DATE = buildWeekDayToDate();

export default function ScheduleGridPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gw = parseInt(searchParams.get("gw") ?? "1", 10);
  const { data: games, isLoading } = useScheduleWeekGames(gw);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    return DEADLINES
      .filter((d) => d.gw === gw)
      .map((d) => {
        const dateStr = WEEK_DAY_TO_DATE[`${d.gw}-${d.day}`] ?? "";
        const dateObj = new Date(dateStr);
        const dayOfWeek = format(dateObj, "EEE").toUpperCase();
        const dayNum = dateObj.getDate();
        const monthShort = format(dateObj, "MMM");
        return { day: d.day, dateStr, dayOfWeek, dateObj, dayNum, monthShort };
      });
  }, [gw]);

  const dateRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    return `${format(weekDays[0].dateObj, "MMM d")} – ${format(weekDays[weekDays.length - 1].dateObj, "MMM d")}`;
  }, [weekDays]);

  // Build team → day → opponent(s) map
  const teamGrid = useMemo(() => {
    if (!games) return new Map<string, Map<number, { opp: string; isHome: boolean }[]>>();
    const map = new Map<string, Map<number, { opp: string; isHome: boolean }[]>>();
    for (const g of games) {
      if (!map.has(g.home_team)) map.set(g.home_team, new Map());
      const hm = map.get(g.home_team)!;
      if (!hm.has(g.day)) hm.set(g.day, []);
      hm.get(g.day)!.push({ opp: g.away_team, isHome: true });

      if (!map.has(g.away_team)) map.set(g.away_team, new Map());
      const am = map.get(g.away_team)!;
      if (!am.has(g.day)) am.set(g.day, []);
      am.get(g.day)!.push({ opp: g.home_team, isHome: false });
    }
    return map;
  }, [games]);

  const sortedTeams = useMemo(() => [...NBA_TEAMS].sort((a, b) => a.tricode.localeCompare(b.tricode)), []);

  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const wd of weekDays) totals[wd.day] = 0;
    if (games) {
      for (const g of games) totals[g.day] = (totals[g.day] || 0) + 1;
    }
    return totals;
  }, [games, weekDays]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const hasFilter = selectedDays.size > 0;

  const isTeamVisible = (tricode: string) => {
    if (!hasFilter) return true;
    const dayMap = teamGrid.get(tricode);
    if (!dayMap) return false;
    for (const d of selectedDays) {
      if (!dayMap.has(d)) return false; // must play on ALL selected days
    }
    return true;
  };

  const totalGamesWeek = games?.length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-[hsl(var(--nba-navy))] text-primary-foreground px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/schedule")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Schedule
          </Button>
          <div className="h-5 w-px bg-white/20" />
          <div>
            <h1 className="font-heading font-bold text-base tracking-wider uppercase">
              Advanced Schedule Grid
            </h1>
            <p className="text-[11px] opacity-60 font-heading">
              GW {gw} · {dateRange} · {totalGamesWeek} games
            </p>
          </div>
        </div>
      </div>

      {/* Body: sidebar + table */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — Day Filters */}
        <div className="w-[180px] shrink-0 border-r bg-card p-3 space-y-3 overflow-y-auto hidden md:block">
          <div>
            <h3 className="font-heading font-bold text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Show teams playing on
            </h3>
            <div className="space-y-1.5">
              {weekDays.map((wd) => {
                const checked = selectedDays.has(wd.day);
                return (
                  <label
                    key={wd.day}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "bg-[hsl(var(--nba-yellow))]/15 border border-[hsl(var(--nba-yellow))]/40"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDay(wd.day)}
                      className="h-3.5 w-3.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-bold text-xs">{wd.dayOfWeek}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{wd.dayNum} {wd.monthShort}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {dayTotals[wd.day] || 0} game{(dayTotals[wd.day] || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[10px]"
              onClick={() => setSelectedDays(new Set())}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Mobile day filter strip */}
        <div className="md:hidden shrink-0 border-b bg-card px-2 py-1.5 flex gap-1 overflow-x-auto scrollbar-hide absolute left-0 right-0 z-10">
          {weekDays.map((wd) => {
            const checked = selectedDays.has(wd.day);
            return (
              <button
                key={wd.day}
                onClick={() => toggleDay(wd.day)}
                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-heading font-bold transition-colors ${
                  checked
                    ? "bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))]"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {wd.dayOfWeek} {wd.dayNum}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading schedule…
            </div>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[hsl(var(--nba-navy))] text-white">
                  <th className="text-left px-3 py-2.5 font-heading text-[11px] uppercase tracking-wider w-[140px] sticky top-0 left-0 bg-[hsl(var(--nba-navy))] z-30 border-r border-white/10">
                    Team
                  </th>
                  <th className="px-2 py-2.5 font-heading text-[11px] uppercase tracking-wider w-[50px] text-center border-r border-white/10 sticky top-0 z-20 bg-[hsl(var(--nba-navy))]">
                    G
                  </th>
                  {weekDays.map((wd) => (
                    <th
                      key={wd.day}
                      className={`px-2 py-2.5 font-heading text-[11px] uppercase tracking-wider text-center min-w-[80px] transition-colors sticky top-0 z-10 ${
                        selectedDays.has(wd.day)
                          ? "bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))]"
                          : "bg-[hsl(var(--nba-navy))]"
                      }`}
                    >
                      <div className="font-bold">{wd.dayOfWeek}</div>
                      <div className="text-[9px] opacity-70 font-mono">{wd.dayNum}/{wd.monthShort}</div>
                    </th>
                  ))}
                </tr>
                {/* Totals row */}
                <tr className="bg-muted/80 border-b-2 border-border">
                  <td className="px-3 py-1.5 font-heading text-[10px] uppercase text-muted-foreground font-bold sticky top-[41px] left-0 bg-muted z-30 border-r border-border">
                    # Games
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-xs sticky top-[41px] z-20 bg-muted">
                    {Object.values(dayTotals).reduce((a, b) => a + b, 0)}
                  </td>
                  {weekDays.map((wd) => (
                    <td
                      key={wd.day}
                      className={`px-2 py-1.5 text-center font-mono font-bold text-xs sticky top-[41px] z-10 ${
                        selectedDays.has(wd.day) ? "bg-[hsl(var(--nba-yellow))]/10" : "bg-muted"
                      }`}
                    >
                      {dayTotals[wd.day] || "—"}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const visible = isTeamVisible(team.tricode);
                  if (!visible) return null;

                  const dayMap = teamGrid.get(team.tricode);
                  const totalGames = weekDays.reduce(
                    (sum, wd) => sum + (dayMap?.get(wd.day)?.length ?? 0),
                    0
                  );

                  return (
                    <tr
                      key={team.tricode}
                      className="border-b border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r border-border/40">
                        <button
                          onClick={() => setSelectedTeam(team.tricode)}
                          className="flex items-center gap-2 hover:opacity-80 cursor-pointer"
                        >
                          <img src={team.logo} alt="" className="w-5 h-5" />
                          <span className="font-heading font-bold text-xs hover:text-primary hover:underline">{team.tricode}</span>
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center border-r border-border/40">
                        <span
                          className={`font-mono font-bold text-sm ${
                            totalGames >= 4
                              ? "text-green-600"
                              : totalGames <= 2
                              ? "text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {totalGames}
                        </span>
                      </td>
                      {weekDays.map((wd) => {
                        const matchups = dayMap?.get(wd.day);
                        const isDaySelected = selectedDays.has(wd.day);
                        return (
                          <td
                            key={wd.day}
                            className={`px-2 py-2 text-center transition-colors ${
                              matchups
                                ? isDaySelected
                                  ? "bg-[hsl(var(--nba-yellow))]/15"
                                  : "bg-accent/10"
                                : isDaySelected
                                ? "bg-[hsl(var(--nba-yellow))]/5"
                                : ""
                            }`}
                          >
                            {matchups ? (
                              matchups.map((m, i) => (
                                <div
                                  key={i}
                                  className="font-mono text-xs font-semibold whitespace-nowrap"
                                >
                                  <span
                                    className={
                                      m.isHome
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {m.isHome ? "" : "@"}
                                    {m.opp}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-muted-foreground/20">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <TeamModal
        tricode={selectedTeam}
        open={selectedTeam !== null}
        onOpenChange={(open) => { if (!open) setSelectedTeam(null); }}
      />
    </div>
  );
}
