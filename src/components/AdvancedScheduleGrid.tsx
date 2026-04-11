import { useMemo, useState } from "react";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { DEADLINES } from "@/lib/deadlines";
import { NBA_TEAMS, getTeamLogo } from "@/lib/nba-teams";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parse } from "date-fns";

interface Props {
  gw: number;
  onClose: () => void;
}

function buildWeekDayToDate(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of DEADLINES) {
    const dt = new Date(d.deadline_utc);
    map[`${d.gw}-${d.day}`] = dt.toISOString().slice(0, 10);
  }
  return map;
}
const WEEK_DAY_TO_DATE = buildWeekDayToDate();

export default function AdvancedScheduleGrid({ gw, onClose }: Props) {
  const { data: games, isLoading } = useScheduleWeekGames(gw);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());

  const weekDays = useMemo(() => {
    return DEADLINES
      .filter((d) => d.gw === gw)
      .map((d) => {
        const dateStr = WEEK_DAY_TO_DATE[`${d.gw}-${d.day}`] ?? "";
        const dateObj = new Date(dateStr);
        const dayOfWeek = format(dateObj, "EEE").toUpperCase();
        return { day: d.day, dateStr, dayOfWeek, dateObj };
      });
  }, [gw]);

  // Build team → day → opponent(s) map
  const teamGrid = useMemo(() => {
    if (!games) return new Map<string, Map<number, { opp: string; isHome: boolean }[]>>();
    const map = new Map<string, Map<number, { opp: string; isHome: boolean }[]>>();

    for (const g of games) {
      // Home team entry
      if (!map.has(g.home_team)) map.set(g.home_team, new Map());
      const hm = map.get(g.home_team)!;
      if (!hm.has(g.day)) hm.set(g.day, []);
      hm.get(g.day)!.push({ opp: g.away_team, isHome: true });

      // Away team entry
      if (!map.has(g.away_team)) map.set(g.away_team, new Map());
      const am = map.get(g.away_team)!;
      if (!am.has(g.day)) am.set(g.day, []);
      am.get(g.day)!.push({ opp: g.home_team, isHome: false });
    }
    return map;
  }, [games]);

  // Sort teams alphabetically
  const sortedTeams = useMemo(() => {
    return [...NBA_TEAMS].sort((a, b) => a.tricode.localeCompare(b.tricode));
  }, []);

  // Games per day totals
  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const wd of weekDays) totals[wd.day] = 0;
    if (games) {
      for (const g of games) {
        totals[g.day] = (totals[g.day] || 0) + 1;
      }
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
      if (dayMap.has(d)) return true;
    }
    return false;
  };

  return (
    <div className="relative bg-card/95 backdrop-blur-xl border rounded-sm shadow-2xl mx-0 mt-1 overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(var(--nba-navy))] text-white">
        <div>
          <h3 className="font-heading font-bold text-sm tracking-wider uppercase">Advanced Schedule Grid</h3>
          <p className="text-[10px] opacity-60 font-heading">GW {gw} · Click day headers to filter</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-white/80 hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[hsl(var(--nba-navy))] text-white">
              <th className="text-left px-2 py-1.5 font-heading text-[10px] uppercase tracking-wider w-[120px] sticky left-0 bg-[hsl(var(--nba-navy))] z-20">Team</th>
              <th className="px-1.5 py-1.5 font-heading text-[10px] uppercase tracking-wider w-[40px] text-center">G</th>
              {weekDays.map((wd) => (
                <th
                  key={wd.day}
                  className={`px-1.5 py-1.5 font-heading text-[10px] uppercase tracking-wider text-center cursor-pointer transition-colors min-w-[70px] select-none ${
                    selectedDays.has(wd.day)
                      ? "bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))]"
                      : "hover:bg-white/10"
                  }`}
                  onClick={() => toggleDay(wd.day)}
                >
                  <div>{wd.dayOfWeek}</div>
                  <div className="text-[8px] opacity-70">{format(wd.dateObj, "d/M")}</div>
                </th>
              ))}
            </tr>
            {/* Totals row */}
            <tr className="bg-muted/50 border-b">
              <td className="px-2 py-1 font-heading text-[9px] uppercase text-muted-foreground sticky left-0 bg-muted/50 z-20"># Games</td>
              <td className="px-1.5 py-1 text-center font-mono font-bold text-[10px]">
                {Object.values(dayTotals).reduce((a, b) => a + b, 0)}
              </td>
              {weekDays.map((wd) => (
                <td key={wd.day} className={`px-1.5 py-1 text-center font-mono font-bold text-[10px] ${selectedDays.has(wd.day) ? "bg-accent/30" : ""}`}>
                  {dayTotals[wd.day] || "—"}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => {
              const visible = isTeamVisible(team.tricode);
              const dayMap = teamGrid.get(team.tricode);
              const totalGames = weekDays.reduce((sum, wd) => sum + (dayMap?.get(wd.day)?.length ?? 0), 0);

              if (!visible) return null;

              return (
                <tr key={team.tricode} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                  <td className="px-2 py-1 sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-1.5">
                      <img src={team.logo} alt="" className="w-4 h-4" />
                      <span className="font-heading font-bold text-[10px]">{team.tricode}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-1 text-center">
                    <span className={`font-mono font-bold text-[11px] ${totalGames >= 4 ? "text-green-600" : totalGames <= 2 ? "text-destructive" : ""}`}>
                      {totalGames}
                    </span>
                  </td>
                  {weekDays.map((wd) => {
                    const matchups = dayMap?.get(wd.day);
                    const isDaySelected = selectedDays.has(wd.day);
                    return (
                      <td
                        key={wd.day}
                        className={`px-1.5 py-1 text-center ${
                          matchups ? (isDaySelected ? "bg-accent/40" : "bg-accent/10") : ""
                        }`}
                      >
                        {matchups ? matchups.map((m, i) => (
                          <div key={i} className="font-mono text-[10px] font-medium whitespace-nowrap">
                            <span className={m.isHome ? "text-foreground" : "text-muted-foreground"}>
                              {m.isHome ? "" : "@"}{m.opp}
                            </span>
                          </div>
                        )) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
